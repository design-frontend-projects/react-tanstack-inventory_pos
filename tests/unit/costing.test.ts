import { describe, expect, it } from 'vitest'
import { Prisma } from '#/server/db/generated/prisma/client'
import {
  applyIssue,
  applyMovement,
  applyReceipt,
} from '#/server/inventory/costing'
import type { CostState } from '#/server/inventory/costing'

const D = (v: string | number) => new Prisma.Decimal(v)

function state(onHand: string, avg: string, total: string): CostState {
  return { onHand: D(onHand), avgUnitCost: D(avg), totalValue: D(total) }
}

describe('moving weighted-average costing', () => {
  it('averages cost across two receipts (10@2 + 10@4 => avg 3)', () => {
    let s = state('0', '0', '0')
    s = applyReceipt(s, '10', '2')
    expect(s.onHand.toString()).toBe('10')
    expect(s.avgUnitCost.toString()).toBe('2')
    expect(s.totalValue.toString()).toBe('20')

    s = applyReceipt(s, '10', '4')
    expect(s.onHand.toString()).toBe('20')
    expect(s.avgUnitCost.toString()).toBe('3')
    expect(s.totalValue.toString()).toBe('60')
  })

  it('issues at the current average without changing it (issue 5 => onHand 15, avg 3)', () => {
    let s = state('20', '3', '60')
    const { state: next, issueUnitCost } = applyIssue(s, '5')
    s = next
    expect(issueUnitCost.toString()).toBe('3')
    expect(s.onHand.toString()).toBe('15')
    expect(s.avgUnitCost.toString()).toBe('3')
    expect(s.totalValue.toString()).toBe('45')
  })

  it('resets average and value to zero when on-hand reaches exactly zero', () => {
    const { state: s } = applyIssue(state('5', '7', '35'), '5')
    expect(s.onHand.toString()).toBe('0')
    expect(s.avgUnitCost.toString()).toBe('0')
    expect(s.totalValue.toString()).toBe('0')
  })

  it('maintains the invariant totalValue == onHand * avgUnitCost after receipts', () => {
    let s = state('0', '0', '0')
    s = applyReceipt(s, '3', '2.5')
    s = applyReceipt(s, '7', '5')
    // (3*2.5 + 7*5) = 42.5 over 10 => avg 4.25
    expect(s.onHand.toString()).toBe('10')
    expect(s.avgUnitCost.toString()).toBe('4.25')
    expect(s.totalValue.toString()).toBe('42.5')
    expect(s.onHand.times(s.avgUnitCost).toString()).toBe(s.totalValue.toString())
  })

  it('applyMovement handles IN with explicit cost and OUT at average', () => {
    const inResult = applyMovement(state('0', '0', '0'), 'IN', '4', '5')
    expect(inResult.movementUnitCost.toString()).toBe('5')
    expect(inResult.state.avgUnitCost.toString()).toBe('5')

    const outResult = applyMovement(inResult.state, 'OUT', '1', null)
    expect(outResult.movementUnitCost.toString()).toBe('5')
    expect(outResult.state.onHand.toString()).toBe('3')
    expect(outResult.state.avgUnitCost.toString()).toBe('5')
  })
})
