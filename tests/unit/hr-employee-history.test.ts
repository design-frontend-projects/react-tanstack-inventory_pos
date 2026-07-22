import { describe, expect, it } from 'vitest'
import {
  TRACKED_FIELDS,
  computeHistoryEntries,
} from '#/server/hr/employee-history'

// BR-EMP-1: every material change to an employee appends a history row. These
// tests pin the pure change-detection that drives that invariant.

const base = {
  departmentId: 'dept-1',
  positionId: 'pos-1',
  jobGradeId: 'grade-1',
  managerId: 'mgr-1',
  branchId: 'branch-1',
  costCenterId: 'cc-1',
  employmentStatus: 'active',
  employmentType: 'full_time',
  workLocation: 'HQ',
  firstName: 'Sam',
}

describe('computeHistoryEntries', () => {
  it('returns no entries when nothing tracked changed', () => {
    expect(computeHistoryEntries(base, { firstName: 'Samuel' })).toHaveLength(0)
  })

  it('records a transfer when the department changes', () => {
    const entries = computeHistoryEntries(base, { departmentId: 'dept-2' })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      changeType: 'transfer',
      fieldName: 'department',
      oldValue: 'dept-1',
      newValue: 'dept-2',
    })
  })

  it('records a status change with the new status', () => {
    const entries = computeHistoryEntries(base, {
      employmentStatus: 'terminated',
    })
    expect(entries[0]).toMatchObject({
      changeType: 'status_change',
      oldValue: 'active',
      newValue: 'terminated',
    })
  })

  it('emits one entry per changed tracked field', () => {
    const entries = computeHistoryEntries(base, {
      departmentId: 'dept-2',
      positionId: 'pos-2',
      employmentStatus: 'on_leave',
    })
    expect(entries).toHaveLength(3)
  })

  it('does not record a no-op change to the same value', () => {
    expect(
      computeHistoryEntries(base, { departmentId: 'dept-1' }),
    ).toHaveLength(0)
  })

  it('captures a transition from null to a value', () => {
    const entries = computeHistoryEntries(
      { ...base, managerId: null },
      { managerId: 'mgr-9' },
    )
    expect(entries[0]).toMatchObject({
      fieldName: 'manager',
      oldValue: null,
      newValue: 'mgr-9',
    })
  })

  it('tracks the documented set of fields', () => {
    expect(TRACKED_FIELDS.map((f) => f.key)).toContain('departmentId')
    expect(TRACKED_FIELDS.map((f) => f.key)).toContain('employmentStatus')
  })
})
