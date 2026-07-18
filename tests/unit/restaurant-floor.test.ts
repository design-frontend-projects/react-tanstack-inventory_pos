import { describe, expect, it } from 'vitest'
import {
  floorAssignmentUpsertSchema,
  tableStatusSetSchema,
} from '#/features/restaurant/floor/validation'

const uuid = (suffix: string) => `00000000-0000-4000-8000-00000000000${suffix}`

const baseAssignment = {
  branchId: uuid('1'),
  diningAreaId: uuid('2'),
  profileId: uuid('3'),
}

describe('floor assignment validation', () => {
  it('accepts an area-level floor manager', () => {
    const result = floorAssignmentUpsertSchema.safeParse({
      ...baseAssignment,
      role: 'FLOOR_MANAGER',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a floor manager scoped to a section or table', () => {
    const withSection = floorAssignmentUpsertSchema.safeParse({
      ...baseAssignment,
      role: 'FLOOR_MANAGER',
      sectionId: uuid('4'),
    })
    expect(withSection.success).toBe(false)

    const withTable = floorAssignmentUpsertSchema.safeParse({
      ...baseAssignment,
      role: 'FLOOR_MANAGER',
      sectionId: uuid('4'),
      tableId: uuid('5'),
    })
    expect(withTable.success).toBe(false)
  })

  it('accepts waiters at area, section, and table scope', () => {
    expect(
      floorAssignmentUpsertSchema.safeParse({ ...baseAssignment, role: 'WAITER' })
        .success,
    ).toBe(true)
    expect(
      floorAssignmentUpsertSchema.safeParse({
        ...baseAssignment,
        role: 'WAITER',
        sectionId: uuid('4'),
      }).success,
    ).toBe(true)
    expect(
      floorAssignmentUpsertSchema.safeParse({
        ...baseAssignment,
        role: 'WAITER',
        sectionId: uuid('4'),
        tableId: uuid('5'),
      }).success,
    ).toBe(true)
  })

  it('rejects a table assignment without its section', () => {
    const result = floorAssignmentUpsertSchema.safeParse({
      ...baseAssignment,
      role: 'WAITER',
      tableId: uuid('5'),
    })
    expect(result.success).toBe(false)
  })
})

describe('manual table statuses', () => {
  it('never allows OCCUPIED to be set manually', () => {
    expect(tableStatusSetSchema.safeParse('AVAILABLE').success).toBe(true)
    expect(tableStatusSetSchema.safeParse('RESERVED').success).toBe(true)
    expect(tableStatusSetSchema.safeParse('BLOCKED').success).toBe(true)
    expect(tableStatusSetSchema.safeParse('OCCUPIED').success).toBe(false)
  })
})
