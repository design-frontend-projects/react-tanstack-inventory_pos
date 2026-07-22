'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  approvePayrollRunServerFn,
  assignSalaryComponentServerFn,
  calculatePayrollRunServerFn,
  createPayrollPeriodServerFn,
  createPayrollRunServerFn,
  createSalaryComponentServerFn,
  deleteSalaryComponentServerFn,
  getPayrollRunServerFn,
  listPayrollPeriodsServerFn,
  listPayrollRunsServerFn,
  listPostableAccountsServerFn,
  listSalaryComponentsServerFn,
  payPayrollRunServerFn,
  postPayrollRunServerFn,
  updateSalaryComponentServerFn,
} from '#/features/hr/payroll-server-functions'
import type {
  PayrollPeriodWriteInput,
  PayrollPostInput,
  PayrollRunCreateInput,
  SalaryComponentWriteInput,
} from '#/features/hr/payroll-validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('You must be signed in to view payroll.')
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useSalaryComponents() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-salary-components', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listSalaryComponentsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function usePayrollPeriods() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-payroll-periods', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listPayrollPeriodsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function usePayrollRuns() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-payroll-runs', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listPayrollRunsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function usePayrollRun(id: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-payroll-run', tenantId, id],
    enabled: Boolean(tenantId && id),
    queryFn: async () =>
      getPayrollRunServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          id: id as string,
        },
      }),
  })
}

export function usePostableAccounts(enabled: boolean) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-postable-accounts', tenantId],
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () =>
      listPostableAccountsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function usePayrollMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-payroll-runs', tenantId] })
    queryClient.invalidateQueries({
      queryKey: ['hr-payroll-periods', tenantId],
    })
    queryClient.invalidateQueries({
      queryKey: ['hr-salary-components', tenantId],
    })
    queryClient.invalidateQueries({ queryKey: ['hr-payroll-run', tenantId] })
  }

  async function payload() {
    if (!tenantId)
      throw new Error('Select a workspace before managing payroll.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createComponent = useMutation({
    mutationFn: async (input: SalaryComponentWriteInput) =>
      createSalaryComponentServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updateComponent = useMutation({
    mutationFn: async (args: {
      id: string
      input: Partial<SalaryComponentWriteInput>
    }) =>
      updateSalaryComponentServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const deleteComponent = useMutation({
    mutationFn: async (id: string) =>
      deleteSalaryComponentServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const assignComponent = useMutation({
    mutationFn: async (input: {
      employeeId: string
      componentId: string
      amount: number | string
      effectiveFrom: string
    }) =>
      assignSalaryComponentServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const createPeriod = useMutation({
    mutationFn: async (input: PayrollPeriodWriteInput) =>
      createPayrollPeriodServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const createRun = useMutation({
    mutationFn: async (input: PayrollRunCreateInput) =>
      createPayrollRunServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const calculateRun = useMutation({
    mutationFn: async (id: string) =>
      calculatePayrollRunServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const approveRun = useMutation({
    mutationFn: async (id: string) =>
      approvePayrollRunServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const postRun = useMutation({
    mutationFn: async (args: { id: string; input: PayrollPostInput }) =>
      postPayrollRunServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const payRun = useMutation({
    mutationFn: async (id: string) =>
      payPayrollRunServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return {
    createComponent,
    updateComponent,
    deleteComponent,
    assignComponent,
    createPeriod,
    createRun,
    calculateRun,
    approveRun,
    postRun,
    payRun,
  }
}
