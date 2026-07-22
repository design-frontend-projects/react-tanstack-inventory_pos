'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { importProductsServerFn } from '#/features/products/import/server-functions'
import type { ProductImportRow } from '#/features/products/import/import-schema'
import type { ProductImportSummary } from '#/server/inventory/product-import-service'

// Runs the import in chunks so large files stay under the request-size limit,
// then merges the per-chunk summaries and refreshes the product queries.

const CHUNK_SIZE = 100

export function useProductImport() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useMutation({
    mutationFn: async (
      rows: Array<ProductImportRow>,
    ): Promise<ProductImportSummary> => {
      const accessToken = await getAccessToken()

      if (!accessToken || !tenantId) {
        throw new Error(
          'Sign in and select a workspace before importing products.',
        )
      }

      const merged: ProductImportSummary = {
        created: 0,
        skipped: 0,
        failed: 0,
        results: [],
      }

      for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
        const chunk = rows.slice(offset, offset + CHUNK_SIZE)
        const summary = await importProductsServerFn({
          data: { accessToken, tenantId, rows: chunk },
        })

        merged.created += summary.created
        merged.skipped += summary.skipped
        merged.failed += summary.failed
        merged.results.push(
          // Re-anchor chunk-local row numbers to the full file.
          ...summary.results.map((result) => ({
            ...result,
            row: result.row + offset,
          })),
        )
      }

      return merged
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', tenantId] })
      queryClient.invalidateQueries({
        queryKey: ['inventory-analytics', tenantId],
      })
    },
  })
}
