import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import {
  changeTenantUserPrimaryRole,
  completeInvitedProfile,
  inviteTenantUser,
  listTenantUsersForManagement,
  resendTenantInvitation,
  updateTenantUserStatus,
} from '#/server/auth/user-management'
import { bootstrapSession, getCurrentUserContext } from '#/server/auth/session'
import {
  requireAuth,
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import { setDefaultTenant } from '#/server/repos/preference-repo'
import { listTenantAssignableRoles } from '#/server/repos/role-repo'
import { TENANT_ASSIGNABLE_ROLE_CODES } from '#/features/auth/rbac-catalog'

const accessTokenSchema = z.string().min(1)
const tenantIdSchema = z.string().uuid()

export const bootstrapSessionServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      requestedTenantId: tenantIdSchema.nullish(),
    })
  )
  .handler(async ({ data }) => {
    return bootstrapSession(data)
  })

export const getCurrentUserContextServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema.nullish(),
    })
  )
  .handler(async ({ data }) => {
    const context = await getCurrentUserContext(data)
    return requireAuth(context)
  })

export const switchActiveTenantServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId
    )

    await setDefaultTenant(context.profileId, data.tenantId)

    return bootstrapSession({
      accessToken: data.accessToken,
      requestedTenantId: data.tenantId,
    })
  })

export const listTenantAssignableRolesServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = requirePermission(
      requireTenantAccess(
        await getCurrentUserContext({
          accessToken: data.accessToken,
          tenantId: data.tenantId,
        }),
        data.tenantId
      ),
      'user.view'
    )

    requireAuth(context)

    return listTenantAssignableRoles().then((roles) =>
      roles.map((role) => ({
        code: role.code,
        name: role.name,
        rank: role.rank,
      }))
    )
  })

export const listTenantUsersServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      filters: z
        .object({
          search: z.string().optional(),
          roleCode: z
            .enum([...TENANT_ASSIGNABLE_ROLE_CODES, 'all'] as const)
            .optional(),
          status: z
            .enum(['invited', 'active', 'suspended', 'disabled', 'rejected', 'all'])
            .optional(),
          invitationStatus: z
            .enum(['pending', 'accepted', 'expired', 'revoked', 'failed', 'all'])
            .optional(),
        })
        .optional(),
    })
  )
  .handler(async ({ data }) => {
    const context = requirePermission(
      requireTenantAccess(
        await getCurrentUserContext({
          accessToken: data.accessToken,
          tenantId: data.tenantId,
        }),
        data.tenantId
      ),
      'user.view'
    )

    requireAuth(context)

    return listTenantUsersForManagement(data.tenantId, data.filters)
  })

export const inviteTenantUserServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      email: z.string().email(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      phone: z.string().optional().nullable(),
      jobTitle: z.string().optional().nullable(),
      roleCode: z.enum(TENANT_ASSIGNABLE_ROLE_CODES),
      origin: z.string().url(),
    })
  )
  .handler(async ({ data }) => {
    const context = requirePermission(
      requireTenantAccess(
        await getCurrentUserContext({
          accessToken: data.accessToken,
          tenantId: data.tenantId,
        }),
        data.tenantId
      ),
      'user.invite'
    )

    return inviteTenantUser(context, data)
  })

export const resendTenantInvitationServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      invitationId: z.string().uuid(),
      tenantId: tenantIdSchema,
      origin: z.string().url(),
    })
  )
  .handler(async ({ data }) => {
    const context = requirePermission(
      requireTenantAccess(
        await getCurrentUserContext({
          accessToken: data.accessToken,
          tenantId: data.tenantId,
        }),
        data.tenantId
      ),
      'user.resend_invite'
    )

    return resendTenantInvitation(context, data.invitationId, data.origin)
  })

export const updateTenantUserStatusServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      tenantUserId: z.string().uuid(),
      status: z.enum(['active', 'suspended', 'disabled']),
    })
  )
  .handler(async ({ data }) => {
    const permission = data.status === 'active' ? 'user.activate' : 'user.suspend'
    const context = requirePermission(
      requireTenantAccess(
        await getCurrentUserContext({
          accessToken: data.accessToken,
          tenantId: data.tenantId,
        }),
        data.tenantId
      ),
      permission
    )

    return updateTenantUserStatus(context, data)
  })

export const changeTenantUserPrimaryRoleServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      tenantUserId: z.string().uuid(),
      roleCode: z.enum(TENANT_ASSIGNABLE_ROLE_CODES),
    })
  )
  .handler(async ({ data }) => {
    const context = requirePermission(
      requireTenantAccess(
        await getCurrentUserContext({
          accessToken: data.accessToken,
          tenantId: data.tenantId,
        }),
        data.tenantId
      ),
      'role.assign'
    )

    return changeTenantUserPrimaryRole(context, data)
  })

export const completeInvitedProfileServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      email: z.string().email(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      phone: z.string().optional().nullable(),
      avatarUrl: z.string().url().optional().nullable(),
      password: z.string().min(8).optional().nullable(),
      confirmPassword: z.string().min(8).optional().nullable(),
    })
  )
  .handler(async ({ data }) => {
    const context = requireAuth(
      await getCurrentUserContext({
        accessToken: data.accessToken,
      })
    )

    return completeInvitedProfile(context, data.email, data)
  })
