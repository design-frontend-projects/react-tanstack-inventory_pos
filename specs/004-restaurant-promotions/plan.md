# Implementation Plan — Feature 004 (Restaurant Management & Promotions)

## Summary

Deliver a production-grade restaurant domain as Prisma `res_`-prefixed models appended to the single
`prisma/schema.prisma`, with app-layer services/repos, tenant isolation via the existing guard
chain, and integration with Inventory/CRM/Financial through the `domain_events` outbox. Shipped as
**10 numbered phases**, each independently migratable, `smoke`-green, and testable. Data-model docs
are bilingual (EN/AR); a Mermaid ERD accompanies each domain.

## Technical context

- **Stack:** TanStack Start (SSR React 19), Prisma 7 (`prisma-client` generator → `src/server/db/
  generated/prisma`), PostgreSQL, Supabase identity, Zustand + TanStack Query, i18next (en/ar).
- **Package manager:** pnpm. Dev server on :3005.
- **Existing modules reused:** inventory (products, movements, reservations, lots), CRM (loyalty,
  segments, metrics, `domain_events` outbox), POS/sales, auth/RBAC (dynamic registry seeded from
  `rbac-catalog.ts` + `module-catalog.ts`).
- **Testing:** vitest (unit, `tests/unit/restaurant-*.test.ts`), Playwright (e2e, later phases).
  DB-integration deferred/harness-gated per existing convention.

## Constitution check

`.specify/memory/constitution.md` is still the unfilled template; the check is nominal. The de-facto
constitution this plan honors, drawn from features 001–003:
- Prisma is the single source of truth; snake_case `@map`/`@@map`; camelCase model fields.
- Tenant isolation is app-enforced via guards; every table is RLS-ready (`tenant_id NOT NULL`).
- Cross-aggregate references are bare scalar UUIDs (app-enforced integrity); only `tenant` (and
  tight parent→child) are real relations.
- Business logic in services/repos, not DB triggers. Events appended in the same transaction.
- No hardcoded business rules — configuration-driven.

## Project structure

```
specs/004-restaurant-promotions/
  spec.md              # this feature's spec (done)
  plan.md              # this file
  data-model.md        # bilingual EN/AR entity catalog, phase-structured
  erd.md               # Mermaid ERDs per domain
  promotions-engine.md # rule-evaluation architecture & flow
  integration.md       # Inventory / CRM / Financial / RBAC integration contracts
  tasks.md             # phased task checklist with file paths

prisma/
  schema.prisma                                  # append res_ models + enums; extend TenantAccount
  migrations/<ts>_restaurant_<slug>_phaseN/      # one folder per phase

src/
  features/restaurant/<domain>/                  # server-functions.ts + validation.ts (+ hooks/stores)
  server/restaurant/<domain>/<name>-service.ts   # business logic, transactions, event emission
  server/repos/res-<aggregate>-repo.ts           # tenant-scoped data access (plain functions)
  server/events/domain-event-types.ts            # + restaurant_* event types
  routes/_app/restaurant/*.tsx                    # wired routes (replace placeholders)
  features/auth/rbac-catalog.ts                   # + res.* permissions / res: roles / map
  features/auth/module-catalog.ts                 # + screens / actions / permission links
  lib/i18n/resources/{en,ar}/common.json          # + nav + screen labels

tests/unit/restaurant-*.test.ts                   # per-phase unit tests
```

## Phasing (see tasks.md for the checklist)

| Phase | Domain | Key deliverable |
|-------|--------|-----------------|
| 0 | Foundation | specs/004 docs (all domains), shared enums, `restaurant_*` event types |
| 1 | Master data | restaurants, branches, tables, service types, stations, tax/charge configs, sequences |
| 2 | Menu | menus, categories, items, variants, price rules, modifiers, combos, allergens |
| 3 | Recipes | recipe versions/lines binding menu → inventory products; costing, approval |
| 4 | Orders | order lifecycle, splits/transfers, payments, inventory consumption, events |
| 5 | KDS | kitchen tickets, station routing, queue, timers, performance |
| 6 | Reservations | reservations, walk-ins, waitlist, deposits, auto-allocation |
| 7 | Promotions | configurable conditions+actions rule engine, applications ledger |
| 8 | Coupons/Loyalty/Gift cards | coupon batches, CRM loyalty bridge, gift-card wallet |
| 9 | Campaigns | campaigns, segment targeting, promotion assignment, metrics |
| 10 | Reporting | projection tables + report server functions |

**Sequencing note:** Phase 0 + Phase 1 land first as the reviewable foundation. Phases 2→10 build
on it. Each phase is a self-contained, mergeable increment.

## Risks & mitigations
- **Schema size** — `schema.prisma` grows large; mitigate with clear phase-banner comments and the
  data-model.md as the human index.
- **Migration drift on Supabase** (`auth.uid()` default drift) — prefer applying migrations with a
  clean shadow DB; generate SQL and review before deploy.
- **Promotion engine complexity** — isolate as a pure, table-driven `promotion-engine.ts` with the
  richest unit-test surface; no engine logic leaks into services.
- **Inventory coupling** — restaurant calls inventory services (never writes `inventory_movements`
  directly) so costing/valuation invariants stay owned by inventory.
