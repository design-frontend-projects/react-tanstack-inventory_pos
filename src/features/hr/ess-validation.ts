import { z } from 'zod'

// Zod schemas for the Employee Self-Service (ESS) server functions.

export const employeeRequestSchema = z.object({
  employeeId: z.string().uuid(),
  requestType: z.enum([
    'letter',
    'document',
    'data_change',
    'complaint',
    'inquiry',
    'other',
  ]),
  subject: z.string().min(1).max(200),
  details: z.string().max(2000).nullish(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
})

export const requestStatusSchema = z.object({
  statusCode: z.enum(['open', 'in_progress', 'resolved', 'closed', 'rejected']),
})

export const announcementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(4000).nullish(),
  category: z
    .enum(['general', 'policy', 'event', 'benefit', 'urgent'])
    .optional(),
  audience: z.enum(['all', 'department', 'managers']).optional(),
  departmentId: z.string().uuid().nullish(),
  isPinned: z.boolean().optional(),
})

export const announcementStatusSchema = z.object({
  statusCode: z.enum(['draft', 'published', 'archived']),
})

export type EmployeeRequestInput = z.infer<typeof employeeRequestSchema>
export type AnnouncementInput = z.infer<typeof announcementSchema>
