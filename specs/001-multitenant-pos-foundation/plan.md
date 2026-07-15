# Implementation Plan: Multitenant Inventory and POS Foundation

**Branch**: `001-multitenant-pos-foundation` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-multitenant-pos-foundation/spec.md`

## Summary

Bootstrap a single TanStack Start full-stack web application for multitenant inventory, POS, and restaurant operations. The implementation will use file-based routing, SSR-aware TanStack Query integration, a shared shadcn/Tailwind design system with theme tokens and dark mode, a tenant-safe PostgreSQL data layer via Prisma and Supabase, reusable Google Maps outlet rendering, and OneSignal-backed web notifications with strict separation between browser-safe configuration and server-only secrets.

## Technical Context

**Language/Version**: TypeScript 5.3+ on Node.js current LTS  
**Primary Dependencies**: TanStack Start, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui, Zustand, Zod, Prisma ORM with PostgreSQL driver adapter, Supabase JavaScript clients, next-themes, i18next with react-i18next, Google Maps JavaScript API, OneSignal Web SDK  
**Storage**: PostgreSQL (Supabase Postgres) for operational data; browser storage/cookies for non-sensitive UI preferences and session hints  
**Testing**: Vitest, React Testing Library, Playwright, contract validation against OpenAPI, Prisma migration smoke checks  
**Target Platform**: Modern desktop and tablet browsers served by the TanStack Start runtime  
**Project Type**: Full-stack web application  
**Performance Goals**: Dashboard shell interactive within 2.5s p75 on broadband; cached route transitions under 200ms; read-heavy server responses under 300ms p95; standard POS submission under 1s p95; notification enqueue under 2s and delivery target within 10s  
**Constraints**: Strict tenant isolation; no server secrets in browser bundles; service-role and OneSignal App API keys server-only; reusable location rendering for single or multiple outlets; dark/light/system theming from day one; localization-ready route shell and forms; avoid introducing background job infrastructure in the first scaffold  
**Scale/Scope**: Initial architecture should comfortably support 100 tenants, 100 outlets per tenant, 10k catalog items per tenant, and 5k POS orders per day without structural rework

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The current [constitution](E:\web-projects\web-mobile-work-apps\react-tanstack-inventory_pos\.specify\memory\constitution.md) is still an unfilled template, so there are no ratified project-specific gates to enforce yet.

Until the constitution is formalized, this plan applies the following working gates:

- Tenant data must never cross tenant boundaries in UI queries, server routes, or persistence.
- Server-only credentials must never be prefixed or structured in a way that exposes them to browser code.
- All domain writes must pass schema validation before persistence.
- Critical flows must be covered by automated tests before feature completion.

**Pre-Phase 0 Result**: PASS  
**Post-Phase 1 Result**: PASS  
**Follow-up**: Ratify the project constitution before large-scale implementation to avoid planning drift.

## Project Structure

### Documentation (this feature)

```text
specs/001-multitenant-pos-foundation/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- app-api.openapi.yaml
`-- tasks.md
```

### Source Code (repository root)

```text
prisma/
|-- schema.prisma
|-- migrations/
`-- seed.ts

public/
|-- icons/
`-- onesignal/

src/
|-- routeTree.gen.ts
|-- router.tsx
|-- routes/
|   |-- __root.tsx
|   |-- index.tsx
|   |-- _auth/
|   |   |-- sign-in.tsx
|   |   `-- select-tenant.tsx
|   |-- _app/
|   |   |-- dashboard.tsx
|   |   |-- inventory/
|   |   |-- outlets/
|   |   |-- pos/
|   |   |-- restaurant/
|   |   `-- settings/
|   `-- api/
|       |-- session/
|       |-- catalog/
|       |-- outlets/
|       |-- pos/
|       `-- notifications/
|-- components/
|   |-- ui/
|   |-- layout/
|   |-- maps/
|   `-- shared/
|-- features/
|   |-- auth/
|   |-- tenants/
|   |-- inventory/
|   |-- outlets/
|   |-- pos/
|   |-- notifications/
|   `-- preferences/
|-- lib/
|   |-- env/
|   |-- query/
|   |-- theme/
|   |-- i18n/
|   |-- state/
|   |-- validation/
|   `-- utils/
|-- server/
|   |-- auth/
|   |-- db/
|   |-- repos/
|   |-- services/
|   |-- notifications/
|   `-- maps/
|-- styles/
|   `-- globals.css
`-- types/

tests/
|-- unit/
|-- integration/
|-- contract/
`-- e2e/
```

**Structure Decision**: Use a single TanStack Start application with route-driven UI, colocated server routes, and separate domain/server modules under `src/`. This keeps tenant-aware web flows, SSR, server actions, and Prisma-backed persistence in one deployable app while preserving clear boundaries between presentation, domain logic, and infrastructure.

## Phase 0: Research Output

Phase 0 resolves the main architectural choices for TanStack Start, theming, data access, localization, maps, and notifications in [research.md](./research.md).

## Phase 1: Design Output

Phase 1 artifacts are:

- [data-model.md](./data-model.md)
- [app-api.openapi.yaml](./contracts/app-api.openapi.yaml)
- [quickstart.md](./quickstart.md)

## Complexity Tracking

No constitution violations or exceptional complexity items currently require justification.
