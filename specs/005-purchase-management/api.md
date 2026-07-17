# Purchase Management — API Design (Spec 005)

All endpoints are TanStack `createServerFn({ method: 'POST' })` handlers living in
`src/features/purchasing/**` (and a new `src/features/suppliers/**` for supplier CRM).
Every handler follows the established pattern in
[`src/features/purchasing/server-functions.ts`](../../src/features/purchasing/server-functions.ts):

```ts
async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({ accessToken: data.accessToken, tenantId: data.tenantId }),
      data.tenantId,
    ),
    permission,
  )
}

const base = z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema })
const withId = base.extend({ id: idSchema })
```

Conventions:
- `accessToken` + `tenantId` are validated in every input (trust nothing from the client).
- The guard chain `getCurrentUserContext → requireAuth → requireTenantAccess → requirePermission`
  is the tenant-isolation boundary. Permission codes use `purchase.<action_underscored>`.
- Money/quantity `Decimal` values are serialized to strings at the DTO boundary
  (`src/server/inventory/document-dto.ts`), never returned as `Prisma.Decimal`.
- Errors are thrown as `DomainError` subclasses (`ConflictError` 409, `ValidationError` 422,
  `NotFoundError` 404, `ForbiddenError` 403) — see [business-rules.md](./business-rules.md).
- Writes run inside `prisma.$transaction`; posting operations use `RepeatableRead` + 30s timeout.

> This document specifies the API **surface** to be built in later phases. Phase 0 (this pass)
> delivers only the DB foundation + permissions; the handlers below are the contract for Phases 1–7.

## Supplier management (`purchase.supplier_*` reuse `supplier.view` / `supplier.manage`)

| Server function | Method | Permission | Input (Zod) | Returns |
|---|---|---|---|---|
| `listSuppliersServerFn` | POST | `supplier.view` | `base.extend({ search?, categoryId?, statusCode?, page?, pageSize? })` | `{ items: SupplierDto[], total }` |
| `getSupplierServerFn` | POST | `supplier.view` | `withId` | `SupplierDetailDto` (incl. contacts, addresses, banks, balance) |
| `createSupplierServerFn` | POST | `supplier.manage` | `base.extend({ input: supplierCreateSchema })` | `SupplierDto` |
| `updateSupplierServerFn` | POST | `supplier.manage` | `base.extend({ id, input: supplierUpdateSchema })` | `SupplierDto` |
| `deleteSupplierServerFn` | POST | `supplier.manage` | `withId` | `{ id }` (soft delete) |
| `upsertSupplierContactServerFn` | POST | `supplier.manage` | `base.extend({ input: supplierContactSchema })` | `SupplierContactDto` |
| `upsertSupplierAddressServerFn` | POST | `supplier.manage` | `base.extend({ input: supplierAddressSchema })` | `SupplierAddressDto` |
| `upsertSupplierBankAccountServerFn` | POST | `supplier.manage` | `base.extend({ input: supplierBankSchema })` | `SupplierBankDto` |
| `listSupplierCategoriesServerFn` / `upsertSupplierCategoryServerFn` | POST | `supplier.view` / `purchase.config_manage` | `base` / `base.extend({ input })` | `SupplierCategoryDto[]` |

`supplierCreateSchema`: `{ code, name, categoryId?, taxId?, email?, phone?, paymentTerms?, currencyCode, creditLimit?, leadTimeDays?, isPreferred?, rating?, tags? }`.

## Purchase requisitions (`purchase.requisition_*`) — extends existing

| Server function | Permission | Notes |
|---|---|---|
| `listRequisitionsServerFn` / `getRequisitionServerFn` | `purchase.requisition_view` | filters: status, sourceType, department, priority |
| `createPurchaseRequisitionServerFn` | `purchase.requisition_manage` | existing; input extended with `priority?, requiredDate?, department?, sourceType?` |
| `submitRequisitionServerFn` | `purchase.requisition_manage` | opens `pod_approval_request` when a workflow matches |
| `approveRequisitionServerFn` | `purchase.requisition_manage` | via approval engine |
| `convertRequisitionToPoServerFn` / `convertRequisitionToRfqServerFn` | `purchase.po_create` / `purchase.rfq_manage` | |

## RFQ (`purchase.rfq_*`)

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `listRfqsServerFn` / `getRfqServerFn` | `purchase.rfq_view` | filters: statusCode, supplierId | `RfqDto` |
| `createRfqServerFn` | `purchase.rfq_manage` | `{ title?, requisitionId?, warehouseId?, currencyCode, expiryDate?, items[], supplierIds[] }` | `RfqDto` |
| `reviseRfqServerFn` | `purchase.rfq_manage` | bumps `revision` | `RfqDto` |
| `issueRfqServerFn` | `purchase.rfq_manage` | numbering (`RFQ`), emits `rfq.issued` | `RfqDto` |
| `awardRfqServerFn` | `purchase.quotation_award` | sets `awarded_supplier_id`/`awarded_quotation_id`, emits `rfq.awarded` | `RfqDto` |

## Supplier quotations (`purchase.quotation_*`)

