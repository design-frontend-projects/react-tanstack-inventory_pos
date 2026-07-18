'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  allocateSupplierPaymentServerFn,
  cancelSupplierPaymentServerFn,
  createSupplierPaymentServerFn,
  listSupplierPaymentsServerFn,
  postSupplierPaymentServerFn,
  submitSupplierPaymentServerFn,
} from '#/features/purchasing/payment-server-functions'
import type { z } from 'zod'
import type {
  paymentAllocateSchema,
  paymentCreateSchema,
  paymentListSchema,
} from '#/features/purchasing/payment-validation'

export type PaymentListInput = z.infer<typeof paymentListSchema>
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>
export type PaymentAllocateInput = z.infer<typeof paymentAllocateSchema>

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to manage supplier payments.')
  }

  return accessToken
}

export function useSupplierPayments(input: PaymentListInput = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['supplier-payments', tenantId, input],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listSupplierPaymentsServerFn({
        data: { accessToken, tenantId: tenantId as string, input },
      })
    },
  })
}

export function useSupplierPaymentMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['supplier-payments', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['supplier-invoices', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['my-approvals', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['suppliers', tenantId] })
  }

  const withIdCall = async (
    serverFn:
      | typeof submitSupplierPaymentServerFn
      | typeof postSupplierPaymentServerFn
      | typeof cancelSupplierPaymentServerFn,
    id: string,
  ) => {
    const accessToken = await requireAccessToken()

    return serverFn({
      data: { accessToken, tenantId: tenantId as string, id },
    })
  }

  const create = useMutation({
    mutationFn: async (input: PaymentCreateInput) => {
      const accessToken = await requireAccessToken()

      return createSupplierPaymentServerFn({
        data: { accessToken, tenantId: tenantId as string, input },
      })
    },
    onSuccess: invalidate,
  })

  const allocate = useMutation({
    mutationFn: async (args: { id: string; input: PaymentAllocateInput }) => {
      const accessToken = await requireAccessToken()

      return allocateSupplierPaymentServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          id: args.id,
          input: args.input,
        },
      })
    },
    onSuccess: invalidate,
  })

  const submit = useMutation({
    mutationFn: (id: string) => withIdCall(submitSupplierPaymentServerFn, id),
    onSuccess: invalidate,
  })

  const post = useMutation({
    mutationFn: (id: string) => withIdCall(postSupplierPaymentServerFn, id),
    onSuccess: invalidate,
  })

  const cancel = useMutation({
    mutationFn: (id: string) => withIdCall(cancelSupplierPaymentServerFn, id),
    onSuccess: invalidate,
  })

  return { create, allocate, submit, post, cancel }
}
