import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for time & attendance: shift definitions, raw
// attendance logs (punches), the calculated daily attendance, and overtime.

const activeWhere = (tenantId: string, includeInactive: boolean) => ({
  tenantId,
  deletedAt: null,
  ...(includeInactive ? {} : { isActive: true }),
})

// --- Shift definitions ------------------------------------------------------

export interface ShiftWriteInput {
  code: string
  name: string
  nameAr?: string | null
  shiftType?: string
  startTime?: string | null
  endTime?: string | null
  breakMinutes?: number
  workHours?: string | number | null
  isNightShift?: boolean
  graceInMins?: number
  graceOutMins?: number
  isActive?: boolean
}

export function listShifts(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrShiftDefinition.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: { name: 'asc' },
  })
}

export function findShiftById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrShiftDefinition.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createShift(
  tenantId: string,
  input: ShiftWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrShiftDefinition.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      shiftType: input.shiftType ?? 'fixed',
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      breakMinutes: input.breakMinutes ?? 0,
      workHours: input.workHours ?? null,
      isNightShift: input.isNightShift ?? false,
      graceInMins: input.graceInMins ?? 0,
      graceOutMins: input.graceOutMins ?? 0,
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateShift(
  tenantId: string,
  id: string,
  input: Partial<ShiftWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrShiftDefinition.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.shiftType !== undefined ? { shiftType: input.shiftType } : {}),
      ...(input.startTime !== undefined
        ? { startTime: input.startTime ?? null }
        : {}),
      ...(input.endTime !== undefined
        ? { endTime: input.endTime ?? null }
        : {}),
      ...(input.breakMinutes !== undefined
        ? { breakMinutes: input.breakMinutes }
        : {}),
      ...(input.workHours !== undefined
        ? { workHours: input.workHours ?? null }
        : {}),
      ...(input.isNightShift !== undefined
        ? { isNightShift: input.isNightShift }
        : {}),
      ...(input.graceInMins !== undefined
        ? { graceInMins: input.graceInMins }
        : {}),
      ...(input.graceOutMins !== undefined
        ? { graceOutMins: input.graceOutMins }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findShiftById(tenantId, id, client)
}

export async function softDeleteShift(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrShiftDefinition.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })
  return result.count > 0
}

// --- Attendance logs (punches) ----------------------------------------------

export interface PunchInput {
  employeeId: string
  eventTime: Date
  direction: string
  captureMethod?: string
  deviceId?: string | null
  latitude?: string | number | null
  longitude?: string | number | null
}

export function createPunch(
  tenantId: string,
  input: PunchInput,
  client: PrismaClientLike = prisma,
) {
  return client.hrAttendanceLog.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      eventTime: input.eventTime,
      direction: input.direction,
      captureMethod: input.captureMethod ?? 'manual',
      deviceId: input.deviceId ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    },
  })
}

export function listPunchesForDay(
  tenantId: string,
  employeeId: string,
  dayStart: Date,
  dayEnd: Date,
  client: PrismaClientLike = prisma,
) {
  return client.hrAttendanceLog.findMany({
    where: {
      tenantId,
      employeeId,
      eventTime: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { eventTime: 'asc' },
  })
}

// --- Daily attendance -------------------------------------------------------

export interface DailyUpsertInput {
  employeeId: string
  workDate: Date
  shiftId?: string | null
  firstIn?: Date | null
  lastOut?: Date | null
  workedHours: number
  overtimeHours: number
  lateMinutes: number
  earlyOutMins: number
  attendanceCode: string
}

export async function upsertDaily(
  tenantId: string,
  input: DailyUpsertInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const existing = await client.hrAttendanceDaily.findFirst({
    where: { tenantId, employeeId: input.employeeId, workDate: input.workDate },
  })
  const data = {
    shiftId: input.shiftId ?? null,
    firstIn: input.firstIn ?? null,
    lastOut: input.lastOut ?? null,
    workedHours: input.workedHours,
    overtimeHours: input.overtimeHours,
    lateMinutes: input.lateMinutes,
    earlyOutMins: input.earlyOutMins,
    attendanceCode: input.attendanceCode,
    updatedBy: actorId,
  }
  if (existing) {
    return client.hrAttendanceDaily.update({ where: { id: existing.id }, data })
  }
  return client.hrAttendanceDaily.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      workDate: input.workDate,
      createdBy: actorId,
      ...data,
    },
  })
}

export function listDaily(
  tenantId: string,
  filters: { employeeId?: string; from?: Date; to?: Date } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrAttendanceDaily.findMany({
    where: {
      tenantId,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.from || filters.to
        ? {
            workDate: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ workDate: 'desc' }],
    take: 500,
  })
}

// --- Overtime requests ------------------------------------------------------

export interface OvertimeWriteInput {
  employeeId: string
  requestNumber: string
  overtimeDate: Date
  startTime?: string | null
  endTime?: string | null
  hours: string | number
  rateMultiplier?: string | number
  reason?: string | null
  statusCode?: string
}

export function listOvertime(
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrOvertimeRequest.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.statusCode ? { statusCode: filters.statusCode } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
}

export function createOvertime(
  tenantId: string,
  input: OvertimeWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrOvertimeRequest.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      requestNumber: input.requestNumber,
      overtimeDate: input.overtimeDate,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      hours: input.hours,
      rateMultiplier: input.rateMultiplier ?? 1.5,
      reason: input.reason ?? null,
      statusCode: input.statusCode ?? 'submitted',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export function updateOvertimeStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrOvertimeRequest.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { statusCode, updatedBy: actorId },
  })
}

export function findOvertimeById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrOvertimeRequest.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}
