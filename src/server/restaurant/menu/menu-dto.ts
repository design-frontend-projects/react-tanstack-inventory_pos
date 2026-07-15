import type {
  ResCombo,
  ResComboComponent,
  ResMenuItem,
  ResMenuItemPrice,
  ResMenuItemVariant,
  ResModifier,
} from '#/server/db/generated/prisma/client'

// Stringify Decimal columns on menu rows for the server-function boundary.

function dec(value: { toString: () => string } | null): string | null {
  return value === null ? null : value.toString()
}

export function serializeMenuItem(item: ResMenuItem) {
  return { ...item, basePrice: item.basePrice.toString() }
}

export function serializeVariant(variant: ResMenuItemVariant) {
  return { ...variant, priceDelta: variant.priceDelta.toString() }
}

export function serializePriceRule(rule: ResMenuItemPrice) {
  return { ...rule, amount: rule.amount.toString() }
}

export function serializeModifier(modifier: ResModifier) {
  return { ...modifier, priceDelta: modifier.priceDelta.toString() }
}

export function serializeCombo(combo: ResCombo) {
  return { ...combo, price: dec(combo.price) }
}

export function serializeComboComponent(component: ResComboComponent) {
  return { ...component, priceDelta: dec(component.priceDelta) }
}
