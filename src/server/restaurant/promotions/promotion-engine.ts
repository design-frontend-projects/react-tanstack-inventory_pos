// Pure promotion evaluation engine — no I/O, fully unit-testable. The DB
// stores declarative rule rows (conditions/action as JSON); this module is the
// single interpreter, shared by order recompute and the simulator. All money
// values are decimal strings (two-decimal fixed output).

export interface PromotionCartItem {
  menuItemId: string
  categoryId?: string | null
  quantity: number
  unitPrice: string
  lineTotal: string
}

export interface PromotionCart {
  subtotal: string
  channel: string
  orderType: string
  customerId?: string | null
  items: Array<PromotionCartItem>
}

export interface PromotionTimeWindow {
  // Minutes since local midnight, [start, end).
  startMinute: number
  endMinute: number
  // 0 = Sunday … 6 = Saturday (JS Date.getDay()). Empty/omitted = every day.
  daysOfWeek?: Array<number>
}

export interface PromotionConditions {
  minSubtotal?: string
  channels?: Array<string>
  orderTypes?: Array<string>
  itemIds?: Array<string>
  categoryIds?: Array<string>
  minQuantity?: number
  timeWindow?: PromotionTimeWindow
}

export type PromotionAction =
  | { type: 'PERCENT'; value: string }
  | { type: 'FIXED'; value: string }
  | {
      type: 'BOGO'
      buyItemIds: Array<string>
      buyQuantity: number
      getQuantity: number
      // Percent off the free units; defaults to 100 (fully free).
      discountPercent?: string
    }
  | { type: 'FREE_ITEM'; menuItemId: string; quantity: number }

export interface PromotionRule {
  id: string
  name: string
  kind: string
  priority: number
  stacking: 'STACKABLE' | 'EXCLUSIVE'
  conditions: PromotionConditions
  action: PromotionAction
  code?: string | null
}

export interface PromotionApplication {
  promotionId: string
  name: string
  code?: string | null
  discount: string
  freeItems?: Array<{ menuItemId: string; quantity: number }>
}

export interface PromotionEvaluation {
  applications: Array<PromotionApplication>
  totalDiscount: string
}

function toNumber(value: string | number | undefined | null): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: number): string {
  return Math.max(0, value).toFixed(2)
}

export function matchesConditions(
  cart: PromotionCart,
  conditions: PromotionConditions,
  now: Date,
): boolean {
  if (
    conditions.minSubtotal !== undefined &&
    toNumber(cart.subtotal) < toNumber(conditions.minSubtotal)
  ) {
    return false
  }
  if (conditions.channels?.length && !conditions.channels.includes(cart.channel)) {
    return false
  }
  if (
    conditions.orderTypes?.length &&
    !conditions.orderTypes.includes(cart.orderType)
  ) {
    return false
  }

  if (conditions.itemIds?.length || conditions.categoryIds?.length) {
    const qualifying = cart.items.filter(
      (item) =>
        (conditions.itemIds?.includes(item.menuItemId) ?? false) ||
        (item.categoryId
          ? (conditions.categoryIds?.includes(item.categoryId) ?? false)
          : false),
    )
    const totalQty = qualifying.reduce((sum, item) => sum + item.quantity, 0)
    if (totalQty < (conditions.minQuantity ?? 1)) {
      return false
    }
  } else if (conditions.minQuantity !== undefined) {
    const totalQty = cart.items.reduce((sum, item) => sum + item.quantity, 0)
    if (totalQty < conditions.minQuantity) {
      return false
    }
  }

  if (conditions.timeWindow) {
    const { startMinute, endMinute, daysOfWeek } = conditions.timeWindow
    if (daysOfWeek?.length && !daysOfWeek.includes(now.getDay())) {
      return false
    }
    const minuteOfDay = now.getHours() * 60 + now.getMinutes()
    if (minuteOfDay < startMinute || minuteOfDay >= endMinute) {
      return false
    }
  }

  return true
}

function computeDiscount(
  cart: PromotionCart,
  action: PromotionAction,
): { discount: number; freeItems?: Array<{ menuItemId: string; quantity: number }> } {
  switch (action.type) {
    case 'PERCENT': {
      return {
        discount: (toNumber(cart.subtotal) * toNumber(action.value)) / 100,
      }
    }
    case 'FIXED': {
      return { discount: Math.min(toNumber(action.value), toNumber(cart.subtotal)) }
    }
    case 'BOGO': {
      const qualifying = cart.items.filter((item) =>
        action.buyItemIds.includes(item.menuItemId),
      )
      const totalQty = qualifying.reduce((sum, item) => sum + item.quantity, 0)
      const groupSize = action.buyQuantity
      if (groupSize <= 0 || totalQty < groupSize) {
        return { discount: 0 }
      }
      const freeUnits =
        Math.floor(totalQty / groupSize) * Math.max(1, action.getQuantity)
      // Grant the cheapest qualifying units so the guest always benefits.
      const unitPrices = qualifying
        .flatMap((item) =>
          Array.from({ length: item.quantity }, () => toNumber(item.unitPrice)),
        )
        .sort((a, b) => a - b)
      const percent = toNumber(action.discountPercent ?? '100') / 100
      const discount = unitPrices
        .slice(0, freeUnits)
        .reduce((sum, price) => sum + price * percent, 0)
      return { discount }
    }
    case 'FREE_ITEM': {
      // The discount is granted when the item is in the cart; otherwise the
      // application reports the granted free item for the POS to add.
      const inCart = cart.items.find(
        (item) => item.menuItemId === action.menuItemId,
      )
      if (inCart) {
        const units = Math.min(action.quantity, inCart.quantity)
        return { discount: toNumber(inCart.unitPrice) * units }
      }
      return {
        discount: 0,
        freeItems: [
          { menuItemId: action.menuItemId, quantity: action.quantity },
        ],
      }
    }
  }
}

// Evaluate the active rules against a cart. Priority (desc) orders evaluation;
// the highest-priority EXCLUSIVE match wins alone, otherwise stackables
// accumulate. The combined discount is capped at the cart subtotal.
export function evaluatePromotions(
  cart: PromotionCart,
  rules: Array<PromotionRule>,
  now: Date,
): PromotionEvaluation {
  const ordered = [...rules].sort((a, b) => b.priority - a.priority)
  const applications: Array<PromotionApplication> = []
  const subtotal = toNumber(cart.subtotal)
  let running = 0

  for (const rule of ordered) {
    if (!matchesConditions(cart, rule.conditions, now)) {
      continue
    }
    const { discount, freeItems } = computeDiscount(cart, rule.action)
    if (discount <= 0 && !freeItems?.length) {
      continue
    }
    const capped = Math.min(discount, Math.max(0, subtotal - running))
    const application: PromotionApplication = {
      promotionId: rule.id,
      name: rule.name,
      code: rule.code ?? null,
      discount: money(capped),
      ...(freeItems?.length ? { freeItems } : {}),
    }

    if (rule.stacking === 'EXCLUSIVE') {
      // Highest-priority exclusive replaces everything gathered so far.
      return {
        applications: [application],
        totalDiscount: money(Math.min(discount, subtotal)),
      }
    }

    applications.push(application)
    running += capped
  }

  return { applications, totalDiscount: money(Math.min(running, subtotal)) }
}
