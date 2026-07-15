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
import { getNavigationTree } from '#/server/auth/navigation'
import {
  createRole,
  deleteRole,
  getRoleManagement,
  updateRole,
} from '#/server/auth/role-management'
import {
  getModuleManagement,
  reorderScreens,
  setModuleState,
  setScreenVisibility,
} from '#/server/auth/module-management'
import { getSecurityOverview } from '#/server/auth/security-management'
import { bootstrapSession, getCurrentUserContext } from '#/server/auth/session'
import {
  requireAuth,
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import { setDefaultTenant } from '#/server/repos/preference-repo'
import { listAssignableRoles } from '#/server/repos/role-repo'
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

    return listAssignableRoles(data.tenantId).then((roles) =>
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
          roleCode: z.string().min(1).optional(),
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
      roleCode: z.string().min(1),
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
      roleCode: z.string().min(1),
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
      roleCode: z.string().min(1),
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
      permissionCode: z.string().min(1),
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

export const getSecurityOverviewServerFn = createServerFn({
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
      ['tenant.manage_settings', 'res.settings.manage', 'user.view']
    )

    return getSecurityOverview(context, data.tenantId)
  })

export const getNavigationTreeServerFn = createServerFn({
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

    return getNavigationTree(context, data.tenantId)
  })

const permissionCodesSchema = z.array(z.string().min(1)).max(200)

export const getRoleManagementServerFn = createServerFn({
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
      ['role.view', 'role.manage']
    )

    return getRoleManagement(context, data.tenantId)
  })

export const createRoleServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      name: z.string().min(1).max(80),
      description: z.string().max(500).nullish(),
      rank: z.number().int().min(1).max(200),
      permissionCodes: permissionCodesSchema,
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
      'role.manage'
    )

    return createRole(context, {
      tenantId: data.tenantId,
      name: data.name,
      description: data.description ?? null,
      rank: data.rank,
      permissionCodes: data.permissionCodes,
    })
  })

export const updateRoleServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      roleId: z.string().uuid(),
      name: z.string().min(1).max(80).optional(),
      description: z.string().max(500).nullish(),
      isActive: z.boolean().optional(),
      rank: z.number().int().min(1).max(200).optional(),
      permissionCodes: permissionCodesSchema.optional(),
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
      'role.manage'
    )

    return updateRole(context, {
      tenantId: data.tenantId,
      roleId: data.roleId,
      name: data.name,
      description: data.description,
      isActive: data.isActive,
      rank: data.rank,
      permissionCodes: data.permissionCodes,
    })
  })

export const deleteRoleServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      roleId: z.string().uuid(),
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
      'role.manage'
    )

    return deleteRole(context, {
      tenantId: data.tenantId,
      roleId: data.roleId,
    })
  })

export const getModuleManagementServerFn = createServerFn({
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
      'module.manage'
    )

    return getModuleManagement(context, data.tenantId)
  })

export const setModuleStateServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      moduleId: z.string().uuid(),
      isEnabled: z.boolean(),
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
      'module.manage'
    )

    return setModuleState(context, {
      tenantId: data.tenantId,
      moduleId: data.moduleId,
      isEnabled: data.isEnabled,
    })
  })

export const setScreenVisibilityServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      screenId: z.string().uuid(),
      showInMenu: z.boolean(),
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
      'module.manage'
    )

    return setScreenVisibility(context, {
      tenantId: data.tenantId,
      screenId: data.screenId,
      showInMenu: data.showInMenu,
    })
  })

export const reorderScreensServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      moduleId: z.string().uuid(),
      orderedScreenIds: z.array(z.string().uuid()).min(1).max(200),
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
      'module.manage'
    )

    return reorderScreens(context, {
      tenantId: data.tenantId,
      moduleId: data.moduleId,
      orderedScreenIds: data.orderedScreenIds,
    })
  })
