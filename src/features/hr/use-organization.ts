'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createBranchServerFn,
  createCompanyServerFn,
  createCostCenterServerFn,
  createDepartmentServerFn,
  createJobGradeServerFn,
  createPositionServerFn,
  deleteBranchServerFn,
  deleteCompanyServerFn,
  deleteCostCenterServerFn,
  deleteDepartmentServerFn,
  deleteJobGradeServerFn,
  deletePositionServerFn,
  listBranchesServerFn,
  listCompaniesServerFn,
  listCostCentersServerFn,
  listDepartmentsServerFn,
  listJobGradesServerFn,
  listPositionsServerFn,
  updateBranchServerFn,
  updateCompanyServerFn,
  updateCostCenterServerFn,
  updateDepartmentServerFn,
  updateJobGradeServerFn,
  updatePositionServerFn,
} from '#/features/hr/server-functions'
import type {
  BranchWriteInput,
  CompanyWriteInput,
  CostCenterWriteInput,
  DepartmentWriteInput,
  JobGradeWriteInput,
  PositionWriteInput,
} from '#/features/hr/validation'

type OrgEntity =
  | 'hr-companies'
  | 'hr-branches'
  | 'hr-departments'
  | 'hr-positions'
  | 'hr-job-grades'
  | 'hr-cost-centers'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    throw new Error('You must be signed in to view HR organization data.')
  }
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

function useOrgQuery<T>(
  key: OrgEntity,
  serverFn: (args: {
    data: { accessToken: string; tenantId: string }
  }) => Promise<T>,
) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: [key, tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return serverFn({ data: { accessToken, tenantId: tenantId as string } })
    },
  })
}

export function useCompanies() {
  return useOrgQuery('hr-companies', listCompaniesServerFn)
}
export function useBranches() {
  return useOrgQuery('hr-branches', listBranchesServerFn)
}
export function useDepartments() {
  return useOrgQuery('hr-departments', listDepartmentsServerFn)
}
export function usePositions() {
  return useOrgQuery('hr-positions', listPositionsServerFn)
}
export function useJobGrades() {
  return useOrgQuery('hr-job-grades', listJobGradesServerFn)
}
export function useCostCenters() {
  return useOrgQuery('hr-cost-centers', listCostCentersServerFn)
}

type CreateFn<TInput> = (args: {
  data: { accessToken: string; tenantId: string; input: TInput }
}) => Promise<unknown>
type UpdateFn<TInput> = (args: {
  data: {
    accessToken: string
    tenantId: string
    id: string
    input: Partial<TInput>
  }
}) => Promise<unknown>
type DeleteFn = (args: {
  data: { accessToken: string; tenantId: string; id: string }
}) => Promise<unknown>

// Custom hook — declares the create/update/delete mutations for one entity.
// Called once per entity (in a fixed order) by useOrganizationMutations so the
// rules of hooks hold.
function useEntityMutations<TInput>(
  key: OrgEntity,
  createFn: CreateFn<TInput>,
  updateFn: UpdateFn<TInput>,
  deleteFn: DeleteFn,
) {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [key, tenantId] })
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing HR data.')
    }
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const create = useMutation({
    mutationFn: async (input: TInput) =>
      createFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: async (args: { id: string; input: Partial<TInput> }) =>
      updateFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: async (id: string) =>
      deleteFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}

export function useOrganizationMutations() {
  const company = useEntityMutations<CompanyWriteInput>(
    'hr-companies',
    createCompanyServerFn,
    updateCompanyServerFn,
    deleteCompanyServerFn,
  )
  const branch = useEntityMutations<BranchWriteInput>(
    'hr-branches',
    createBranchServerFn,
    updateBranchServerFn,
    deleteBranchServerFn,
  )
  const department = useEntityMutations<DepartmentWriteInput>(
    'hr-departments',
    createDepartmentServerFn,
    updateDepartmentServerFn,
    deleteDepartmentServerFn,
  )
  const position = useEntityMutations<PositionWriteInput>(
    'hr-positions',
    createPositionServerFn,
    updatePositionServerFn,
    deletePositionServerFn,
  )
  const jobGrade = useEntityMutations<JobGradeWriteInput>(
    'hr-job-grades',
    createJobGradeServerFn,
    updateJobGradeServerFn,
    deleteJobGradeServerFn,
  )
  const costCenter = useEntityMutations<CostCenterWriteInput>(
    'hr-cost-centers',
    createCostCenterServerFn,
    updateCostCenterServerFn,
    deleteCostCenterServerFn,
  )

  return { company, branch, department, position, jobGrade, costCenter }
}
