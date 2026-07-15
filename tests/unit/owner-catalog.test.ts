import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_OPTION_CODES,
  ACTIVITY_OPTION_DEFINITIONS,
  SUBSCRIPTION_PLAN_DEFINITIONS,
} from '#/features/owner/owner-catalog'

describe('owner catalog', () => {
  it('exposes unique activity option codes', () => {
    const codes = ACTIVITY_OPTION_DEFINITIONS.map((definition) => definition.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(ACTIVITY_OPTION_CODES).toEqual(codes)
  })

  it('exposes unique subscription plan codes', () => {
    const codes = SUBSCRIPTION_PLAN_DEFINITIONS.map((plan) => plan.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('defines exactly one default subscription plan', () => {
    const defaults = SUBSCRIPTION_PLAN_DEFINITIONS.filter((plan) => plan.isDefault)
    expect(defaults).toHaveLength(1)
  })

  it('keeps feature codes unique within each plan', () => {
    for (const plan of SUBSCRIPTION_PLAN_DEFINITIONS) {
      const featureCodes = plan.features.map((feature) => feature.code)
      expect(new Set(featureCodes).size).toBe(featureCodes.length)
    }
  })
})
