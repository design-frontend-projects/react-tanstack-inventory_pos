import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import {
  completeOwnerOnboarding,
  listRolesPermissions,
  resetPassword,
  sendForgotPassword,
  setUserPermissionOverride,
  startTenantRegistration,
  updateCurrentUserProfile,
} from '#/server/auth/account-management'
import {
  acceptInvitation,
  changeTenantUserPrimaryRole,
  completeInvitedProfile,
  inviteTenantUser,
  listTenantUsersForManagement,
  revokeTenantInvitation,
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
import {
  PERMISSION_CODES,
  TENANT_ASSIGNABLE_ROLE_CODES,
} from '#/features/auth/rbac-catalog'
import {
  forgotPasswordSchema,
  invitationAcceptanceSchema,
  ownerOnboardingSchema,
  profileUpdateSchema,
  resetPasswordSchema,
  signUpSchema,
} from '#/features/auth/validation'

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

export const startTenantRegistrationServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(signUpSchema)
  .handler(async ({ data }) => {
    return startTenantRegistration(data)
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

export const revokeTenantInvitationServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      invitationId: z.string().uuid(),
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
      'user.invite'
    )

    return revokeTenantInvitation(context, data.tenantId, data.invitationId)
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
      'user.invite'
    )

    return resendTenantInvitation(context, data.invitationId, data.origin)
  })

export const completeOwnerOnboardingServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    ownerOnboardingSchema.extend({
      accessToken: accessTokenSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = requireAuth(
      await getCurrentUserContext({
        accessToken: data.accessToken,
      })
    )

    return completeOwnerOnboarding(context, data)
  })

export const acceptInvitationServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    invitationAcceptanceSchema.extend({
      accessToken: accessTokenSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = requireAuth(
      await getCurrentUserContext({
        accessToken: data.accessToken,
      })
    )

    return acceptInvitation(context, data)
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
    const permission = data.status === 'active' ? 'user.update' : 'user.deactivate'
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
      'user.change_role'
    )

    return changeTenantUserPrimaryRole(context, data)
  })

export const assignPrimaryRoleServerFn = createServerFn({
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
      'user.change_role'
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

export const sendForgotPasswordServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(forgotPasswordSchema)
  .handler(async ({ data }) => {
    return sendForgotPassword(data)
  })

export const resetPasswordServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    resetPasswordSchema.extend({
      accessToken: accessTokenSchema,
    })
  )
  .handler(async ({ data }) => {
    return resetPassword(data.accessToken, data)
  })

export const updateProfileServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    profileUpdateSchema.extend({
      accessToken: accessTokenSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = requireAuth(
      await getCurrentUserContext({
        accessToken: data.accessToken,
      })
    )

    return updateCurrentUserProfile(context, data)
  })

export const listRolesPermissionsServerFn = createServerFn({
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
      ['user.view', 'user.assign_permission']
    )

    return listRolesPermissions(context, data.tenantId)
  })

export const setUserPermissionOverrideServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      tenantUserId: z.string().uuid(),
      permissionCode: z.enum(PERMISSION_CODES),
      isAllowed: z.boolean().nullable(),
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
      'user.assign_permission'
    )

    return setUserPermissionOverride(context, data)
  })