| Server function | Permission | Notes |
|---|---|---|
| `listQuotationsServerFn` / `getQuotationServerFn` | `purchase.quotation_view` | comparison matrix keyed by `rfqId` |
| `recordQuotationServerFn` | `purchase.quotation_manage` | numbering (`SUPPLIER_QUOTATION`); totals recomputed by trigger from items |
| `submitQuotationServerFn` / `approveQuotationServerFn` | `purchase.quotation_manage` | state per `pod_status_transitions` |
| `awardQuotationServerFn` | `purchase.quotation_award` | emits `supplier_quotation.approved`, converts to PO |
| `compareQuotationsServerFn` | `purchase.quotation_view` | returns per-line best-price matrix for an RFQ |

## Purchase orders (`purchase.po_*`) — extends existing

Existing: `listPurchaseOrdersServerFn`, `getPurchaseOrderServerFn`, `createPurchaseOrderServerFn`,
`approvePurchaseOrderServerFn`, `confirmPurchaseOrderServerFn`, `cancelPurchaseOrderServerFn`.
Extensions: input accepts `branchId?, exchangeRate?, incoterms?, deliveryAddressJson?,
billingAddressJson?, buyerProfileId?, discountTotal?, quotationId?`; lines accept
`discountPct?, discountAmount?` and expose `rejectedQty/returnedQty/cancelledQty/remainingQty`.
New: `submitPurchaseOrderForApprovalServerFn` (`purchase.po_approve`, opens approval request).

## Goods receipts (`purchase.po_receive`) — extends existing

Existing `createGoodsReceiptServerFn` / `postGoodsReceiptServerFn` (posts `PURCHASE_RECEIPT`
movements through `movement-engine.ts`, updates lots/serials/WAC). Extension: `inspectionStatusCode`,
accepted/rejected/damaged quantities, storage bin (`toLocationId`).

## Supplier invoices + 3-way match (`purchase.invoice_*`)

| Server function | Permission | Notes |
|---|---|---|
| `listSupplierInvoicesServerFn` / `getSupplierInvoiceServerFn` | `purchase.invoice_view` | payables + aging via `pod_v_outstanding_payables` |
| `createSupplierInvoiceServerFn` | `purchase.invoice_manage` | numbering (`SUPPLIER_INVOICE`); header totals from items (trigger) |
| `matchSupplierInvoiceServerFn` | `purchase.invoice_match` | writes `pod_supplier_invoice_matches`, calls `pod_three_way_match()` |
| `approveSupplierInvoiceServerFn` | `purchase.invoice_manage` | via approval engine |
| `postSupplierInvoiceServerFn` | `purchase.invoice_manage` | sets `is_posted`, recomputes supplier balance, emits `supplier_invoice.posted` |

## Supplier payments (`purchase.payment_*`)

| Server function | Permission | Notes |
|---|---|---|
| `listSupplierPaymentsServerFn` / `getSupplierPaymentServerFn` | `purchase.payment_view` | |
| `createSupplierPaymentServerFn` | `purchase.payment_manage` | numbering (`SUPPLIER_PAYMENT`); `isAdvance` supported |
| `allocatePaymentServerFn` | `purchase.payment_manage` | writes `pod_supplier_payment_allocations`, updates invoice `paidAmount`/`paymentStatusCode` |
| `postSupplierPaymentServerFn` | `purchase.payment_manage` | `pod_recompute_supplier_balance()`, emits `supplier_payment.posted` |

## Landed cost (`purchase.landed_cost_manage`)

| Server function | Notes |
|---|---|
| `createLandedCostVoucherServerFn` | numbering (`LANDED_COST`); charges + allocation rows |
| `allocateLandedCostServerFn` | calls `pod_allocate_landed_cost()`; distributes by `allocationBasis` |
| `postLandedCostServerFn` | updates inventory cost via costing service layer; emits `landed_cost.posted` |

## Purchase returns + debit notes (`purchase.return_manage`, `purchase.debit_note_manage`)

Existing return endpoints; new `createDebitNoteServerFn` writes a `financial_notes` header +
`pod_debit_note_lines`, `issueDebitNoteServerFn` emits `financial_note.issued`.

## Approvals (`purchase.approval_action`)

| Server function | Notes |
|---|---|
| `listMyApprovalsServerFn` | pending `pod_approval_requests` for the actor's role/profile |
| `actOnApprovalServerFn` | `approve` / `reject` / `delegate` / `escalate` → writes `pod_approval_actions`, advances `current_step_order`, emits `purchase_approval.decided` |
| `listApprovalWorkflowsServerFn` / `upsertApprovalWorkflowServerFn` | `purchase.config_manage` |

## Cross-cutting

| Server function | Permission | Notes |
|---|---|---|
| `uploadPurchaseAttachmentServerFn` / `listAttachmentsServerFn` | inherits owning-doc permission | polymorphic `pod_attachments` (entityType,entityId) |
| `upsertCustomFieldDefinitionServerFn` | `purchase.config_manage` | `pod_custom_field_definitions` |
| `setCustomFieldValueServerFn` | owning-doc permission | `pod_custom_field_values` |
| `listPurchaseLookupsServerFn` | `purchase.po_view` | statuses, reasons, payment methods, incoterms, landed-cost types |

## Error mapping

| Situation | Error | HTTP |
|---|---|---|
| Missing/invalid token | `UnauthorizedError` | 401 |
| Wrong tenant / missing permission | `ForbiddenError` | 403 |
| Document/record not found | `NotFoundError` | 404 |
| Business-rule violation (empty lines, already posted, illegal transition, over-allocation) | `ConflictError` | 409 |
| Input fails Zod / invariant | `ValidationError` | 422 |
| Supabase unavailable | `ServiceUnavailableError` | 503 |
