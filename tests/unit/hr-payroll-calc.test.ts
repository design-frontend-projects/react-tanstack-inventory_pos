import { describe, expect, it } from 'vitest'
import { computePayslip, prorate } from '#/server/hr/payroll-calc'

describe('computePayslip', () => {
  it('nets earnings against deductions', () => {
    const result = computePayslip([
      { componentCode: 'BASIC', componentName: 'Basic', componentType: 'earning', amount: 3000 },
      { componentCode: 'HRA', componentName: 'Housing', componentType: 'earning', amount: 500 },
      { componentCode: 'TAX', componentName: 'Tax', componentType: 'deduction', amount: 400 },
      { componentCode: 'LOAN', componentName: 'Loan', componentType: 'deduction', amount: 100 },
    ])
    expect(result.grossPay).toBe(3500)
    expect(result.totalDeductions).toBe(500)
    expect(result.netPay).toBe(3000)
  })

  it('excludes non-taxable earnings from taxable base', () => {
    const result = computePayslip([
      { componentCode: 'BASIC', componentName: 'Basic', componentType: 'earning', amount: 2000, isTaxable: true },
      { componentCode: 'MEAL', componentName: 'Meal', componentType: 'earning', amount: 300, isTaxable: false },
    ])
    expect(result.grossPay).toBe(2300)
    expect(result.taxableEarnings).toBe(2000)
  })

  it('handles an all-deduction (negative net) payslip', () => {
    const result = computePayslip([
      { componentCode: 'ADV', componentName: 'Advance recovery', componentType: 'deduction', amount: 50 },
    ])
    expect(result.grossPay).toBe(0)
    expect(result.netPay).toBe(-50)
  })
})

describe('prorate', () => {
  it('prorates by worked vs period days', () => {
    expect(prorate(3000, 15, 30)).toBe(1500)
  })

  it('returns the full amount when period days is zero', () => {
    expect(prorate(3000, 0, 0)).toBe(3000)
  })
})
