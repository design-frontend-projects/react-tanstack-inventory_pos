import { z } from 'zod'

// Zod schemas for events, party bookings, and catering jobs.

const decimalString = z
  .union([z.string(), z.number()])
  .transform((value) =>
    typeof value === 'number' ? value.toString() : value.trim(),
  )
  .refine(
    (value) => value.length > 0 && !Number.isNaN(Number(value)),
    'Must be a numeric value',
  )

export const eventKindSchema = z.enum([
  'BIRTHDAY',
  'CORPORATE',
  'WEDDING',
  'FAMILY',
  'GRADUATION',
  'VIP',
  'HOLIDAY',
  'PRIVATE',
])

export const eventStatusSchema = z.enum([
  'INQUIRY',
  'QUOTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
])

export const eventCreateSchema = z.object({
  branchId: z.string().uuid(),
  kind: eventKindSchema,
  name: z.string().trim().min(1).max(200),
  customerId: z.string().uuid().nullish(),
  hallId: z.string().uuid().nullish(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  guestCount: z.number().int().min(1).max(10000).optional(),
  packageJson: z.record(z.string(), z.unknown()).optional(),
  quoteAmount: decimalString.optional(),
  notes: z.string().trim().max(2000).nullish(),
})

export const eventListSchema = z.object({
  branchId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: eventStatusSchema.optional(),
})

export const eventTransitionSchema = z.object({
  id: z.string().uuid(),
  toStatus: z.enum([
    'QUOTED',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
  ]),
})

export const eventTaskStatusSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(['TODO', 'DOING', 'DONE']),
})

export const eventPaymentSchema = z.object({
  eventId: z.string().uuid(),
  kind: z.enum(['DEPOSIT', 'INSTALLMENT', 'FINAL', 'REFUND']),
  amount: decimalString,
  method: z.string().trim().max(40).optional(),
  reference: z.string().trim().max(200).nullish(),
})

export const partySaveSchema = z.object({
  eventId: z.string().uuid(),
  theme: z.string().trim().max(200).nullish(),
  seatingJson: z.unknown().optional(),
  decorationsJson: z.unknown().optional(),
  costAmount: decimalString.optional(),
  revenueAmount: decimalString.optional(),
})

export const cateringKindSchema = z.enum(['CORPORATE', 'DELIVERY', 'OUTSIDE'])

export const cateringCreateSchema = z.object({
  branchId: z.string().uuid(),
  kind: cateringKindSchema,
  name: z.string().trim().min(1).max(200),
  customerId: z.string().uuid().nullish(),
  eventDate: z.string().datetime(),
  addressLine: z.string().trim().max(500).nullish(),
  guestCount: z.number().int().min(1).max(10000).optional(),
  quoteAmount: decimalString.optional(),
  costAmount: decimalString.optional(),
  notes: z.string().trim().max(2000).nullish(),
})

export const cateringTransitionSchema = z.object({
  id: z.string().uuid(),
  toStatus: z.enum([
    'CONFIRMED',
    'PREPPING',
    'DISPATCHED',
    'COMPLETED',
    'CANCELLED',
  ]),
})

export type EventCreateInput = z.infer<typeof eventCreateSchema>
export type EventListInput = z.infer<typeof eventListSchema>
export type EventTransitionInput = z.infer<typeof eventTransitionSchema>
export type EventTaskStatusInput = z.infer<typeof eventTaskStatusSchema>
export type EventPaymentInput = z.infer<typeof eventPaymentSchema>
export type PartySaveInput = z.infer<typeof partySaveSchema>
export type CateringCreateInput = z.infer<typeof cateringCreateSchema>
export type CateringTransitionInput = z.infer<typeof cateringTransitionSchema>
