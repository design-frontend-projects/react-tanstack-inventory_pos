import { NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import type { CurrentUserContext } from '#/types/auth'

// Polymorphic attachment METADATA for purchasing documents. The binary itself
// lives in object storage (Supabase bucket) — the client uploads there and
// registers the resulting URL here, scoped to a document.

export interface RegisterAttachmentInput {
  entityType: string
  entityId: string
  fileName: string
  fileUrl: string
  mimeType?: string | null
  fileSize?: number | null
  category?: string | null
}

export async function registerAttachment(
  context: CurrentUserContext,
  tenantId: string,
  input: RegisterAttachmentInput,
) {
  const attachment = await prisma.podAttachment.create({
    data: {
      tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      mimeType: input.mimeType ?? null,
      fileSize: input.fileSize ?? null,
      category: input.category ?? null,
      uploadedByProfileId: context.profileId,
    },
  })

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'purchase.attachment_add',
    entityType: input.entityType,
    entityId: input.entityId,
    newValues: { fileName: input.fileName },
  })

  return attachment
}

export function listAttachments(
  _context: CurrentUserContext,
  tenantId: string,
  entityType: string,
  entityId: string,
) {
  return prisma.podAttachment.findMany({
    where: { tenantId, entityType, entityId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}

export async function deleteAttachment(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const result = await prisma.podAttachment.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date() },
  })

  if (result.count === 0) {
    throw new NotFoundError('Attachment not found.')
  }

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'purchase.attachment_delete',
    entityType: 'pod_attachment',
    entityId: id,
  })

  return { id }
}
