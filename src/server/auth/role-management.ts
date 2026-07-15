import type { CurrentUserContext } from '#/types/auth'
import type {
  CreateRoleInput,
  RoleManagementPayload,
  SecurityPermissionKind,
  UpdateRoleInput,
} from '#/types/security'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '#/server/auth/errors'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import {
  findPermissionsByCodes,
  listPermissions,
} from '#/server/repos/permission-repo'
import {
  countTenantUsersWithRole,
  createTenantRole,
  findTenantRoleById,
  findTenantRoleByCode,
  getRoleAssignmentCounts,
  getTenantUserMaxRoleRank,
  listManageableRoles,
  setRolePermissions,
  softDeleteTenantRole,
  updateTenantRole,
} from '#/server/repos/role-repo'

const MIN_ROLE_RANK = 1
const MAX_ROLE_RANK = 200

function assertTenantMatch(actor: CurrentUserContext, tenantId: string) {
  if (actor.activeTenantId !== tenantId) {
    throw new ForbiddenError('Tenant mismatch for role management.')
  }
}

async function resolveActorRank(actor: CurrentUserContext) {
  if (!actor.tenantUserId) {
    throw new ForbiddenError('Tenant membership is required.')
  }

  return getTenantUserMaxRoleRank(actor.tenantUserId)
}

function slugifyRoleCode(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `custom:${slug || 'role'}`
}

// Actors may only grant permissions they themselves hold (prevents privilege
// escalation via role composition). Returns the resolved permission ids.
async function resolveGrantablePermissionIds(
  actor: CurrentUserContext,
  permissionCodes: Array<string>
) {
  const uniqueCodes = Array.from(new Set(permissionCodes))
  const actorPermissions = new Set(actor.permissions)
  const disallowed = uniqueCodes.filter((code) => !actorPermissions.has(code))

  if (disallowed.length > 0) {
    throw new ForbiddenError(
      `You cannot grant permissions you do not hold: ${disallowed.join(', ')}`
    )
  }

  const permissions = await findPermissionsByCodes(uniqueCodes)

  if (permissions.length !== uniqueCodes.length) {
    throw new ValidationError('One or more selected permissions do not exist.')
  }

  return permissions.map((permission) => permission.id)
}

export async function getRoleManagement(
  actor: CurrentUserContext,
  tenantId: string
): Promise<RoleManagementPayload> {
  assertTenantMatch(actor, tenantId)

  const [roles, permissions, assignmentCounts, actorRank] = await Promise.all([
    listManageableRoles(tenantId),
    listPermissions(),
    getRoleAssignmentCounts(tenantId),
    resolveActorRank(actor),
  ])

  return {
    actorRank,
    roles: roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      rank: role.rank,
      isSystem: role.isSystem,
      isActive: role.isActive,
      assignedUserCount: assignmentCounts.get(role.id) ?? 0,
      permissionCodes: role.permissions.map(
        (rolePermission) => rolePermission.permission.code
      ),
    })),
    permissions: permissions.map((permission) => ({
      code: permission.code,
      name: permission.name,
      kind: permission.kind.toLowerCase() as SecurityPermissionKind,
      moduleKey: permission.moduleKey,
      actionKey: permission.actionKey,
      description: permission.description,
      isActive: permission.isActive,
    })),
  }
}

export async function createRole(actor: CurrentUserContext, input: CreateRoleInput) {
  assertTenantMatch(actor, input.tenantId)

  const name = input.name.trim()
  if (name.length === 0) {
    throw new ValidationError('Role name is required.')
  }

  const actorRank = await resolveActorRank(actor)
  if (input.rank < MIN_ROLE_RANK || input.rank > MAX_ROLE_RANK) {
    throw new ValidationError('Role rank is out of range.')
  }
  if (input.rank >= actorRank) {
    throw new ForbiddenError('You cannot create a role at or above your authority.')
  }

  const code = slugifyRoleCode(name)
  const existing = await findTenantRoleByCode(input.tenantId, code)
  if (existing) {
    throw new ConflictError('A role with a similar name already exists.')
  }

  const permissionIds = await resolveGrantablePermissionIds(
    actor,
    input.permissionCodes
  )

  const role = await createTenantRole({
    tenantId: input.tenantId,
    code,
    name,
    description: input.description ?? null,
    rank: input.rank,
  })

  await setRolePermissions(role.id, permissionIds)

  await createAuditLog({
    tenantId: input.tenantId,
    actorProfileId: actor.profileId,
    actorEmail: actor.email,
    actionKey: 'role.created',
    entityType: 'role',
    entityId: role.id,
    newValues: {
      code: role.code,
      name: role.name,
      rank: role.rank,
      permissionCodes: input.permissionCodes,
    },
  })

  return { roleId: role.id, code: role.code }
}

export async function updateRole(actor: CurrentUserContext, input: UpdateRoleInput) {
  assertTenantMatch(actor, input.tenantId)

  const role = await findTenantRoleById(input.tenantId, input.roleId)
  if (!role) {
    throw new NotFoundError('Custom role not found.')
  }

  const actorRank = await resolveActorRank(actor)
  if (role.rank >= actorRank) {
    throw new ForbiddenError('You cannot edit a role at or above your authority.')
  }

  if (input.rank != null) {
    if (input.rank < MIN_ROLE_RANK || input.rank > MAX_ROLE_RANK) {
      throw new ValidationError('Role rank is out of range.')
    }
    if (input.rank >= actorRank) {
      throw new ForbiddenError('You cannot raise a role to or above your authority.')
    }
  }

  const trimmedName = input.name?.trim()
  if (input.name != null && trimmedName?.length === 0) {
    throw new ValidationError('Role name cannot be empty.')
  }

  await updateTenantRole(role.id, {
    name: trimmedName,
    description: input.description ?? undefined,
    isActive: input.isActive,
    rank: input.rank,
  })

  if (input.permissionCodes) {
    const permissionIds = await resolveGrantablePermissionIds(
      actor,
      input.permissionCodes
    )
    await setRolePermissions(role.id, permissionIds)
  }

  await createAuditLog({
    tenantId: input.tenantId,
    actorProfileId: actor.profileId,
    actorEmail: actor.email,
    actionKey: 'role.updated',
    entityType: 'role',
    entityId: role.id,
    newValues: {
      name: trimmedName,
      rank: input.rank,
      isActive: input.isActive,
      permissionCodes: input.permissionCodes,
    },
  })

  return { roleId: role.id }
}

export async function deleteRole(
  actor: CurrentUserContext,
  input: { tenantId: string; roleId: string }
) {
  assertTenantMatch(actor, input.tenantId)

  const role = await findTenantRoleById(input.tenantId, input.roleId)
  if (!role) {
    throw new NotFoundError('Custom role not found.')
  }

  const actorRank = await resolveActorRank(actor)
  if (role.rank >= actorRank) {
    throw new ForbiddenError('You cannot delete a role at or above your authority.')
  }

  const assignedUsers = await countTenantUsersWithRole(role.id)
  if (assignedUsers > 0) {
    throw new ValidationError(
      'Reassign the users holding this role before deleting it.'
    )
  }

  await softDeleteTenantRole(role.id, new Date())

  await createAuditLog({
    tenantId: input.tenantId,
    actorProfileId: actor.profileId,
    actorEmail: actor.email,
    actionKey: 'role.deleted',
    entityType: 'role',
    entityId: role.id,
    oldValues: {
      code: role.code,
      name: role.name,
    },
  })

  return { roleId: role.id }
}
