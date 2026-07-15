import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as goodsReceiptService from '#/server/inventory/documents/goods-receipt-service'
import * as poService from '#/server/inventory/documents/purchase-order-service'
import * as returnService from '#/server/inventory/documents/purchase-return-service'
import * as requisitionService from '#/server/inventory/documents/purchase-requisition-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  goodsReceiptCreateSchema,
  purchaseOrderCreateSchema,
  purchaseReturnCreateSchema,
  requisitionConvertSchema,
  requisitionCreateSchema,
} from '#/features/purchasing/validation'

const accessTokenSchema = z.string().min(1)
const tenantIdSchema = z.string().uuid()
const idSchema = z.string().uuid()

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId
    ),
    permission
  )
}

const base = z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema })
const withId = base.extend({ id: idSchema })

// --- Requisitions -----------------------------------------------------------

export const listRequisitionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.requisition_view')

    return requisitionService.listRequisitions(context, data.tenantId)
  })

export const getRequisitionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.requisition_view')

    return requisitionService.getRequisition(context, data.tenantId, data.id)
  })

export const createRequisitionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: requisitionCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.requisition_manage')

    return requisitionService.createRequisition(context, data.tenantId, data.input)
  })

export const submitRequisitionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.requisition_manage')

    return requisitionService.submitRequisition(context, data.tenantId, data.id)
  })

export const approveRequisitionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.requisition_manage')

    return requisitionService.approveRequisition(context, data.tenantId, data.id)
  })

export const convertRequisitionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: requisitionConvertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.requisition_manage')

    return requisitionService.convertRequisitionToPurchaseOrder(
      context,
      data.tenantId,
      data.id,
      data.input
    )
  })

// --- Purchase orders --------------------------------------------------------

export const listPurchaseOrdersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_view')

    return poService.listPurchaseOrders(context, data.tenantId)
  })

export const getPurchaseOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_view')

    return poService.getPurchaseOrder(context, data.tenantId, data.id)
  })

export const createPurchaseOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: purchaseOrderCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_create')

    return poService.createPurchaseOrder(context, data.tenantId, data.input)
  })

export const approvePurchaseOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_approve')

    return poService.approvePurchaseOrder(context, data.tenantId, data.id)
  })

export const confirmPurchaseOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_approve')

    return poService.confirmPurchaseOrder(context, data.tenantId, data.id)
  })

export const cancelPurchaseOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_approve')

    return poService.cancelPurchaseOrder(context, data.tenantId, data.id)
  })

// --- Goods receipts ---------------------------------------------------------

export const listGoodsReceiptsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_view')

    return goodsReceiptService.listGoodsReceipts(context, data.tenantId)
  })

export const getGoodsReceiptServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_view')

    return goodsReceiptService.getGoodsReceipt(context, data.tenantId, data.id)
  })

export const createGoodsReceiptServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: goodsReceiptCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_receive')

    return goodsReceiptService.createGoodsReceipt(context, data.tenantId, data.input)
  })

export const postGoodsReceiptServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_receive')

    return goodsReceiptService.postGoodsReceipt(context, data.tenantId, data.id)
  })

// --- Purchase returns -------------------------------------------------------

export const listPurchaseReturnsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_view')

    return returnService.listPurchaseReturns(context, data.tenantId)
  })

export const getPurchaseReturnServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_view')

    return returnService.getPurchaseReturn(context, data.tenantId, data.id)
  })

export const createPurchaseReturnServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: purchaseReturnCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.return_manage')

    return returnService.createPurchaseReturn(context, data.tenantId, data.input)
  })

export const postPurchaseReturnServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.return_manage')

    return returnService.postPurchaseReturn(context, data.tenantId, data.id)
  })
