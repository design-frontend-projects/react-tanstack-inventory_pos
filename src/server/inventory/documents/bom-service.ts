import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { serializeBom } from '#/server/inventory/manufacturing-dto'
import { prisma } from '#/server/db/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as bomRepo from '#/server/repos/bom-repo'
import type { BomCreateInput } from '#/server/repos/bom-repo'
import type { CurrentUserContext } from '#/types/auth'

export async function createBom(
  context: CurrentUserContext,
  tenantId: string,
  input: BomCreateInput
) {
  if (input.components.length === 0) {
    throw new ConflictError('A bill of materials requires at least one component.')
  }

  const bom = await prisma.$transaction(async (tx) => {
    const created = await bomRepo.createBom(tenantId, input, tx)

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'production.bom_create',
        entityType: 'bill_of_materials',
        entityId: created.id,
        newValues: { name: input.name, productId: input.productId },
      },
      tx
    )

    return created
  })

  return serializeBom(bom)
}

export async function listBoms(_context: CurrentUserContext, tenantId: string) {
  const boms = await bomRepo.listBoms(tenantId, {})

  return boms.map(serializeBom)
}

export async function getBom(_context: CurrentUserContext, tenantId: string, id: string) {
  const bom = await bomRepo.findBomById(tenantId, id)

  if (!bom) {
    throw new NotFoundError('Bill of materials not found.')
  }

  return serializeBom(bom)
}
