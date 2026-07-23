'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addTimelineNoteServerFn,
  adjustPointsServerFn,
  assignTagServerFn,
  deleteCustomerAddressServerFn,
  deleteCustomerContactServerFn,
  deleteCustomerRelationshipServerFn,
  getCustomer360ServerFn,
  getCustomerMetricsServerFn,
  getLoyaltyAccountServerFn,
  listCustomerTimelineServerFn,
  listLoyaltyLedgerServerFn,
  redeemPointsServerFn,
  setConsentServerFn,
  unassignTagServerFn,
  upsertCustomerAddressServerFn,
  upsertCustomerContactServerFn,
  upsertCustomerRelationshipServerFn,
} from '#/features/crm/server-functions'
import type { z } from 'zod'
import type {
  addressUpsertSchema,
  adjustPointsSchema,
  consentSetSchema,
  contactUpsertSchema,
  redeemPointsSchema,
  relationshipUpsertSchema,
} from '#/features/crm/validation'
import {
  crmPayload,
  requireAccessToken,
  useTenantId,
} from '#/features/crm/use-crm-base'

// Customer 360 reads + satellite mutations, keyed per customer so tab data
// invalidates together after any profile write.

export type Customer360 = Awaited<ReturnType<typeof getCustomer360ServerFn>>

export function useCustomer360(customerId: string | null) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-customer-360', tenantId, customerId],
    enabled: Boolean(tenantId && customerId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getCustomer360ServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          customerId: customerId as string,
        },
      })
    },
  })
}

export function useCustomerMetrics(customerId: string | null) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-customer-metrics', tenantId, customerId],
    enabled: Boolean(tenantId && customerId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getCustomerMetricsServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          customerId: customerId as string,
        },
      })
    },
  })
}

export function useCustomerTimeline(
  customerId: string | null,
  entryType?: string,
) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-customer-timeline', tenantId, customerId, entryType ?? ''],
    enabled: Boolean(tenantId && customerId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listCustomerTimelineServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          customerId: customerId as string,
          entryType: entryType || undefined,
          take: 100,
        },
      })
    },
  })
}

export function useLoyaltyAccount(customerId: string | null) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-loyalty-account', tenantId, customerId],
    enabled: Boolean(tenantId && customerId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getLoyaltyAccountServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          customerId: customerId as string,
        },
      })
    },
  })
}

export function useLoyaltyLedger(customerId: string | null) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-loyalty-ledger', tenantId, customerId],
    enabled: Boolean(tenantId && customerId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listLoyaltyLedgerServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          customerId: customerId as string,
          take: 100,
        },
      })
    },
  })
}

export function useCustomer360Mutations(customerId: string) {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate360 = () => {
    queryClient.invalidateQueries({
      queryKey: ['crm-customer-360', tenantId, customerId],
    })
    queryClient.invalidateQueries({ queryKey: ['crm-customers', tenantId] })
  }
  const invalidateTimeline = () => {
    queryClient.invalidateQueries({
      queryKey: ['crm-customer-timeline', tenantId, customerId],
    })
  }
  const invalidateLoyalty = () => {
    queryClient.invalidateQueries({
      queryKey: ['crm-loyalty-account', tenantId, customerId],
    })
    queryClient.invalidateQueries({
      queryKey: ['crm-loyalty-ledger', tenantId, customerId],
    })
  }

  const withCustomer = async () => ({
    ...(await crmPayload(tenantId)),
    customerId,
  })

  const upsertContact = useMutation({
    mutationFn: async (input: z.infer<typeof contactUpsertSchema>) =>
      upsertCustomerContactServerFn({
        data: { ...(await withCustomer()), input },
      }),
    onSuccess: invalidate360,
  })

  const deleteContact = useMutation({
    mutationFn: async (id: string) =>
      deleteCustomerContactServerFn({
        data: { ...(await crmPayload(tenantId)), id },
      }),
    onSuccess: invalidate360,
  })

  const upsertAddress = useMutation({
    mutationFn: async (input: z.infer<typeof addressUpsertSchema>) =>
      upsertCustomerAddressServerFn({
        data: { ...(await withCustomer()), input },
      }),
    onSuccess: invalidate360,
  })

  const deleteAddress = useMutation({
    mutationFn: async (id: string) =>
      deleteCustomerAddressServerFn({
        data: { ...(await crmPayload(tenantId)), id },
      }),
    onSuccess: invalidate360,
  })

  const upsertRelationship = useMutation({
    mutationFn: async (input: z.infer<typeof relationshipUpsertSchema>) =>
      upsertCustomerRelationshipServerFn({
        data: { ...(await withCustomer()), input },
      }),
    onSuccess: invalidate360,
  })

  const deleteRelationship = useMutation({
    mutationFn: async (id: string) =>
      deleteCustomerRelationshipServerFn({
        data: { ...(await crmPayload(tenantId)), id },
      }),
    onSuccess: invalidate360,
  })

  const setConsent = useMutation({
    mutationFn: async (input: z.infer<typeof consentSetSchema>) =>
      setConsentServerFn({ data: { ...(await withCustomer()), input } }),
    onSuccess: invalidate360,
  })

  const assignTag = useMutation({
    mutationFn: async (tagId: string) =>
      assignTagServerFn({ data: { ...(await withCustomer()), tagId } }),
    onSuccess: invalidate360,
  })

  const unassignTag = useMutation({
    mutationFn: async (tagId: string) =>
      unassignTagServerFn({ data: { ...(await withCustomer()), tagId } }),
    onSuccess: invalidate360,
  })

  const addNote = useMutation({
    mutationFn: async (note: string) =>
      addTimelineNoteServerFn({ data: { ...(await withCustomer()), note } }),
    onSuccess: invalidateTimeline,
  })

  const redeemPoints = useMutation({
    mutationFn: async (input: z.infer<typeof redeemPointsSchema>) =>
      redeemPointsServerFn({ data: { ...(await withCustomer()), input } }),
    onSuccess: invalidateLoyalty,
  })

  const adjustPoints = useMutation({
    mutationFn: async (input: z.infer<typeof adjustPointsSchema>) =>
      adjustPointsServerFn({ data: { ...(await withCustomer()), input } }),
    onSuccess: invalidateLoyalty,
  })

  return {
    upsertContact,
    deleteContact,
    upsertAddress,
    deleteAddress,
    upsertRelationship,
    deleteRelationship,
    setConsent,
    assignTag,
    unassignTag,
    addNote,
    redeemPoints,
    adjustPoints,
  }
}
