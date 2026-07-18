import { z } from 'zod'

// Manual table statuses only — OCCUPIED is derived from the active order and is
// never written directly.
export const tableStatusSetSchema = z.enum(['AVAILABLE', 'RESERVED', 'BLOCKED'])

export const floorStaffRoleSchema = z.enum(['FLOOR_MANAGER', 'WAITER'])

export const diningAreaUpdateSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const tableSectionUpdateSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const tableUpdateSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  seats: z.number().int().min(1).max(100).optional(),
  minCapacity: z.number().int().min(1).max(100).nullish(),
  shape: z.string().trim().max(40).nullish(),
  isActive: z.boolean().optional(),
})

export const floorAssignmentUpsertSchema = z
  .object({
    branchId: z.string().uuid(),
    diningAreaId: z.string().uuid(),
    sectionId: z.string().uuid().nullish(),
    tableId: z.string().uuid().nullish(),
    profileId: z.string().uuid(),
    role: floorStaffRoleSchema,
  })
  .superRefine((value, ctx) => {
    if (value.role === 'FLOOR_MANAGER' && (value.sectionId || value.tableId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Floor managers are assigned to a whole dining area',
      })
    }
    if (value.tableId && !value.sectionId) {
      ctx.addIssue({
        code: 'custom',
        message: 'A table-level assignment must include its section',
      })
    }
  })

export type DiningAreaUpdateInput = z.infer<typeof diningAreaUpdateSchema>
export type TableSectionUpdateInput = z.infer<typeof tableSectionUpdateSchema>
export type TableUpdateInput = z.infer<typeof tableUpdateSchema>
export type FloorAssignmentUpsertInput = z.infer<typeof floorAssignmentUpsertSchema>
export type TableStatusSetValue = z.infer<typeof tableStatusSetSchema>
