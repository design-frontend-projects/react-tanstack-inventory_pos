import { NotFoundError } from '#/server/auth/errors'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import type {
  Lot,
  LotStatus,
  Prisma,
  SerialStatus,
} from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as lotRepo from '#/server/repos/lot-repo'
import * as serialRepo from '#/server/repos/serial-repo'
import type { LotCreateInput } from '#/server/repos/lot-repo'
import type { SerialCreateInput } from '#/server/repos/serial-repo'
import type { PrismaClientLike } from '#/server/db/types'
import type { CurrentUserContext } from '#/types/auth'

// Batch (Lot) and serial masters. Quantities live in StockBalance; these carry
// identity, provenance, expiry, and lifecycle status. Used by receiving to
// materialize lots/serials, and by ops to quarantine / recall / expire / scrap.

function serializeLot(lot: Lot) {
  return { ...lot, initialQty: lot.initialQty.toString() }
}

// Find-or-create a lot for (product, lotNumber). Idempotent within a receipt so
// re-receiving the same lot number accumulates onto the same batch.
export async function ensureLot(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: LotCreateInput
): Promise<Lot> {
  const existing = await lotRepo.findLotByNumber(tenantId, input.productId, input.lotNumber, tx)

  if (existing) {
    return existing
  }

  return lotRepo.createLot(tenantId, input, tx)
}

export function createSerial(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: SerialCreateInput
) {
  return serialRepo.createSerial(tenantId, input, tx)
}

// FEFO candidate list: active lots for a product, nearest expiry first.
export async function pickFefo(
  _context: CurrentUserContext,
  tenantId: string,
  productId: string,
  client: PrismaClientLike = prisma
) {
  const lots = await lotRepo.listActiveLotsFefo(tenantId, productId, client)

  return lots.map(serializeLot)
}

// Transition a lot's lifecycle status (quarantine / release / recall / deplete),
// guarded by the `lot` state machine.
export async function setLotStatus(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  status: LotStatus
) {
  const lot = await lotRepo.findLotById(tenantId, id)

  if (!lot) {
    throw new NotFoundError('Lot not found.')
  }

  assertTransition('lot', lot.status.toLowerCase(), status.toLowerCase())
  await lotRepo.updateLotStatus(id, status)

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'inventory.lot_status',
    entityType: 'lot',
    entityId: id,
    newValues: { status: status.toLowerCase() },
  })

  const refreshed = await lotRepo.findLotById(tenantId, id)

  return serializeLot(refreshed!)
}

// Transition a serial's lifecycle status (quarantine → in_repair → scrapped …),
// guarded by the `serial` state machine.
export async function setSerialStatus(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  status: SerialStatus
) {
  const serial = await serialRepo.findSerialById(tenantId, id)

  if (!serial) {
    throw new NotFoundError('Serial number not found.')
  }

  assertTransition('serial', serial.status.toLowerCase(), status.toLowerCase())
  await serialRepo.updateSerialState(id, { status })

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'inventory.serial_status',
    entityType: 'serial_number',
    entityId: id,
    newValues: { status: status.toLowerCase() },
  })

  return serialRepo.findSerialById(tenantId, id)
}

// Batch sweep: flip any active/quarantined lot past its expiry to EXPIRED.
// Intended to be driven by a scheduled job. Balance disposition to the `expired`
// bucket is deferred (see tasks T096).
export async function expireLots(
  context: CurrentUserContext,
  tenantId: string,
  now: Date = new Date()
): Promise<{ expired: number }> {
  const expired = await prisma.$transaction(async (tx) => {
    const stale = await lotRepo.findExpiredLots(tenantId, now, 200, tx)

    for (const lot of stale) {
      if (!canTransitionLot(lot.status, 'expired')) {
        continue
      }

      await lotRepo.updateLotStatus(lot.id, 'EXPIRED', tx)
    }

    if (stale.length > 0) {
      await createAuditLog(
        {
          tenantId,
          actorProfileId: context.profileId,
          actorEmail: context.email,
          actionKey: 'inventory.lot_expire',
          entityType: 'lot',
          entityId: tenantId,
          newValues: { expired: stale.length },
        },
        tx
      )
    }

    return stale.length
  })

  return { expired }
}

function canTransitionLot(from: LotStatus, to: string): boolean {
  return from === 'ACTIVE' || from === 'QUARANTINE' ? to === 'expired' : false
}

export async function listLots(_context: CurrentUserContext, tenantId: string) {
  const lots = await lotRepo.listLots(tenantId, {})

  return lots.map(serializeLot)
}

export async function listSerials(_context: CurrentUserContext, tenantId: string) {
  return serialRepo.listSerials(tenantId, {})
}
