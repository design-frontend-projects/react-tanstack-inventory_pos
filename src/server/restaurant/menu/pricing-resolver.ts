// Pure, table-driven menu price resolver. Given a base price and a set of
// configured price rules, it resolves the effective price for an evaluation
// context (service type, channel, and branch-local time). No DB or clock access
// happens inside — `now` is injected — so the resolver is exhaustively testable.
//
// Precedence: applicable rules are ranked by `priority` (desc), then by
// specificity (a rule constrained on service type / channel / schedule beats a
// looser one), then by the smaller amount (a deliberate promo-friendly tie-break).
// If no rule applies, the item's own `basePrice` is used.

export interface PriceRuleSchedule {
  weekdays?: Array<number> // 0=Sun … 6=Sat (branch-local)
  from?: string // "HH:mm"
  to?: string // "HH:mm"
}

export interface PriceRuleInput {
  id: string
  priceType: string
  amount: string
  serviceTypeId?: string | null
  channel?: string | null
  scheduleJson?: PriceRuleSchedule | null
  priority: number
  startsAt?: Date | null
  endsAt?: Date | null
}

export interface PricingContext {
  serviceTypeId?: string | null
  channel?: string | null
  now: Date // branch-local time
}

export interface ResolvedPrice {
  amount: string
  priceType: string
  appliedRuleId: string | null
}

function toMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!match) {
    return null
  }
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) {
    return null
  }
  return hours * 60 + minutes
}

function withinWindow(nowMinutes: number, from: number, to: number): boolean {
  // Overnight windows (e.g. 22:00 -> 02:00) wrap past midnight.
  return from <= to ? nowMinutes >= from && nowMinutes < to : nowMinutes >= from || nowMinutes < to
}

function scheduleMatches(schedule: PriceRuleSchedule, now: Date): boolean {
  if (schedule.weekdays && schedule.weekdays.length > 0) {
    if (!schedule.weekdays.includes(now.getDay())) {
      return false
    }
  }
  if (schedule.from && schedule.to) {
    const from = toMinutes(schedule.from)
    const to = toMinutes(schedule.to)
    if (from === null || to === null) {
      return false
    }
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    if (!withinWindow(nowMinutes, from, to)) {
      return false
    }
  }
  return true
}

export function ruleApplies(rule: PriceRuleInput, ctx: PricingContext): boolean {
  if (rule.startsAt && ctx.now < rule.startsAt) {
    return false
  }
  if (rule.endsAt && ctx.now > rule.endsAt) {
    return false
  }
  if (rule.serviceTypeId && rule.serviceTypeId !== ctx.serviceTypeId) {
    return false
  }
  if (rule.channel && rule.channel !== ctx.channel) {
    return false
  }
  if (rule.scheduleJson && !scheduleMatches(rule.scheduleJson, ctx.now)) {
    return false
  }
  return true
}

function specificity(rule: PriceRuleInput): number {
  let score = 0
  if (rule.serviceTypeId) score += 1
  if (rule.channel) score += 1
  if (rule.scheduleJson && (rule.scheduleJson.weekdays?.length || rule.scheduleJson.from)) {
    score += 1
  }
  return score
}

export function resolvePrice(
  basePrice: string,
  rules: ReadonlyArray<PriceRuleInput>,
  ctx: PricingContext
): ResolvedPrice {
  const applicable = rules.filter((rule) => ruleApplies(rule, ctx))

  if (applicable.length === 0) {
    return { amount: basePrice, priceType: 'BASE', appliedRuleId: null }
  }

  const winner = [...applicable].sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority
    }
    const specDiff = specificity(b) - specificity(a)
    if (specDiff !== 0) {
      return specDiff
    }
    return Number(a.amount) - Number(b.amount)
  })[0]

  return { amount: winner.amount, priceType: winner.priceType, appliedRuleId: winner.id }
}
