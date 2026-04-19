# Tasks: Multitenant Inventory and POS Foundation

**Input**: Design documents from `/specs/001-multitenant-pos-foundation/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/app-api.openapi.yaml](./contracts/app-api.openapi.yaml), [quickstart.md](./quickstart.md)

**Tests**: Include automated contract, integration, and e2e coverage because the implementation plan and quickstart require critical flows and API contracts to be validated before feature completion.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and demonstrated independently once Setup and Foundational work are complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes the exact file path(s) it changes

## Path Conventions

- App source: `src/`
- Database schema and seeds: `prisma/`
- Public browser/service-worker assets: `public/`
- Automated tests: `tests/`
- Feature planning artifacts: `specs/001-multitenant-pos-foundation/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the TanStack Start project and baseline repo configuration.

- [ ] T001 Scaffold the TanStack Start application in `package.json`, `tsconfig.json`, `vite.config.ts`, and `src/router.tsx`
- [ ] T002 Install and pin runtime/dev dependencies in `package.json`, `pnpm-lock.yaml`, and `components.json`
- [ ] T003 [P] Create the base directory skeleton and placeholder entry files under `src/`, `prisma/`, `public/onesignal/`, and `tests/`
- [ ] T004 [P] Normalize environment template and local secret ignore rules in `.env.example` and `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish core application plumbing that blocks all user stories.

**Critical**: No user story work should start until this phase is complete.

- [ ] T005 [P] Add shared test tooling and setup in `vitest.config.ts`, `playwright.config.ts`, and `tests/setup.ts`
- [ ] T006 Implement runtime environment schemas and loaders in `src/lib/env/client.ts` and `src/lib/env/server.ts`
- [ ] T007 [P] Configure the root query client and application providers in `src/lib/query/query-client.ts`, `src/routes/__root.tsx`, and `src/router.tsx`
- [ ] T008 [P] Configure theme tokens and provider wiring in `src/styles/globals.css`, `src/lib/theme/theme-provider.tsx`, and `src/components/layout/theme-toggle.tsx`
- [ ] T009 [P] Configure i18n bootstrap and base translation resources in `src/lib/i18n/index.ts`, `src/lib/i18n/resources/en/common.json`, and `src/lib/i18n/resources/ar/common.json`
- [ ] T010 Add foundational tenant, user, membership, and preference models plus the initial migration in `prisma/schema.prisma` and `prisma/migrations/`
- [ ] T011 Implement the Prisma client and shared database access helpers in `src/server/db/client.ts` and `src/server/db/tenant-context.ts`
- [ ] T012 Implement browser, server, and admin Supabase clients in `src/lib/supabase/client.ts`, `src/server/auth/supabase-server.ts`, and `src/server/auth/supabase-admin.ts`
- [ ] T013 Implement tenant-safe session and permission guard services in `src/server/auth/session.ts`, `src/server/auth/tenant-guard.ts`, and `src/types/auth.ts`
- [ ] T014 [P] Add foundational session contract and integration coverage in `tests/contract/session.contract.test.ts` and `tests/integration/session-preferences.test.ts`
- [ ] T015 Create the authenticated app shell and bootstrap hook in `src/components/layout/app-shell.tsx` and `src/features/auth/use-session-bootstrap.ts`

**Checkpoint**: Foundation ready. User story work can now proceed.

---

## Phase 3: User Story 1 - Launch a Tenant Workspace (Priority: P1)

**Goal**: Let a tenant user sign in, select a workspace, and reach a dashboard that preserves tenant, theme, and locale context.

**Independent Test**: A tenant user can sign in, switch to an allowed tenant, refresh the page, and still see the selected workspace, theme mode, and language on the dashboard.

- [ ] T016 [P] [US1] Add e2e coverage for sign-in, tenant selection, theme switching, and locale switching in `tests/e2e/us1-tenant-workspace.spec.ts`
- [ ] T017 [US1] Implement membership and preference repositories for tenant switching and persistence in `src/server/repos/membership-repo.ts` and `src/server/repos/preference-repo.ts`
- [ ] T018 [US1] Implement session bootstrap and active-tenant API routes in `src/routes/api/session/bootstrap.ts` and `src/routes/api/session/active-tenant.ts`
- [ ] T019 [P] [US1] Build the sign-in and tenant-selection routes in `src/routes/_auth/sign-in.tsx` and `src/routes/_auth/select-tenant.tsx`
- [ ] T020 [P] [US1] Build the dashboard landing route and shell navigation components in `src/routes/_app/dashboard.tsx` and `src/components/layout/sidebar-nav.tsx`
- [ ] T021 [US1] Connect locale/theme persistence and tenant bootstrap hydration in `src/routes/__root.tsx`, `src/features/preferences/preferences-store.ts`, and `src/components/layout/language-switcher.tsx`

**Checkpoint**: User Story 1 is independently functional and can serve as the MVP.

---

## Phase 4: User Story 2 - Manage Products, Stock, and Outlets (Priority: P2)

**Goal**: Let tenant operators manage outlets, catalog items, outlet stock, and reusable outlet map views.

**Independent Test**: An operator can create an outlet, create a catalog item, update outlet stock, and see outlet locations rendered on the shared map UI without touching POS functionality.

- [ ] T022 [P] [US2] Add contract and e2e coverage for outlet and inventory flows in `tests/contract/outlets-catalog.contract.test.ts` and `tests/e2e/us2-inventory-outlets.spec.ts`
- [ ] T023 [US2] Add outlet, catalog, stock, and stock-movement models plus migration updates in `prisma/schema.prisma` and `prisma/migrations/`
- [ ] T024 [US2] Implement outlet, catalog, and stock repositories/services in `src/server/repos/outlet-repo.ts`, `src/server/repos/catalog-repo.ts`, `src/server/repos/stock-repo.ts`, and `src/server/services/inventory-service.ts`
- [ ] T025 [US2] Implement outlet and catalog API routes in `src/routes/api/outlets.ts` and `src/routes/api/catalog/items.ts`
- [ ] T026 [P] [US2] Build the reusable Google Maps location module in `src/components/maps/google-map.tsx`, `src/components/maps/outlet-markers.tsx`, and `src/components/maps/outlet-map-card.tsx`
- [ ] T027 [P] [US2] Create outlet management routes and forms in `src/routes/_app/outlets/index.tsx`, `src/routes/_app/outlets/$outletId.tsx`, and `src/features/outlets/outlet-form.tsx`
- [ ] T028 [P] [US2] Create catalog and stock management routes/components in `src/routes/_app/inventory/index.tsx`, `src/routes/_app/inventory/$itemId.tsx`, `src/features/inventory/catalog-form.tsx`, and `src/features/inventory/stock-table.tsx`
- [ ] T029 [US2] Wire outlet queries, map rendering, and stock availability state into the shell in `src/features/outlets/use-outlets-query.ts`, `src/features/inventory/use-stock-query.ts`, and `src/features/inventory/availability-badge.tsx`

**Checkpoint**: User Story 2 is independently functional with tenant-safe inventory and outlet workflows.

---

## Phase 5: User Story 3 - Run POS Transactions and Receive Alerts (Priority: P3)

**Goal**: Let authorized tenant users create and complete POS orders while registering browser subscriptions and sending tenant-scoped operational notifications.

**Independent Test**: A cashier can create and complete a POS order that updates stock, while a subscribed user receives a tenant-scoped browser notification or test alert from the notification settings flow.

- [ ] T030 [P] [US3] Add contract and e2e coverage for POS checkout and notification flows in `tests/contract/pos-notifications.contract.test.ts` and `tests/e2e/us3-pos-notifications.spec.ts`
- [ ] T031 [US3] Add POS order, POS order line, notification subscription, and notification event models plus migration updates in `prisma/schema.prisma` and `prisma/migrations/`
- [ ] T032 [US3] Implement POS order and stock-movement repositories/services in `src/server/repos/pos-order-repo.ts`, `src/server/repos/stock-movement-repo.ts`, and `src/server/services/pos-service.ts`
- [ ] T033 [US3] Implement OneSignal subscription and event delivery services in `src/server/notifications/onesignal-client.ts`, `src/server/notifications/subscription-service.ts`, and `src/server/notifications/event-service.ts`
- [ ] T034 [US3] Implement POS and notification API routes in `src/routes/api/pos/orders.ts`, `src/routes/api/pos/orders.$orderId.complete.ts`, `src/routes/api/notifications/subscriptions.ts`, and `src/routes/api/notifications/test.ts`
- [ ] T035 [P] [US3] Create the POS draft Zustand store and order-entry components in `src/features/pos/pos-draft-store.ts`, `src/features/pos/order-entry.tsx`, and `src/features/pos/order-summary.tsx`
- [ ] T036 [P] [US3] Add browser notification bootstrap and permission UI in `public/onesignal/OneSignalSDKWorker.js`, `src/features/notifications/use-web-push.ts`, and `src/features/notifications/notification-permission-banner.tsx`
- [ ] T037 [P] [US3] Create POS and notification settings routes in `src/routes/_app/pos/index.tsx`, `src/routes/_app/pos/$orderId.tsx`, and `src/routes/_app/settings/notifications.tsx`
- [ ] T038 [US3] Connect POS completion, stock updates, and tenant-scoped alert creation in `src/features/pos/use-complete-order.ts`, `src/server/services/pos-service.ts`, and `src/server/notifications/event-service.ts`

**Checkpoint**: User Story 3 is independently functional with POS completion and tenant-scoped notification workflows.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Close out cross-story hardening, validation, and documentation.

- [ ] T039 [P] Document local setup, secret naming, and verification commands in `README.md` and `.env.example`
- [ ] T040 [P] Add local seed and smoke-runner commands in `prisma/seed.ts` and `package.json`
- [ ] T041 Harden permission checks and server-only secret usage across APIs in `src/server/auth/tenant-guard.ts`, `src/lib/env/server.ts`, and `src/routes/api/notifications/test.ts`
- [ ] T042 Run the quickstart validation pass and update any corrected workflow notes in `specs/001-multitenant-pos-foundation/quickstart.md` and `README.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and starts immediately.
- **Phase 2: Foundational** depends on Setup and blocks all user stories.
- **Phase 3: US1** depends on Foundational completion.
- **Phase 4: US2** depends on Foundational completion and can proceed independently of US1 if staffed separately.
- **Phase 5: US3** depends on Foundational completion and can proceed independently of US1 and US2 if staffed separately.
- **Phase 6: Polish** depends on all targeted user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2.
- **US2 (P2)**: Depends only on Phase 2, though it reuses the authenticated shell from the foundation.
- **US3 (P3)**: Depends only on Phase 2, though it reuses the authenticated shell and shared tenant services from the foundation.

