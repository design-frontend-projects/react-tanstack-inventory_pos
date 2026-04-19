# Quickstart: Multitenant Inventory and POS Foundation

## 1. Prerequisites

- Node.js current LTS
- pnpm
- A Supabase project with PostgreSQL enabled
- A Google Maps JavaScript API key with browser restrictions
- A OneSignal web app with App ID and App API key

## 2. Initialize the TanStack Start app

From the repository root:

```powershell
pnpm create @tanstack/start@latest .
```

Select:

- React framework
- TypeScript
- File-based routing
- Tailwind CSS support

## 3. Install the application dependencies

```powershell
pnpm add @tanstack/react-query zustand zod @supabase/supabase-js i18next react-i18next next-themes @prisma/adapter-pg pg
pnpm add -D prisma @playwright/test vitest @testing-library/react @testing-library/jest-dom
pnpm dlx shadcn@latest init
```

## 4. Normalize environment variables before implementation

Create a local `.env` from `.env.example`, but keep the runtime split strict:

- Browser-safe variables may use `VITE_` prefixes.
- Server-only variables must not use `VITE_`, `PUBLIC_`, or any browser-exposed prefix.

Recommended shape:

```dotenv
DATABASE_URL=
DIRECT_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_GOOGLE_MAPS_API_KEY=
ONESIGNAL_APP_ID=
ONESIGNAL_APP_API_KEY=
```

Before implementation, rename any existing browser-exposed secret keys so they are server-only.

## 5. Set up Prisma and PostgreSQL access

```powershell
pnpm prisma init
```

Then:

- Define the multitenant schema in `prisma/schema.prisma`
- Generate the client
- Run the first migration

```powershell
pnpm prisma migrate dev --name init_multitenant_pos
pnpm prisma generate
```

## 6. Create the shared application layers

Implement the following in order:

1. Query client provider and router integration
2. Theme provider and mode toggle
3. i18n provider with persisted locale
4. Supabase browser client
5. Request-scoped server client
6. Server-only admin client for privileged auth actions
7. Prisma database client and repositories

## 7. Build the first route slices

Deliver the routes in this order:

1. Auth shell and tenant selection
2. Tenant dashboard shell
3. Outlet and map listing
4. Catalog and stock pages
5. POS order entry and completion
6. Preferences, theme, and locale settings

## 8. Add the reusable map module

Create a shared map package inside `src/components/maps` that supports:

- Single outlet view
- Multi-outlet list map
- Marker click callbacks
- Empty and invalid-location fallback states

## 9. Add web notifications

Implement the notification flow in two layers:

- Browser subscription and permission management with OneSignal App ID
- Server-only send and admin test endpoints with OneSignal App API key

Also add:

- Service worker setup under `public/onesignal/`
- Subscription sync route
- Tenant-scoped notification event persistence

## 10. Verification checklist

Before moving to `/speckit.tasks`, verify:

- A user can sign in and select a tenant
- Theme and locale preferences persist
- Outlet data renders in both list and map views
- Catalog and stock records stay tenant-scoped
- A POS order updates stock and order status
- OneSignal subscriptions register without exposing server keys
- Contract tests and route-level integration tests pass
