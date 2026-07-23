'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCustomerServerFn,
  updateCustomerServerFn,
} from '#/features/products/server-functions'
import {
  getCrmCustomerSummaryServerFn,
  listCrmCustomersServerFn,
  listTagsServerFn,
  upsertCustomerProfileServerFn,
} from '#/features/crm/server-functions'
import type {
  CrmDirectoryFiltersInput,
  profileUpsertSchema,
} from '#/features/crm/validation'
import type { z } from 'zod'
import {
  crmPayload,
  requireAccessToken,
  useTenantId,
} from '#/features/crm/use-crm-base'

// Customer directory + master-record mutations. The customer master CRUD lives
// in the catalog module (customer.manage); CRM adds the profile satellite on
// top of it (crm.profile_manage).

export type CrmDirectoryPage = Awaited<
  ReturnType<typeof listCrmCustomersServerFn>
>
export type CrmDirectoryRow = CrmDirectoryPage['items'][number]

export function useCrmCustomers(filters: CrmDirectoryFiltersInput = {}) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-customers', tenantId, filters],
    enabled: Boolean(tenantId),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listCrmCustomersServerFn({
        data: { accessToken, tenantId: tenantId as string, filters },
      })
    },
  })
}

export function useCrmCustomerSummary() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-customer-summary', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getCrmCustomerSummaryServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useCrmTags() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-tags', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listTagsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export interface CustomerMasterInput {
  code: string
  name: string
  customerType?: 'RETAIL' | 'WHOLESALE' | 'B2B'
  taxId?: string | null
  email?: string | null
  phone?: string | null
  creditLimit?: string | number | null
  isActive?: boolean
}

export type CustomerProfileInput = z.infer<typeof profileUpsertSchema>

export function useCrmCustomerMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = (customerId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['crm-customers', tenantId] })
    queryClient.invalidateQueries({
      queryKey: ['crm-customer-summary', tenantId],
    })
    if (customerId) {
      queryClient.invalidateQueries({
        queryKey: ['crm-customer-360', tenantId, customerId],
      })
    }
  }

  const createCustomer = useMutation({
    mutationFn: async (args: {
      master: CustomerMasterInput
      profile?: CustomerProfileInput
    }) => {
      const payload = await crmPayload(tenantId)
      const customer = await createCustomerServerFn({
        data: { ...payload, input: args.master },
      })
      if (args.profile && Object.keys(args.profile).length > 0) {
        await upsertCustomerProfileServerFn({
          data: { ...payload, customerId: customer.id, input: args.profile },
        })
      }
      return customer
    },
    onSuccess: (customer) => invalidate(customer.id),
  })

  const updateCustomer = useMutation({
    mutationFn: async (args: {
      customerId: string
      master?: Partial<CustomerMasterInput>
      profile?: CustomerProfileInput
    }) => {
      const payload = await crmPayload(tenantId)
      if (args.master && Object.keys(args.master).length > 0) {
        await updateCustomerServerFn({
          data: { ...payload, id: args.customerId, input: args.master },
        })
      }
      if (args.profile && Object.keys(args.profile).length > 0) {
        await upsertCustomerProfileServerFn({
          data: {
            ...payload,
            customerId: args.customerId,
            input: args.profile,
          },
        })
      }
    },
    onSuccess: (_data, args) => invalidate(args.customerId),
  })

  return { createCustomer, updateCustomer }
}
