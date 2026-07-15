import { describe, expect, it } from 'vitest'
import {
  calculateEarnPoints,
  consumeLotsFifo,
  determineTier,
  validateRedemption,
} from '#/server/crm/loyalty-rules'
import { ValidationError } from '#/server/auth/errors'

const ACTIVE_SETTINGS = { pointsPerCurrencyUnit: '1', isActive: true }

describe('calculateEarnPoints', () => {
  it('earns base points = total × rate × tier multiplier, floored', () => {
    expect(calculateEarnPoints(ACTIVE_SETTINGS, '1', [], { grandTotal: '150.75' })).toBe(150)
    expect(calculateEarnPoints(ACTIVE_SETTINGS, '1.5', [], { grandTotal: '100' })).toBe(150)
    expect(
      calculateEarnPoints({ pointsPerCurrencyUnit: '0.5', isActive: true }, '1', [], {
        grandTotal: '99',
      })
    ).toBe(49)
  })

  it('earns nothing when the program is inactive or the total is zero', () => {
    expect(
      calculateEarnPoints({ ...ACTIVE_SETTINGS, isActive: false }, '1', [], {
        grandTotal: '100',
      })
    ).toBe(0)
    expect(calculateEarnPoints(ACTIVE_SETTINGS, '1', [], { grandTotal: '0' })).toBe(0)
  })

  it('applies category bonus multipliers only when a category matches', () => {
    const rule = {
      ruleType: 'CATEGORY_BONUS' as const,
      multiplier: '2',
      conditions: { categoryIds: ['cat-coffee'] },
      isActive: true,
    }

    expect(
      calculateEarnPoints(ACTIVE_SETTINGS, '1', [rule], {
        grandTotal: '100',
        categoryIds: ['cat-coffee'],
      })
    ).toBe(200)
    expect(
      calculateEarnPoints(ACTIVE_SETTINGS, '1', [rule], {
        grandTotal: '100',
        categoryIds: ['cat-tea'],
      })
    ).toBe(100)
  })

  it('adds fixed birthday bonuses on top of multiplied points', () => {
    const rule = {
      ruleType: 'BIRTHDAY' as const,
      fixedPoints: 500,
      isActive: true,
    }

    expect(
      calculateEarnPoints(ACTIVE_SETTINGS, '1', [rule], {
        grandTotal: '100',
        isBirthday: true,
      })
    ).toBe(600)
    expect(
      calculateEarnPoints(ACTIVE_SETTINGS, '1', [rule], {
        grandTotal: '100',
        isBirthday: false,
      })
    ).toBe(100)
  })

  it('respects rule validity windows', () => {
    const rule = {
      ruleType: 'BASE' as const,
      multiplier: '3',
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2026-01-31'),
    }

    expect(
      calculateEarnPoints(ACTIVE_SETTINGS, '1', [rule], {
        grandTotal: '100',
        at: new Date('2026-01-15'),
      })
    ).toBe(300)
    expect(
      calculateEarnPoints(ACTIVE_SETTINGS, '1', [rule], {
        grandTotal: '100',
        at: new Date('2026-02-15'),
      })
    ).toBe(100)
  })
})

describe('determineTier', () => {
  const TIERS = [
    { id: 'bronze', rank: 1, minLifetimePoints: 0 },
    { id: 'silver', rank: 2, minLifetimePoints: 1000 },
    { id: 'gold', rank: 3, minLifetimePoints: 5000 },
    { id: 'vip', rank: 5, minLifetimePoints: 20000 },
  ]

  it('picks the highest qualifying tier', () => {
    expect(determineTier(0, TIERS)?.id).toBe('bronze')
    expect(determineTier(1200, TIERS)?.id).toBe('silver')
    expect(determineTier(5000, TIERS)?.id).toBe('gold')
    expect(determineTier(100000, TIERS)?.id).toBe('vip')
  })

  it('returns null when no tier qualifies', () => {
    expect(determineTier(50, TIERS.slice(1))).toBeNull()
  })
})

describe('validateRedemption', () => {
  const SETTINGS = { redemptionValuePerPoint: '0.05', minRedeemPoints: 100, isActive: true }

  it('computes the redemption value', () => {
    expect(validateRedemption(SETTINGS, 1000, 200).valueAmount.toString()).toBe('10')
  })

  it('rejects overdraws, sub-minimum, and inactive programs', () => {
    expect(() => validateRedemption(SETTINGS, 150, 200)).toThrow(ValidationError)
    expect(() => validateRedemption(SETTINGS, 1000, 50)).toThrow(ValidationError)
    expect(() =>
      validateRedemption({ ...SETTINGS, isActive: false }, 1000, 200)
    ).toThrow(ValidationError)
    expect(() => validateRedemption(SETTINGS, 1000, -5)).toThrow(ValidationError)
  })
})

describe('consumeLotsFifo', () => {
  it('consumes oldest lots first', () => {
    const result = consumeLotsFifo(
      [
        { id: 'a', remainingPoints: 100 },
        { id: 'b', remainingPoints: 300 },
      ],
      250
    )

    expect(result).toEqual([
      { lotId: 'a', consumed: 100, remainingAfter: 0 },
      { lotId: 'b', consumed: 150, remainingAfter: 150 },
    ])
  })

  it('skips empty lots and throws when coverage is impossible', () => {
    expect(
      consumeLotsFifo(
        [
          { id: 'a', remainingPoints: 0 },
          { id: 'b', remainingPoints: 50 },
        ],
        50
      )
    ).toEqual([{ lotId: 'b', consumed: 50, remainingAfter: 0 }])

    expect(() => consumeLotsFifo([{ id: 'a', remainingPoints: 10 }], 50)).toThrow(
      ValidationError
    )
  })

  it('is exact: total consumed equals the request (ledger-sum == balance invariant)', () => {
    const lots = [
      { id: 'a', remainingPoints: 120 },
      { id: 'b', remainingPoints: 80 },
      { id: 'c', remainingPoints: 200 },
    ]
    const result = consumeLotsFifo(lots, 400)
    const consumed = result.reduce((sum, item) => sum + item.consumed, 0)

    expect(consumed).toBe(400)
  })
})