### Within Each User Story

- Story-level automated tests should be added before or alongside implementation and must pass before the story is considered complete.
- Schema/model work must complete before repository/service work.
- Repository/service work must complete before route handlers and final UI wiring.
- Shared UI state or route integration comes after the underlying APIs exist.

## Parallel Opportunities

- Setup tasks `T003` and `T004` can run in parallel after the scaffold starts.
- In Foundation, `T005`, `T007`, `T008`, `T009`, and `T014` can run in parallel once the basic scaffold exists.
- In US1, `T019` and `T020` can run in parallel after `T018` is defined.
- In US2, `T026`, `T027`, and `T028` can run in parallel after `T025` stabilizes the API contract.
- In US3, `T035`, `T036`, and `T037` can run in parallel after `T034` stabilizes the core routes.

## Parallel Example: User Story 1

```bash
Task: "T019 [US1] Build the sign-in and tenant-selection routes in src/routes/_auth/sign-in.tsx and src/routes/_auth/select-tenant.tsx"
Task: "T020 [US1] Build the dashboard landing route and shell navigation components in src/routes/_app/dashboard.tsx and src/components/layout/sidebar-nav.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T026 [US2] Build the reusable Google Maps location module in src/components/maps/google-map.tsx, src/components/maps/outlet-markers.tsx, and src/components/maps/outlet-map-card.tsx"
Task: "T027 [US2] Create outlet management routes and forms in src/routes/_app/outlets/index.tsx, src/routes/_app/outlets/$outletId.tsx, and src/features/outlets/outlet-form.tsx"
Task: "T028 [US2] Create catalog and stock management routes/components in src/routes/_app/inventory/index.tsx, src/routes/_app/inventory/$itemId.tsx, src/features/inventory/catalog-form.tsx, and src/features/inventory/stock-table.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T035 [US3] Create the POS draft Zustand store and order-entry components in src/features/pos/pos-draft-store.ts, src/features/pos/order-entry.tsx, and src/features/pos/order-summary.tsx"
Task: "T036 [US3] Add browser notification bootstrap and permission UI in public/onesignal/OneSignalSDKWorker.js, src/features/notifications/use-web-push.ts, and src/features/notifications/notification-permission-banner.tsx"
Task: "T037 [US3] Create POS and notification settings routes in src/routes/_app/pos/index.tsx, src/routes/_app/pos/$orderId.tsx, and src/routes/_app/settings/notifications.tsx"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate the independent test for User Story 1
5. Demo or ship the tenant workspace MVP before adding inventory and POS depth

### Incremental Delivery

1. Deliver Setup + Foundational as the platform base
2. Deliver US1 as the first usable tenant-aware dashboard
3. Deliver US2 as the first operational inventory/outlet increment
4. Deliver US3 as the POS and notification increment
5. Finish with Phase 6 hardening and docs updates

### Parallel Team Strategy

1. One developer completes Setup and coordinates Foundations
2. After Foundations:
   - Developer A takes US1
   - Developer B takes US2
   - Developer C takes US3
3. Rejoin on Phase 6 for hardening and documentation

## Notes

- All tasks follow the required checklist format with task ID, optional `[P]`, optional story label, and explicit file paths.
- Suggested MVP scope: **Phase 1 + Phase 2 + Phase 3 (US1 only)**.
- Task counts:
  - Setup: 4
  - Foundational: 11
  - US1: 6
  - US2: 8
  - US3: 9
  - Polish: 4
  - **Total**: 42
