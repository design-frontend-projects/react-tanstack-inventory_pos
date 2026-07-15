import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { serializePosSession } from '#/server/inventory/sales-dto'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as sessionRepo from '#/server/repos/pos-session-repo'
import type { CurrentUserContext } from '#/types/auth'

export interface OpenSessionInput {
  registerId: string
  warehouseId?: string | null
  openingFloat?: Prisma.Decimal | string | number
}

export async function openSession(
  context: CurrentUserContext,
  tenantId: string,
  input: OpenSessionInput
) {
  const session = await sessionRepo.createSession(tenantId, {
    registerId: input.registerId,
    cashierProfileId: context.profileId,
    warehouseId: input.warehouseId ?? null,
    openingFloat: input.openingFloat ?? 0,
  })

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'pos.session_open',
    entityType: 'pos_session',
    entityId: session.id,
  })

  return serializePosSession(session)
}

// Reconcile the drawer: expected cash = opening float + cash taken on completed
// sales in the session; variance = counted closing cash − expected.
export async function closeSession(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: { closingCash: Prisma.Decimal | string | number }
) {
  const closed = await prisma.$transaction(async (tx) => {
    const session = await sessionRepo.findSessionById(tenantId, id, tx)

    if (!session) {
      throw new NotFoundError('Session not found.')
    }

    if (session.status !== 'OPEN') {
      throw new ConflictError('Session is not open.')
    }

    const cashTaken = await tx.posPayment.aggregate({
      where: {
        tenantId,
        method: 'CASH',
        posSale: { posSessionId: id, status: 'COMPLETED' },
      },
      _sum: { amount: true },
    })

    const openingFloat = new Prisma.Decimal(session.openingFloat)
    const expectedCash = openingFloat.plus(cashTaken._sum.amount ?? new Prisma.Decimal(0))
    const closingCash = new Prisma.Decimal(input.closingCash)
    const variance = closingCash.minus(expectedCash)

    await sessionRepo.closeSession(tenantId, id, { closingCash, expectedCash, variance }, tx)

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'pos.session_close',
        entityType: 'pos_session',
        entityId: id,
        newValues: { expectedCash: expectedCash.toString(), variance: variance.toString() },
      },
      tx
    )

    const refreshed = await sessionRepo.findSessionById(tenantId, id, tx)

    return refreshed!
  })

  return serializePosSession(closed)
}

export function listSessions(_context: CurrentUserContext, tenantId: string) {
  return sessionRepo.listSessions(tenantId, {}).then((rows) => rows.map(serializePosSession))
}

export async function getSession(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const session = await sessionRepo.findSessionById(tenantId, id)

  if (!session) {
    throw new NotFoundError('Session not found.')
  }

  return serializePosSession(session)
}
