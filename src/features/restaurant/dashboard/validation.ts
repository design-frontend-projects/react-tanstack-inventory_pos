import { z } from 'zod'

// Shared range input for every reporting/analytics query. `from`/`to` are ISO
// datetimes computed client-side so day boundaries respect the user's locale.
export const reportingRangeSchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().datetime(),
  to: z.string().datetime(),
})

export type ReportingRangeInput = z.infer<typeof reportingRangeSchema>
