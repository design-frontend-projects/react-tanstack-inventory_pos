# Purchase Management — Task Breakdown (Spec 005)

Phased checklist. **Phase 0 is delivered in this pass** (DB foundation + permissions + events +
docs). Phases 1–7 build the services/UI/tests on top of the foundation, reusing the existing
purchasing infrastructure.

## Phase 0 — DB foundation & catalog (this pass)

- [x] Add `pod_*` models + non-breaking column extensions to `prisma/schema.prisma`; register `TenantAccount` back-relations.
- [x] Add `DocumentType` enum values: `rfq`, `supplier_quotation`, `supplier_invoice`, `supplier_payment`, `landed_cost`.
- [x] Hand-author migration `prisma/migrations/20260717090000_purchase_management_enterprise_v1/migration.sql` — tables, constraints, indexes, generated `remaining_qty`, functions, triggers, views, materialized views, RLS, seed lookups.
- [x] Add `purchase.*` permissions to `rbac-catalog.ts`; grant to `admin` + `purchasing_officer`.
- [x] Add `purchase` module + screens + repoint `PERMISSION_LINKS` in `module-catalog.ts`.
- [x] Add `nav.purchase*` i18n keys (`en` + `ar`).
- [x] Add purchasing domain event types to `domain-event-types.ts`.
- [x] Map new `DocumentType` prefixes in `document-number-service.ts`.
- [x] Update `tests/unit/purchasing-transfers.test.ts` for the repointed module + new codes.
- [x] Author spec-kit docs (`spec/plan/data-model/erd/state-diagrams/sequence-diagrams/integration/api/business-rules/performance/tasks`).
- [x] Apply: `pnpm prisma migrate deploy` → `pnpm prisma generate` → `pnpm db:seed` (user-confirmed; mutates DB).
- [x] Seed a default per-tenant approval workflow in `prisma/seed.ts` (`pod_approval_workflows` is `tenant_id NOT NULL`).

## Phase 1 — Supplier CRM

- [x] Repos: `supplier-repo.ts` (extend), `pod-supplier-contact-repo.ts`, `pod-supplier-address-repo.ts`, `pod-supplier-bank-repo.ts`, `pod-supplier-category-repo.ts`.
- [x] DTO serializers in `document-dto.ts` (Decimal→string for `current_balance`, `rating`).
- [x] Feature module `src/features/suppliers/` — server functions + Zod `validation.ts`.
- [x] Routes `src/routes/_app/purchase/suppliers.tsx` (+ detail) using `WorkspacePage`.
- [x] Unit tests: repo tenant-scoping, soft-delete, validation.

## Phase 2 — RFQ → Quotation → award

- [x] Repos: `pod-rfq-repo.ts`, `pod-supplier-quotation-repo.ts`.
- [x] Services: `rfq-service.ts` (create/revise/issue/award), `quotation-service.ts` (record/submit/approve/compare) — numbering, `pod_status_transitions` validation, `appendDomainEvent`, `createAuditLog`.
- [x] Comparison-matrix query per RFQ.
- [x] Server functions + routes `purchase/rfqs.tsx`, `purchase/quotations.tsx`.
- [x] Tests: RFQ lifecycle, award→PO conversion, comparison matrix.

## Phase 3 — Generic approval engine

- [x] Repos: `pod-approval-workflow-repo.ts`, `pod-approval-request-repo.ts`, `pod-approval-action-repo.ts`.
- [x] `approval-service.ts` — open request (amount/entity routing), act (approve/reject/delegate/escalate), advance `current_step_order`, escalation timer semantics, emit `purchase_approval.decided`.
- [x] Wire PR/PO/invoice submit flows to open approval requests.
- [x] Routes: `purchase/approvals.tsx` (my-approvals inbox).
- [x] Tests: multi-level routing, amount thresholds, delegation, escalation.

## Phase 4 — Supplier invoices + 3-way match (AP)

- [x] Repos: `pod-supplier-invoice-repo.ts`, `pod-supplier-invoice-match-repo.ts`.
- [x] `supplier-invoice-service.ts` — create (numbering, trigger totals), match (`pod_three_way_match`), approve, post (supplier balance, emit `supplier_invoice.posted`/`.matched`).
- [x] Debit-note extension: `pod_debit_note_lines` on `financial_notes`.
- [x] Routes: `purchase/invoices.tsx`.
- [x] Tests: 3-way match variance/tolerance, partial invoicing, outstanding recompute.

## Phase 5 — Landed cost

- [x] Repos: `pod-landed-cost-*-repo.ts`.
- [x] `landed-cost-service.ts` — voucher + charges, `pod_allocate_landed_cost`, post → update inventory average/FIFO cost via costing service, emit `landed_cost.posted`.
- [x] Tests: allocation by quantity/weight/volume/value/manual; cost update correctness.

## Phase 6 — Supplier payments (AP)

- [x] Repos: `pod-supplier-payment-repo.ts`, `pod-supplier-payment-allocation-repo.ts`.
- [x] `supplier-payment-service.ts` — create (numbering), allocate (update invoice paid/status), advance payments, post (`pod_recompute_supplier_balance`, emit `supplier_payment.posted`).
- [x] Routes: `purchase/payments.tsx`.
- [x] Tests: allocation, advances, over-allocation guard, balance/aging.

## Phase 7 — Reporting, notifications, hardening

- [x] On-demand matview refresh (`refreshPurchaseReportingServerFn`, config-gated; handles the WITH NO DATA first refresh non-concurrently). A cron scheduler is still an infra follow-up.
- [x] Reporting over `pod_v_*` and `pod_mv_*` — live purchasing overview (`/purchase`): AP aging, supplier balances, spend trend, supplier performance, open-PO exposure, 3-way-match exceptions.
- [x] **Notification service built** — `pod_notifications` table + service; approval routing/decisions/delegations write transactional in-app alerts; inbox on the purchasing overview.
- [x] **RLS GUC helper** — `withTenantRls(tenantId, fn)` (`src/server/db/tenant-rls.ts`) sets the GUC with SET LOCAL semantics inside a transaction; ready for any future non-owner DB role (the pooled owner connection bypasses RLS by design).
- [x] Attachments metadata + custom-field server API (register/list/delete, definitions + values with required/unknown-key validation). Storage-bucket upload UI still pending.
- [ ] Partitioning + extra indexes if volume warrants (see performance.md).
- [ ] E2E flows (Playwright): PR→PO→GRN→Invoice→Payment; RFQ→Quotation→PO.

## Cross-cutting definition of done (per phase)

- [ ] `pnpm smoke` green (lint + typecheck + test).
- [ ] 80%+ unit coverage on new services/repos.
- [ ] Every tenant-scoped server function chains `requireAuth → requireTenantAccess → requirePermission`.
- [ ] No new Prisma enums (statuses via `pod_document_statuses`); Decimal serialized at DTO boundary.
