# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Multi-tenant POS / inventory foundation built on **TanStack Start** (full-stack SSR React 19). The current feature slice (`001-multitenant-pos-foundation`) implements tenant onboarding, authentication, and RBAC. Business surfaces (POS, inventory, restaurant, outlets) exist as routed placeholders that the auth/tenant/RBAC foundation gates.

Package manager is **pnpm**. Dev server runs on **port 3005**.

## Commands

```bash
pnpm dev                       # Vite dev server on :3005
pnpm build                     # Production build
pnpm test                      # Vitest run (all unit tests)
pnpm typecheck                 # tsc --noEmit
pnpm lint                      # eslint
pnpm format                    # prettier --check
pnpm check                     # prettier --write + eslint --fix
pnpm smoke                     # lint + typecheck + test (run before finishing work)
pnpm e2e                       # Playwright

# Single test file
pnpm vitest run tests/unit/permissions.test.ts
# Watch a single test by name
pnpm vitest tests/unit/permissions.test.ts -t "merges overrides"
```

### Prisma (v7)

```bash
pnpm prisma validate
pnpm prisma generate                        # emits client to src/server/db/generated/prisma (NOT committed)
pnpm prisma migrate dev --name <name>
pnpm db:seed                                # tsx prisma/seed.ts — seeds RBAC roles/permissions
```

`prisma.config.ts` is the CLI source of truth. The **runtime** connection uses `DATABASE_URL` (pooled, via `src/server/db/client.ts`); the **CLI** uses `DIRECT_URL`. After changing `prisma/schema.prisma`, run `pnpm prisma generate` or type errors will reference a stale client.

## Architecture

### Layering & request flow

Code is organized by layer, not by type:

- `src/routes/**` — file-based routes (see `routeTree.gen.ts`, auto-generated, do not edit). `_app/*` = authenticated app shell; `_auth/*` = sign-in/onboarding flows.
- `src/features/**` — client-side feature modules (auth, layout, preferences). Hooks, stores, and `createServerFn` declarations live here.
- `src/server/**` — server-only code. `server/auth` (session, guards, Supabase admin), `server/repos` (Prisma data access, one repo per aggregate), `server/db` (Prisma client + tenant resolution).
- `src/lib/**` — cross-cutting infra (env, i18n, query client, supabase browser client, theme, utils).
- `src/components/**` — `ui/` are shadcn/Radix primitives; `layout/` composes the app shell.

The critical flow is **client → server function → guard → repo**:

1. Client obtains a Supabase access token via `features/auth/browser-auth.ts` (`getAccessToken`) or the `withAccessToken` helper.
2. It calls a `createServerFn` (e.g. `features/auth/server-functions.ts`), passing `accessToken` in the Zod-validated input.
3. The handler calls `getCurrentUserContext({ accessToken, tenantId })`, which validates the token against Supabase and builds a `CurrentUserContext`.
4. Guards in `server/auth/tenant-guard.ts` enforce access: `requireAuth` → `requireTenantAccess(context, tenantId)` → `requirePermission(context, 'user.invite')`. These throw typed errors (`server/auth/errors.ts`). **Every tenant-scoped server function must chain these guards** — this is the security boundary; there is no other tenant isolation layer, so a missing guard leaks cross-tenant data.
5. Business logic in `server/auth/*` and repos runs against Prisma.

### Auth & sessions

- **Supabase** is the identity provider; the app stores no passwords. Identity → app data is bridged by `Profile.authUserId`.
- `bootstrapSession` (`server/auth/session.ts`) is the single source of truth for a user's session: it ensures a `Profile` + `PreferenceProfile`, loads tenant memberships, resolves the active tenant, and computes the effective role/permission sets. Returns a `SessionBootstrapPayload`.
- Client subscribes via `useSessionBootstrap` (`features/auth/use-session-bootstrap.ts`), a TanStack Query hook keyed by active tenant; it re-fetches on Supabase `onAuthStateChange` and drives redirects (sign-in, complete-account, select-tenant) from `_app.tsx`.
- Active tenant resolution order (`server/db/tenant-context.ts`): requested → preferred (default) → sole membership → first active. A user can belong to multiple tenants and switch via `switchActiveTenantServerFn`.

### RBAC

- `features/auth/rbac-catalog.ts` is the **canonical, code-defined catalog** of roles, permissions, and the role→permission map. The DB (`roles`, `permissions`, `role_permissions`) is seeded from it via `prisma/seed.ts` — edit the catalog, then re-seed; do not hand-edit permission rows.
- Effective permissions = role permissions merged with per-user overrides (`mergePermissions` in `features/auth/permissions.ts`; an override with `isAllowed: false` removes a granted permission).
- Roles are ranked (`rank`); the highest-ranked role is treated as primary. Restaurant-scoped roles/permissions are prefixed `res:` / `res.`.
- Permission checks use the `module.action` code convention (e.g. `user.invite`, `res.orders.create`). `PERMISSION_CODES` / `TENANT_ASSIGNABLE_ROLE_CODES` are exported as `const` tuples for Zod enum validation in server functions.

### Data model

`prisma/schema.prisma`: `Profile` ↔ `TenantAccount` many-to-many via `TenantUser`, with `Role`/`Permission` joined through `TenantUserRole` and `RolePermission`, plus per-user `TenantUserPermission` overrides. Onboarding uses `TenantRegistrationRequest` (owner sign-up) and `user_invitations` (invited members). `AuditLog` and `PreferenceProfile` round it out. DB columns are `snake_case` (`@map`); Prisma model fields are `camelCase`.

## Conventions

- **Path aliases**: `#/*` and `@/*` both map to `src/*` (`#/` is used consistently in existing code — prefer it).
- **Env**: never read `process.env` / `import.meta.env` directly in feature code. Import validated values from `lib/env/server.ts` (server) or `lib/env/client.ts` (client). Both parse with Zod at module load and fail fast. Client-exposed vars are `VITE_`-prefixed.
- **Validation**: all server-function inputs are validated with Zod via `.inputValidator(...)`. Trust nothing from the client.
- **Formatting** (Prettier): no semicolons, single quotes, trailing commas. ESLint is `@tanstack/eslint-config` with `import/order` and `sort-imports` disabled — do not add import-sorting churn.
- **ESM only** (`"type": "module"`), TypeScript strict mode with `noUnusedLocals`/`noUnusedParameters`. The generated Prisma client (`src/server/db/generated/prisma/**`) is lint/format-ignored and git-ignored.
- **`"use client"`** directives mark browser-only feature modules (auth hooks, stores).
- **i18n**: `en` + `ar` (RTL-aware) via i18next; resources in `src/lib/i18n/resources/`.
- **State**: Zustand for local UI/preferences (`features/*/**-store.ts`); TanStack Query for server state.

## Spec-driven workflow

This repo uses **Spec Kit** (`.specify/`, `.agents/skills/speckit-*`). Feature specs, plans, data models, and task lists live in `specs/<feature>/`. `AGENTS.md` is auto-generated from feature plans — do not hand-edit its generated sections. When implementing a feature, check `specs/001-multitenant-pos-foundation/` for `spec.md`, `plan.md`, `data-model.md`, and `tasks.md`.

## Testing

Vitest with jsdom + Testing Library; globals enabled; setup in `tests/setup.ts`. Unit tests in `tests/unit/` mirror the modules they cover (guards, RBAC catalog, permission merging, session/tenant context, route components, Supabase clients). Playwright is configured (`playwright.config.ts`) for E2E.
