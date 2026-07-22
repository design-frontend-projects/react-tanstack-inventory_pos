import { describe, expect, it } from 'vitest'
import {
  companyWriteSchema,
  departmentWriteSchema,
  employeeCreateSchema,
  jobGradeWriteSchema,
} from '#/features/hr/validation'

// Boundary validation for the HR server-function inputs. The server trusts
// nothing from the client — these schemas are the gate.

describe('companyWriteSchema', () => {
  it('accepts a minimal valid company', () => {
    const result = companyWriteSchema.safeParse({
      code: 'ACME',
      name: 'Acme Inc',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty code', () => {
    const result = companyWriteSchema.safeParse({ code: '', name: 'Acme' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-3-letter currency', () => {
    const result = companyWriteSchema.safeParse({
      code: 'ACME',
      name: 'Acme',
      currencyCode: 'DOLLARS',
    })
    expect(result.success).toBe(false)
  })
})

describe('departmentWriteSchema', () => {
  it('requires a companyId', () => {
    const result = departmentWriteSchema.safeParse({
      code: 'ENG',
      name: 'Engineering',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid department with a parent', () => {
    const result = departmentWriteSchema.safeParse({
      companyId: '11111111-1111-4111-8111-111111111111',
      parentDepartmentId: '22222222-2222-4222-8222-222222222222',
      code: 'ENG',
      name: 'Engineering',
    })
    expect(result.success).toBe(true)
  })
})

describe('jobGradeWriteSchema', () => {
  it('accepts numeric-string salaries', () => {
    const result = jobGradeWriteSchema.safeParse({
      code: 'G1',
      name: 'Grade 1',
      minSalary: '1000.50',
      maxSalary: 2000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-numeric salary string', () => {
    const result = jobGradeWriteSchema.safeParse({
      code: 'G1',
      name: 'Grade 1',
      minSalary: 'a lot',
    })
    expect(result.success).toBe(false)
  })
})

describe('employeeCreateSchema', () => {
  it('accepts a minimal valid employee and coerces the hire date', () => {
    const result = employeeCreateSchema.safeParse({
      employeeCode: 'E-001',
      firstName: 'Sam',
      lastName: 'Rivera',
      hireDate: '2026-01-15',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.hireDate).toBeInstanceOf(Date)
    }
  })

  it('rejects an invalid employment status', () => {
    const result = employeeCreateSchema.safeParse({
      employeeCode: 'E-001',
      firstName: 'Sam',
      lastName: 'Rivera',
      employmentStatus: 'retired',
    })
    expect(result.success).toBe(false)
  })

  it('requires first and last name', () => {
    const result = employeeCreateSchema.safeParse({
      employeeCode: 'E-001',
      firstName: '',
      lastName: '',
    })
    expect(result.success).toBe(false)
  })
})
