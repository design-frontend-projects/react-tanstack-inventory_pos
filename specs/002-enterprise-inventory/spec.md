# Feature 002 — Enterprise Inventory, Warehouse & Transaction Engine

## Summary

Ledger-first, multi-tenant inventory/ERP core built on the existing auth/RBAC/tenant
foundation (feature 001). Supersedes 001's simplified inventory/POS entities
(`CatalogItem`, mutable `StockRecord`, thin `StockMovement`, `PosOrder`), which were
never migrated.

**Core principle (non-negotiable):** stock quantities are never mutated directly.
Inventory is driven only by an immutable `InventoryMovement` ledger; the
`StockBalance` projection is updated exclusively by the `postMovement` engine inside
a database transaction under row lock. Business documents (WHY) are separate from
inventory movements (HOW) and *post* movements through their lifecycle actions.

## Goals

- Proper inventory accounting, valuation (Moving Weighted Average first; FIFO/Standard/Landed retained via cost layers), and full auditability.
- Accurate stock tracking at grain: tenant × product × variant × location × lot × serial.
- Warehouse management with unlimited location hierarchy (Zone→Bin).
- A generic transaction engine + concrete document tables (sales, purchasing, transfers, adjustments, counts, manufacturing), each with its own lifecycle state machine.
- High-performance stock lookup and movement history at millions-of-rows scale.
- Support for retail, restaurant, pharmacy (batch/expiry), and manufacturing verticals.

## Non-goals (this feature)

- Re-implementing auth/RBAC/tenant onboarding (feature 001 owns these).
- Financial GL/accounting beyond inventory valuation and AP/AR payment capture.

## User stories (prioritized)

- **US1 (P1) — Catalog & master data.** Manage products (simple/variant/bundle/kit/service), UoM + conversions, categories, brands, barcodes, price lists, suppliers, customers, tax rates. *(Phase 1 — implemented.)*
- **US2 (P1) — Warehousing.** Warehouses and unlimited location hierarchy. *(Phase 2.)*
- **US3 (P1) — Ledger core.** Immutable movement ledger, materialized balance, `postMovement` engine, WAC costing, opening balances, stock adjustments. *(Phase 3 — keystone.)*
- **US4 (P2) — Transfers, Purchasing, Sales/POS, Returns.** Document lifecycles that post movements. *(Phases 4–7.)*
- **US5 (P2) — Reservations, Batch/Serial/Expiry, Manufacturing, Reorder/Valuation reporting.** *(Phases 8–11.)*

## Key rules

- `StockBalance.onHand == Σ InventoryMovement.qtyDelta` for every grain (reconstructable ledger).
- `available = onHand − reserved − allocated`, never negative for issue-type movements unless the warehouse allows negative stock.
- Money `Decimal(19,4)`, quantity `Decimal(18,4)`, unit cost `Decimal(19,6)`; round only at document/report boundaries.
- Every tenant-scoped server function chains `requireAuth → requireTenantAccess → requirePermission`.

See [data-model.md](./data-model.md), [plan.md](./plan.md), and [tasks.md](./tasks.md).
The full architecture rationale lives in the master plan at
`~/.claude/plans/act-as-a-principal-glimmering-dawn.md`.
