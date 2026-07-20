import { z } from 'zod'

// Zod schemas for the guest & front-desk server functions (reservations,
// waitlist, takeaway pickups, QR campaigns).

const decimalString = z
  .union([z.string(), z.number()])
  .transform((value) =>
    typeof value === 'number' ? value.toString() : value.trim(),
  )
  .refine(
    (value) => value.length > 0 && !Number.isNaN(Number(value)),
    'Must be a numeric value',
  )

export const reservationStatusSchema = z.enum([
  'REQUESTED',
  'CONFIRMED',
  'SEATED',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
])

export const reservationCreateSchema = z.object({
  branchId: z.string().uuid(),
  guestName: z.string().trim().min(1).max(200),
  guestPhone: z.string().trim().max(40).nullish(),
  customerId: z.string().uuid().nullish(),
  partySize: z.number().int().min(1).max(200).optional(),
  requestedAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(720).optional(),
  source: z.enum(['PHONE', 'WALK_IN', 'QR', 'ONLINE']).optional(),
  depositAmount: decimalString.nullish(),
  notes: z.string().trim().max(1000).nullish(),
  tableIds: z.array(z.string().uuid()).max(10).optional(),
})

export const reservationListSchema = z.object({
  branchId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: reservationStatusSchema.optional(),
})

export const reservationTransitionSchema = z.object({
  id: z.string().uuid(),
  toStatus: z.enum(['CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED']),
  reason: z.string().trim().max(500).nullish(),
})

export const reservationSeatSchema = z.object({
  id: z.string().uuid(),
  tableIds: z.array(z.string().uuid()).min(1).max(10),
  openOrder: z.boolean().optional(),
})

export const waitlistCreateSchema = z.object({
  branchId: z.string().uuid(),
  guestName: z.string().trim().min(1).max(200),
  guestPhone: z.string().trim().max(40).nullish(),
  partySize: z.number().int().min(1).max(100).optional(),
  priority: z.enum(['NORMAL', 'FAMILY', 'VIP']).optional(),
  quotedMinutes: z.number().int().min(0).max(480).optional(),
  notes: z.string().trim().max(500).nullish(),
})

export const waitlistStatusSchema = z.object({
  id: z.string().uuid(),
  toStatus: z.enum(['NOTIFIED', 'SEATED', 'LEFT']),
})

export const pickupCreateSchema = z.object({
  branchId: z.string().uuid(),
  orderId: z.string().uuid(),
  promisedAt: z.string().datetime(),
  counter: z.string().trim().max(40).nullish(),
})

export const pickupStampSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['PACKED', 'NOTIFIED', 'PICKED_UP']),
  verificationCode: z.string().trim().max(10).nullish(),
})

export const qrCampaignCreateSchema = z.object({
  branchId: z.string().uuid().nullish(),
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, digits, and dashes only'),
  target: z.enum(['TABLE', 'MENU', 'CAMPAIGN']).optional(),
  tableId: z.string().uuid().nullish(),
  menuId: z.string().uuid().nullish(),
  targetUrl: z.string().trim().url().max(500).nullish(),
  expiresAt: z.string().datetime().nullish(),
})

export const qrCampaignActiveSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
})

export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>
export type ReservationListInput = z.infer<typeof reservationListSchema>
export type ReservationTransitionInput = z.infer<
  typeof reservationTransitionSchema
>
export type ReservationSeatInput = z.infer<typeof reservationSeatSchema>
export type WaitlistCreateInput = z.infer<typeof waitlistCreateSchema>
export type WaitlistStatusInput = z.infer<typeof waitlistStatusSchema>
export type PickupCreateInput = z.infer<typeof pickupCreateSchema>
export type PickupStampInput = z.infer<typeof pickupStampSchema>
export type QrCampaignCreateInput = z.infer<typeof qrCampaignCreateSchema>
