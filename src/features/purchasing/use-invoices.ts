'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  cancelSupplierInvoiceServerFn,
  createSupplierInvoiceFromPoServerFn,
  disputeSupplierInvoiceServerFn,
  listSupplierInvoicesServerFn,
  matchSupplierInvoiceServerFn,
  postSupplierInvoiceServerFn,
  resolveSupplierInvoiceDisputeServerFn,
  submitSupplierInvoiceServerFn,
} from '#/features/purchasing/invoice-server-functions'
import type { z } from 'zod'
import type {
  invoiceFromPoSchema,
  invoiceListSchema,
} from '#/features/purchasing/invoice-validation'

export type InvoiceListInput = z.infer<typeof invoiceListSchema>
export type InvoiceFromPoInput = z.infer<typeof invoiceFromPoSchema>

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to manage supplier invoices.')
  }

  return accessToken
}

export function useSupplierInvoices(input: InvoiceListInput = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['supplier-invoices', tenantId, input],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listSupplierInvoicesServerFn({
        data: { accessToken, tenantId: tenantId as string, input },
      })
    },
  })
}

export function useSupplierInvoiceMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['supplier-invoices', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['my-approvals', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['suppliers', tenantId] })
  }

  const withIdCall = async (
    serverFn:
      | typeof matchSupplierInvoiceServerFn
      | typeof submitSupplierInvoiceServerFn
      | typeof disputeSupplierInvoiceServerFn
      | typeof resolveSupplierInvoiceDisputeServerFn
      | typeof cancelSupplierInvoiceServerFn,
    id: string,
  ) => {
    const accessToken = await requireAccessToken()

    return serverFn({
      data: { accessToken, tenantId: tenantId as string, id },
    })
  }

  const createFromPo = useMutation({
    mutationFn: async (input: InvoiceFromPoInput) => {
      const accessToken = await requireAccessToken()

      return createSupplierInvoiceFromPoServerFn({
        data: { accessToken, tenantId: tenantId as string, input },
      })
    },
    onSuccess: invalidate,
  })

  const match = useMutation({
    mutationFn: (id: string) => withIdCall(matchSupplierInvoiceServerFn, id),
    onSuccess: invalidate,
  })

  const submit = useMutation({
    mutationFn: (id: string) => withIdCall(submitSupplierInvoiceServerFn, id),
    onSuccess: invalidate,
  })

  const post = useMutation({
    mutationFn: async (args: { id: string; overrideVariance?: boolean }) => {
      const accessToken = await requireAccessToken()

      return postSupplierInvoiceServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          id: args.id,
          input: { overrideVariance: args.overrideVariance },
        },
      })
    },
    onSuccess: invalidate,
  })

  const dispute = useMutation({
    mutationFn: (id: string) => withIdCall(disputeSupplierInvoiceServerFn, id),
    onSuccess: invalidate,
  })

  const resolveDispute = useMutation({
    mutationFn: (id: string) =>
      withIdCall(resolveSupplierInvoiceDisputeServerFn, id),
    onSuccess: invalidate,
  })

  const cancel = useMutation({
    mutationFn: (id: string) => withIdCall(cancelSupplierInvoiceServerFn, id),
    onSuccess: invalidate,
  })

  return { createFromPo, match, submit, post, dispute, resolveDispute, cancel }
}
