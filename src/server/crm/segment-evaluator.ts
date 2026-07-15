import { z } from 'zod'

// Pure declarative segment rule engine. A rule is a tree of and/or groups over
// comparison conditions on the flat CustomerFacts projection (built from
// metrics + profile). Kept free of I/O so it is unit-testable; the Zod schema
// is shared with the feature-layer validation so stored rules are always
// well-formed.

export const SEGMENT_FIELDS = [
  'totalSpend',
  'ordersCount',
  'avgOrderValue',
  'returnsCount',
  'visitCount',
  'daysSinceLastPurchase',
  'loyaltyPoints',
  'lifetimePoints',
  'churnScore',
  'rfmSegment',
  'lifecycleStatus',
  'vipLevel',
  'isCorporate',
  'acquisitionChannel',
] as const

export type SegmentField = (typeof SEGMENT_FIELDS)[number]

export const SEGMENT_COMPARATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'contains',
] as const

export type SegmentComparator = (typeof SEGMENT_COMPARATORS)[number]

const conditionSchema = z.object({
  field: z.enum(SEGMENT_FIELDS),
  cmp: z.enum(SEGMENT_COMPARATORS),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number()])),
  ]),
})

export type SegmentCondition = z.infer<typeof conditionSchema>

// A group is { op, conditions } where each condition is either a leaf or a
// nested group. Zod needs an explicit type for the recursion.
export interface SegmentRuleGroup {
  op: 'and' | 'or'
  conditions: Array<SegmentCondition | SegmentRuleGroup>
}

export const segmentRuleSchema: z.ZodType<SegmentRuleGroup> = z.lazy(() =>
  z.object({
    op: z.enum(['and', 'or']),
    conditions: z
      .array(z.union([conditionSchema, segmentRuleSchema]))
      .min(1)
      .max(50),
  })
)

export interface CustomerFacts {
  totalSpend: number
  ordersCount: number
  avgOrderValue: number
  returnsCount: number
  visitCount: number
  daysSinceLastPurchase: number | null
  loyaltyPoints: number
  lifetimePoints: number
  churnScore: number | null
  rfmSegment: string | null
  lifecycleStatus: string | null
  vipLevel: number
  isCorporate: boolean
  acquisitionChannel: string | null
}

function isGroup(node: SegmentCondition | SegmentRuleGroup): node is SegmentRuleGroup {
  return 'op' in node
}

function compare(actual: unknown, cmp: SegmentComparator, expected: unknown): boolean {
  switch (cmp) {
    case 'eq':
      return actual === expected
    case 'neq':
      return actual !== expected
    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected
    case 'gte':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected
    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected
    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected
    case 'in':
      return Array.isArray(expected) && expected.includes(actual as never)
    case 'contains':
      return (
        typeof actual === 'string' &&
        typeof expected === 'string' &&
        actual.toLowerCase().includes(expected.toLowerCase())
      )
  }
}

function evaluateCondition(condition: SegmentCondition, facts: CustomerFacts): boolean {
  const actual = facts[condition.field]

  // A null fact (e.g. never-purchased customer) never satisfies a comparison.
  if (actual === null) {
    return false
  }

  return compare(actual, condition.cmp, condition.value)
}

export function evaluateSegmentRule(rule: SegmentRuleGroup, facts: CustomerFacts): boolean {
  const results = rule.conditions.map((node) =>
    isGroup(node) ? evaluateSegmentRule(node, facts) : evaluateCondition(node, facts)
  )

  return rule.op === 'and' ? results.every(Boolean) : results.some(Boolean)
}
