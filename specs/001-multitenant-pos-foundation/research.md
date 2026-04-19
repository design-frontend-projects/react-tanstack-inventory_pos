# Research: Multitenant Inventory and POS Foundation

## Decision 1: Use TanStack Start as a single full-stack application shell

**Decision**: Scaffold the project as one TanStack Start React application with file-based routing and colocated server routes.

**Rationale**: The feature requires one cohesive web experience with authenticated routing, server-aware data loading, and application-side APIs for tenant switching, inventory, POS, and notifications. A single full-stack app reduces handoff friction between frontend and backend concerns while keeping SSR and route guards first-class.

**Alternatives considered**:

- Split frontend and backend into separate projects: rejected because it adds deployment and contract overhead before the first usable tenant workflow exists.
- Use TanStack Router only without Start: rejected because the feature also needs server routes and integrated full-stack behavior from the beginning.

## Decision 2: Use file-based routing plus TanStack Query integration for route-aware data loading

**Decision**: Structure pages around TanStack Start file-based routes and hydrate business data through TanStack Query integrated with route loaders.

**Rationale**: This keeps route ownership explicit, supports nested tenant-aware layouts, and gives a consistent pattern for preloading dashboard, outlet, and POS data while preserving client caching and invalidation behavior.

**Alternatives considered**:

- Route-local fetch calls only: rejected because cache invalidation and optimistic updates become inconsistent across inventory, POS, and settings flows.
- Global state for remote data: rejected because server state should remain in query primitives, not local store abstractions.

## Decision 3: Use shadcn/ui semantic CSS variables with a class-based theme provider

**Decision**: Adopt shadcn/ui components with semantic theme tokens and a class-based theme provider for light, dark, and system modes.

**Rationale**: Theme tokens give a reusable visual contract across dashboard, POS, tables, and map-adjacent components. A dedicated theme provider keeps the dark-mode toggle consistent without scattering theme logic into feature components.

**Alternatives considered**:

- Hardcode Tailwind color utilities per component: rejected because the design system would be harder to evolve and maintain.
- Custom theme store without a provider library: rejected because it would recreate hydration and persistence behavior that established theme providers already solve well.

## Decision 4: Keep Prisma as the domain ORM and use the PostgreSQL driver adapter

**Decision**: Model operational data in Prisma and connect to PostgreSQL through Prisma's `pg` driver adapter, with a pooled connection for runtime traffic and a direct connection for schema operations.

**Rationale**: The project needs a strongly typed relational model for memberships, outlets, products, stock, orders, and notification events. Prisma gives a clear schema, migration workflow, and type-safe data access, while the PostgreSQL driver adapter aligns with pooled and server-friendly connection handling.

**Alternatives considered**:

- Raw SQL only: rejected because the initial schema is large and relational, and the loss of generated types would slow feature delivery.
- A separate query builder alongside Prisma: rejected because the extra abstraction is not justified in the first scaffold.

## Decision 5: Separate Supabase clients by runtime and privilege level

**Decision**: Maintain three Supabase access layers: a browser-safe public client, a request-scoped server client, and a dedicated server-only admin client for privileged `auth.admin` operations.

**Rationale**: Tenant users need browser-based session handling, while administrative operations must remain server-only. Separating clients prevents accidental credential leakage and keeps privileged actions auditable.

**Alternatives considered**:

- One universal Supabase client reused everywhere: rejected because it increases the risk of exposing privileged credentials.
- Avoid Supabase auth.admin entirely: rejected because the requested feature explicitly includes privileged administrative actions.

## Decision 6: Use route-aware i18n with server-resolved initial locale and namespace-based translation files

**Decision**: Implement localization with a route-safe i18n library, server-resolved initial locale, and feature-scoped translation namespaces.

**Rationale**: The app needs persisted language preferences and predictable rendering during the first request. A namespace-based model scales cleanly as inventory, POS, restaurant, and settings modules grow.

**Alternatives considered**:

- Hardcoded strings with later extraction: rejected because retrofitting i18n into route metadata, validation, and notifications is expensive.
- Locale files per page only: rejected because shared forms, tables, and nav copy would fragment rapidly.

## Decision 7: Treat multitenancy as an app-wide context, not a late-stage add-on

**Decision**: Encode tenant scope in memberships, route guards, server service boundaries, and all write models from the first migration.

**Rationale**: Cross-tenant leakage is the highest-risk failure mode in this application. Building tenant scope into the data model and service layer from the start avoids expensive retrofits later.

**Alternatives considered**:

- Add tenant fields only to a subset of tables: rejected because operational joins and notifications would remain ambiguous.
- Separate database per tenant from day one: rejected because the first release needs faster delivery and a simpler operational footprint.

## Decision 8: Build a reusable Google Maps location module around a normalized outlet location model

**Decision**: Create a shared map module that renders outlet markers from normalized location entities and supports both single-location and multi-location views.

**Rationale**: Inventory managers and restaurant operators need the same outlet data represented in lists, detail pages, and visual maps. A reusable map module avoids duplicate rendering logic and enforces consistent marker behavior.

**Alternatives considered**:

- Embed one-off map scripts inside outlet pages: rejected because the same rendering logic is needed in multiple features.
- Defer maps until after outlet CRUD: rejected because location visualization is already part of the core requirements.

## Decision 9: Split OneSignal configuration into public SDK identifiers and server-only API secrets

**Decision**: Use the OneSignal App ID in browser-facing configuration, but keep the App API key server-only for trusted notification send paths and admin tests.

**Rationale**: Browser subscriptions need a public identifier, while message dispatch and user-management APIs are privileged operations that must not be exposed to client bundles.

**Alternatives considered**:

- Store the OneSignal App API key in browser-visible environment variables: rejected because it would allow unauthorized message and subscription operations.
- Build custom web-push infrastructure now: rejected because it increases scope before validating the tenant notification flow.

## Decision 10: Reserve Zustand for client-local workflow state only

**Decision**: Use Zustand for ephemeral UI state such as selected outlet, POS draft composition, filter panels, and tenant workspace shell state; keep remote entities in TanStack Query.

**Rationale**: This cleanly separates server state from client-only interaction state and avoids duplicating cache ownership between stores and queries.

**Alternatives considered**:

- Put all app data in Zustand: rejected because it weakens invalidation, refetching, and request lifecycle handling.
- Avoid local store usage entirely: rejected because POS draft composition and shell preferences benefit from lightweight client-local state.
