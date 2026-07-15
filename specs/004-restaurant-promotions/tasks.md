# Tasks — Feature 004 (Restaurant Management & Promotions)

Legend: `[P]` parallelizable · story tags `[US1..US4]`. Each phase ends with `pnpm smoke` green and
a clean migration. File paths are exact.

## Phase 0 — Foundation ✅ (in progress)
- [x] T001 specs/004 docs: spec.md, plan.md, data-model.md (EN/AR), erd.md, promotions-engine.md,
  integration.md, tasks.md — `specs/004-restaurant-promotions/*`
- [ ] T002 Add `restaurant_*` event types + payload interfaces — `src/server/events/domain-event-types.ts`

## Phase 1 — Master data [US1]
- [ ] T010 Add Phase-1 enums + models to `prisma/schema.prisma`; add back-relation arrays to
  `TenantAccount` (`res_restaurants` … `res_branch_settings`)
- [ ] T011 Migration `prisma/migrations/<ts>_restaurant_master_data_phase1/`; `pnpm prisma generate`
- [ ] T012 [P] Repos — `src/server/repos/res-restaurant-repo.ts`, `res-branch-repo.ts`,
  `res-table-repo.ts`, `res-service-type-repo.ts`, `res-kitchen-station-repo.ts`,
  `res-tax-config-repo.ts`, `res-number-sequence-repo.ts`
- [ ] T013 [P] Validation — `src/features/restaurant/master-data/validation.ts`
- [ ] T014 Services — `src/server/restaurant/master-data/*-service.ts` (branch provisioning creates
  default sequences + settings)
- [ ] T015 Server functions — `src/features/restaurant/master-data/server-functions.ts`
- [ ] T016 RBAC — add `res.settings.manage` links/screens for master data; extend
  `SCREEN_DEFINITIONS`/`SCREEN_ACTION_DEFINITIONS`/`PERMISSION_LINKS` and `ROLE_PERMISSION_MAP`
  (`rbac-catalog.ts`, `module-catalog.ts`)
- [ ] T017 Routes — `src/routes/_app/restaurant/settings.tsx` (+ wire tables.tsx)
- [ ] T018 i18n en/ar keys — `src/lib/i18n/resources/{en,ar}/common.json`
- [ ] T019 Unit tests — `tests/unit/restaurant-master-data.test.ts` (repo tenant scoping, guard
  enforcement, sequence issuance)

## Phase 2 — Menu [US1]
- [ ] T020 enums+models (`res_menus`…`res_cross_sells`) + migration + generate
- [ ] T021 [P] repos + validation; T022 services (pricing resolver); T023 server-fns
- [ ] T024 RBAC (`res.menu.*`), routes (`menu.tsx`), i18n, tests (pricing resolver matrix)

## Phase 3 — Recipes [US1]
- [ ] T030 models + migration; T031 repos/validation/services (cost recompute via inventory)
- [ ] T032 server-fns, RBAC (`res.recipe.*`), tests (cost, versioning, approval)

## Phase 4 — Orders [US2]
- [ ] T040 models + migration; T041 order-service state machine; T042 inventory reserve/consume
  integration; T043 domain-event emission; T044 server-fns/routes/RBAC; T045 tests (transitions,
  splits, consumption, event shape)

## Phase 5 — KDS [US2]
- [ ] T050 models + migration; T051 ticket routing + queue projection; T052 server-fns/routes
  (`kitchen.tsx`)/RBAC; T053 tests (routing, timers, status)

## Phase 6 — Reservations [US4]
- [ ] T060 models + migration; T061 auto-allocation service (no double-book); T062 server-fns/
  routes/RBAC; T063 tests

## Phase 7 — Promotions engine [US3]
- [ ] T070 models + migration (`res_promotions`…`res_promotion_applications`)
- [ ] T071 pure `promotion-engine.ts`; T072 pricing integration in order-service; T073 server-fns/
  routes/RBAC (`res.promo.*`); T074 tests (condition/action matrix, stacking, limits, immutability)

## Phase 8 — Coupons/Loyalty/Gift cards [US3][US4]
- [ ] T080 models + migration; T081 coupon validation/redemption; T082 gift-card wallet; T083 CRM
  loyalty redeem bridge; T084 server-fns/RBAC; T085 tests

## Phase 9 — Campaigns [US4]
- [ ] T090 models + migration; T091 segment targeting + promotion assignment; T092 metrics
  projection; T093 server-fns/routes/RBAC; T094 tests

## Phase 10 — Reporting [US4]
- [ ] T100 projection tables + migration; T101 restaurant projector consuming `restaurant_*` events;
  T102 report server-fns; T103 optional materialized views; T104 tests

## Cross-cutting (each phase)
- [ ] Guard chain on every server fn; Zod on every input.
- [ ] `pnpm smoke` green; migration applies; `pnpm db:seed` runs without catalog-mismatch throw.
- [ ] en/ar i18n keys for any new nav/screen labels.
