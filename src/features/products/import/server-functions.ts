import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { importProducts } from '#/server/inventory/product-import-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import {
  PRODUCT_IMPORT_MAX_ROWS,
  productImportRowSchema,
} from '#/features/products/import/import-schema'

// CSV product import boundary. Rows are re-validated server-side with the
// same schema the wizard uses for its preview.

export const importProductsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: z.string().min(1),
      tenantId: z.string().uuid(),
      rows: z.array(productImportRowSchema).min(1).max(PRODUCT_IMPORT_MAX_ROWS),
    }),
  )
  .handler(async ({ data }) => {
    const context = requirePermission(
      requireTenantAccess(
        await getCurrentUserContext({
          accessToken: data.accessToken,
          tenantId: data.tenantId,
        }),
        data.tenantId,
      ),
      'product.create',
    )

    return importProducts(context, data.tenantId, data.rows)
  })
