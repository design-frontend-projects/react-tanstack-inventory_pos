import { z } from 'zod'

// Zod schemas for the delivery dispatch server functions.

const decimalString = z
  .union([z.string(), z.number()])
  .transform((value) =>
    typeof value === 'number' ? value.toString() : value.trim(),
  )
  .refine(
    (value) => value.length > 0 && !Number.isNaN(Number(value)),
    'Must be a numeric value',
  )

export const driverCreateSchema = z.object({
  branchId: z.string().uuid().nullish(),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(3).max(40),
  vehicle: z.string().trim().max(100).nullish(),
})

export const driverStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['OFFLINE', 'AVAILABLE', 'ON_DELIVERY']),
})

export const zoneCreateSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  feeAmount: decimalString.optional(),
  etaMinutes: z.number().int().min(5).max(480).optional(),
})

export const deliveryCreateSchema = z.object({
  branchId: z.string().uuid(),
  orderId: z.string().uuid(),
  zoneId: z.string().uuid().nullish(),
  addressLine: z.string().trim().min(1).max(500),
  addressNotes: z.string().trim().max(500).nullish(),
})

export const deliveryAssignSchema = z.object({
  deliveryId: z.string().uuid(),
  driverId: z.string().uuid(),
})

export const deliveryTransitionSchema = z.object({
  deliveryId: z.string().uuid(),
  toStatus: z.enum(['PICKED_UP', 'EN_ROUTE', 'DELIVERED', 'FAILED']),
  reason: z.string().trim().max(500).nullish(),
  proofUrl: z.string().trim().url().max(500).nullish(),
})

export type DriverCreateInput = z.infer<typeof driverCreateSchema>
export type ZoneCreateInput = z.infer<typeof zoneCreateSchema>
export type DeliveryCreateInput = z.infer<typeof deliveryCreateSchema>
export type DeliveryAssignInput = z.infer<typeof deliveryAssignSchema>
export type DeliveryTransitionInput = z.infer<typeof deliveryTransitionSchema>
