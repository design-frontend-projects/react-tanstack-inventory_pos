// Pure payroll math — no I/O — so it is unit-testable. A payslip is the sum of
// its earning and deduction component lines; net = gross earnings − deductions.
// Payroll never stores a duplicated salary figure: every payslip line is derived
// from a component (contract base, assigned components, overtime, loan recovery).

export interface PayComponentLine {
  componentCode: string
  componentName: string
  componentType: string // 'earning' | 'deduction'
  amount: number
  isTaxable?: boolean
}

export interface PayslipTotals {
  grossPay: number
  totalEarnings: number
  totalDeductions: number
  netPay: number
  taxableEarnings: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function computePayslip(
  lines: ReadonlyArray<PayComponentLine>,
): PayslipTotals {
  let earnings = 0
  let deductions = 0
  let taxable = 0

  for (const line of lines) {
    if (line.componentType === 'deduction') {
      deductions += line.amount
    } else {
      earnings += line.amount
      if (line.isTaxable !== false) {
        taxable += line.amount
      }
    }
  }

  const grossPay = round2(earnings)
  const totalDeductions = round2(deductions)
  return {
    grossPay,
    totalEarnings: grossPay,
    totalDeductions,
    netPay: round2(grossPay - totalDeductions),
    taxableEarnings: round2(taxable),
  }
}

// Prorates a monthly amount by worked vs. period days (e.g. mid-month joiners).
export function prorate(
  monthlyAmount: number,
  workedDays: number,
  periodDays: number,
): number {
  if (periodDays <= 0) return round2(monthlyAmount)
  return round2((monthlyAmount * workedDays) / periodDays)
}
