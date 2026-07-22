'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  addRequirementServerFn,
  addSkillRequirementServerFn,
  createPlanServerFn,
  createSkillServerFn,
  deleteEmployeeSkillServerFn,
  deletePlanServerFn,
  deleteSkillServerFn,
  listEmployeeSkillsServerFn,
  listPlansServerFn,
  listRequirementsServerFn,
  listSkillRequirementsServerFn,
  listSkillsServerFn,
  updatePlanServerFn,
  updateSkillServerFn,
  upsertEmployeeSkillServerFn,
} from '#/features/hr/workforce-server-functions'
import type {
  EmployeeSkillInput,
  SkillRequirementInput,
  SkillWriteInput,
  WorkforcePlanWriteInput,
  WorkforceRequirementInput,
} from '#/features/hr/workforce-validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken)
    throw new Error('You must be signed in to view workforce data.')
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useSkills() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-skills', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listSkillsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function useWorkforcePlans(filters: { fiscalYear?: number } = {}) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-workforce-plans', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listPlansServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          ...filters,
        },
      }),
  })
}

export function useEmployeeSkills(
  filters: { employeeId?: string; skillId?: string } = {},
) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-employee-skills', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listEmployeeSkillsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          ...filters,
        },
      }),
  })
}

export function useWorkforceRequirements(planId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-workforce-requirements', tenantId, planId],
    enabled: Boolean(tenantId) && Boolean(planId),
    queryFn: async () =>
      listRequirementsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          planId: planId as string,
        },
      }),
  })
}

export function useSkillRequirements(positionId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-skill-requirements', tenantId, positionId],
    enabled: Boolean(tenantId) && Boolean(positionId),
    queryFn: async () =>
      listSkillRequirementsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          positionId: positionId as string,
        },
      }),
  })
}

export function useWorkforceMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-skills', tenantId] })
    queryClient.invalidateQueries({
      queryKey: ['hr-workforce-plans', tenantId],
    })
    queryClient.invalidateQueries({
      queryKey: ['hr-employee-skills', tenantId],
    })
    queryClient.invalidateQueries({
      queryKey: ['hr-workforce-requirements', tenantId],
    })
    queryClient.invalidateQueries({
      queryKey: ['hr-skill-requirements', tenantId],
    })
  }

  async function payload() {
    if (!tenantId)
      throw new Error('Select a workspace before managing workforce data.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createSkill = useMutation({
    mutationFn: async (input: SkillWriteInput) =>
      createSkillServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updateSkill = useMutation({
    mutationFn: async (args: { id: string; input: Partial<SkillWriteInput> }) =>
      updateSkillServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const deleteSkill = useMutation({
    mutationFn: async (id: string) =>
      deleteSkillServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const upsertEmployeeSkill = useMutation({
    mutationFn: async (input: EmployeeSkillInput) =>
      upsertEmployeeSkillServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const deleteEmployeeSkill = useMutation({
    mutationFn: async (id: string) =>
      deleteEmployeeSkillServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const createPlan = useMutation({
    mutationFn: async (input: WorkforcePlanWriteInput) =>
      createPlanServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updatePlan = useMutation({
    mutationFn: async (args: {
      id: string
      input: Partial<WorkforcePlanWriteInput>
    }) =>
      updatePlanServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const deletePlan = useMutation({
    mutationFn: async (id: string) =>
      deletePlanServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const addRequirement = useMutation({
    mutationFn: async (input: WorkforceRequirementInput) =>
      addRequirementServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const addSkillRequirement = useMutation({
    mutationFn: async (input: SkillRequirementInput) =>
      addSkillRequirementServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  return {
    createSkill,
    updateSkill,
    deleteSkill,
    upsertEmployeeSkill,
    deleteEmployeeSkill,
    createPlan,
    updatePlan,
    deletePlan,
    addRequirement,
    addSkillRequirement,
  }
}
