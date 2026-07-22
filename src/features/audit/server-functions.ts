import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import { listAuditLogsForEntity } from '#/server/repos/audit-log-repo'

// Entity-scoped audit trail reads. Each entity type maps to the permission(s)
// that already gate viewing that entity, so seeing the trail never grants more
// than seeing the record itself. Unknown entity types fall back to the tenant
// settings permission held only by admins.

const ENTITY_VIEW_PERMISSIONS: Record<string, Array<string>> = {
  product: ['product.view'],
  brand: ['product.view'],
  product_category: ['product.view'],
  uom: ['product.view'],
  price_list: ['product.view', 'product.manage_pricing'],
  product_price: ['product.view', 'product.manage_pricing'],
  warehouse: ['warehouse.view'],
  warehouse_location: ['warehouse.view'],
  stock_adjustment: ['adjustment.view'],
  stock_transfer: ['transfer.view'],
  stock_count_session: ['inventory.count_view'],
  stock_reservation: ['inventory.view_stock'],
  supplier: ['supplier.view', 'supplier.manage'],
  purchase_order: ['purchase.po_view'],
  purchase_requisition: ['purchase.requisition_view'],
  goods_receipt: ['purchase.po_receive', 'purchase.po_view'],
  purchase_return: ['purchase.return_manage'],
}

const FALLBACK_PERMISSIONS = ['tenant.manage_settings']

export const listEntityAuditTrailServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: z.string().min(1),
      tenantId: z.string().uuid(),
      entityType: z.string().min(1).max(100),
      entityId: z.string().min(1).max(100),
      limit: z.number().int().min(1).max(200).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const permissions =
      ENTITY_VIEW_PERMISSIONS[data.entityType] ?? FALLBACK_PERMISSIONS

    requirePermission(
      requireTenantAccess(
        await getCurrentUserContext({
          accessToken: data.accessToken,
          tenantId: data.tenantId,
        }),
        data.tenantId,
      ),
      permissions,
    )

    return listAuditLogsForEntity(
      data.tenantId,
      data.entityType,
      data.entityId,
      data.limit ?? 50,
    )
  })
