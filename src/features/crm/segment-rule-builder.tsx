'use client'

import { Button } from '#/components/ui/button'
import { fieldInputClassName } from '#/components/forms/drawer-form'
import {
  SEGMENT_COMPARATORS,
  SEGMENT_FIELDS,
} from '#/server/crm/segment-evaluator'
import type {
  SegmentCondition,
  SegmentRuleGroup,
} from '#/server/crm/segment-evaluator'

// Visual editor for the declarative segment rule tree (and/or groups over
// CustomerFacts comparisons). Pure controlled component — the caller owns the
// tree; every change produces a new tree (no mutation).

const NUMERIC_FIELDS = new Set([
  'totalSpend',
  'ordersCount',
  'avgOrderValue',
  'returnsCount',
  'visitCount',
  'daysSinceLastPurchase',
  'loyaltyPoints',
  'lifetimePoints',
  'churnScore',
  'vipLevel',
])

const BOOLEAN_FIELDS = new Set(['isCorporate'])

const FIELD_LABELS: Record<string, string> = {
  totalSpend: 'Total spend',
  ordersCount: 'Orders count',
  avgOrderValue: 'Avg order value',
  returnsCount: 'Returns count',
  visitCount: 'Visit count',
  daysSinceLastPurchase: 'Days since last purchase',
  loyaltyPoints: 'Loyalty points',
  lifetimePoints: 'Lifetime points',
  churnScore: 'Churn score',
  rfmSegment: 'RFM segment',
  lifecycleStatus: 'Lifecycle status',
  vipLevel: 'VIP level',
  isCorporate: 'Is corporate',
  acquisitionChannel: 'Acquisition channel',
}

const COMPARATOR_LABELS: Record<string, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  in: 'in list',
  contains: 'contains',
}

export function emptyCondition(): SegmentCondition {
  return { field: 'totalSpend', cmp: 'gte', value: 0 }
}

export function emptyGroup(): SegmentRuleGroup {
  return { op: 'and', conditions: [emptyCondition()] }
}

function isGroup(
  node: SegmentCondition | SegmentRuleGroup,
): node is SegmentRuleGroup {
  return 'op' in node
}

function conditionValueToText(value: SegmentCondition['value']): string {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return String(value)
}

function textToConditionValue(
  field: string,
  cmp: string,
  text: string,
): SegmentCondition['value'] {
  if (cmp === 'in') {
    const parts = text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    return NUMERIC_FIELDS.has(field) ? parts.map(Number) : parts
  }
  if (BOOLEAN_FIELDS.has(field)) {
    return text === 'true'
  }
  if (NUMERIC_FIELDS.has(field)) {
    const numeric = Number(text)
    return Number.isNaN(numeric) ? 0 : numeric
  }
  return text
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: SegmentCondition
  onChange: (next: SegmentCondition) => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Field"
        className={fieldInputClassName + ' w-auto'}
        value={condition.field}
        onChange={(event) => {
          const field = event.target.value as SegmentCondition['field']
          onChange({
            field,
            cmp: condition.cmp,
            value: textToConditionValue(
              field,
              condition.cmp,
              conditionValueToText(condition.value),
            ),
          })
        }}
      >
        {SEGMENT_FIELDS.map((field) => (
          <option key={field} value={field}>
            {FIELD_LABELS[field] ?? field}
          </option>
        ))}
      </select>
      <select
        aria-label="Comparator"
        className={fieldInputClassName + ' w-auto'}
        value={condition.cmp}
        onChange={(event) => {
          const cmp = event.target.value as SegmentCondition['cmp']
          onChange({
            ...condition,
            cmp,
            value: textToConditionValue(
              condition.field,
              cmp,
              conditionValueToText(condition.value),
            ),
          })
        }}
      >
        {SEGMENT_COMPARATORS.map((cmp) => (
          <option key={cmp} value={cmp}>
            {COMPARATOR_LABELS[cmp] ?? cmp}
          </option>
        ))}
      </select>
      {BOOLEAN_FIELDS.has(condition.field) && condition.cmp !== 'in' ? (
        <select
          aria-label="Value"
          className={fieldInputClassName + ' w-auto'}
          value={String(condition.value)}
          onChange={(event) =>
            onChange({ ...condition, value: event.target.value === 'true' })
          }
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          aria-label="Value"
          className={fieldInputClassName + ' w-40'}
          value={conditionValueToText(condition.value)}
          placeholder={condition.cmp === 'in' ? 'a, b, c' : 'value'}
          onChange={(event) =>
            onChange({
              ...condition,
              value: textToConditionValue(
                condition.field,
                condition.cmp,
                event.target.value,
              ),
            })
          }
        />
      )}
      <Button type="button" size="xs" variant="ghost" onClick={onRemove}>
        Remove
      </Button>
    </div>
  )
}

export function SegmentRuleBuilder({
  group,
  onChange,
  onRemove,
  depth = 0,
}: {
  group: SegmentRuleGroup
  onChange: (next: SegmentRuleGroup) => void
  onRemove?: () => void
  depth?: number
}) {
  const replaceAt = (
    index: number,
    node: SegmentCondition | SegmentRuleGroup,
  ) => {
    onChange({
      ...group,
      conditions: group.conditions.map((current, currentIndex) =>
        currentIndex === index ? node : current,
      ),
    })
  }

  const removeAt = (index: number) => {
    onChange({
      ...group,
      conditions: group.conditions.filter(
        (_current, currentIndex) => currentIndex !== index,
      ),
    })
  }

  return (
    <div
      className={
        depth === 0
          ? 'flex flex-col gap-3'
          : 'ms-4 flex flex-col gap-3 rounded-lg border border-dashed border-border p-3'
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Group operator"
          className={fieldInputClassName + ' w-auto'}
          value={group.op}
          onChange={(event) =>
            onChange({ ...group, op: event.target.value as 'and' | 'or' })
          }
        >
          <option value="and">Match ALL (and)</option>
          <option value="or">Match ANY (or)</option>
        </select>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() =>
            onChange({
              ...group,
              conditions: [...group.conditions, emptyCondition()],
            })
          }
        >
          Add condition
        </Button>
        {depth < 2 ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() =>
              onChange({
                ...group,
                conditions: [...group.conditions, emptyGroup()],
              })
            }
          >
            Add nested group
          </Button>
        ) : null}
        {onRemove ? (
          <Button type="button" size="xs" variant="ghost" onClick={onRemove}>
            Remove group
          </Button>
        ) : null}
      </div>

      {group.conditions.map((node, index) =>
        isGroup(node) ? (
          <SegmentRuleBuilder
            key={index}
            group={node}
            depth={depth + 1}
            onChange={(next) => replaceAt(index, next)}
            onRemove={
              group.conditions.length > 1 ? () => removeAt(index) : undefined
            }
          />
        ) : (
          <ConditionRow
            key={index}
            condition={node}
            onChange={(next) => replaceAt(index, next)}
            onRemove={() => {
              if (group.conditions.length > 1) {
                removeAt(index)
              }
            }}
          />
        ),
      )}
    </div>
  )
}
