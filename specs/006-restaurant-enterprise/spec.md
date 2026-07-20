# 006 — Enterprise Restaurant Management UI

> Extends feature `004-restaurant-promotions` (phases 1–5 built: master data, menu,
> recipes, orders, KDS, floor). This spec covers the enterprise UI program on top:
> dashboard, reservations, waitlist, takeaway, delivery, QR, promotions, loyalty,
> gift cards, customers, events, party, catering, reports, analytics, settings —
> plus the reusable component system and upgrades to the existing screens.

Target operations: chains, cafes, food courts, fine dining, fast food, cloud
kitchens, hotels, resorts, event catering, banquet halls, wedding venues,
corporate catering, franchises. Reference products: Oracle MICROS, Toast POS,
Square Restaurants, Lightspeed Restaurant, Revel, Odoo Restaurant.

---

## 1. Information Architecture

```
Restaurant workspace (module `restaurant`, sidebar section `restaurant`)
├── Dashboard            /restaurant/dashboard        executive overview (P1)
├── Service
│   ├── POS / Order       /restaurant/orders/$orderId  order-taking surface (exists; P2 upgrades)
│   ├── Orders board      /restaurant/orders           all-orders management (exists; P2 upgrades)
│   ├── Kitchen (KDS)     /restaurant/kitchen          station board (exists; P2 upgrades)
│   ├── Live floor        /restaurant/tables           live table service (exists; P2 upgrades)
│   ├── Takeaway          /restaurant/takeaway         pickup queue (P3)
│   └── Delivery          /restaurant/delivery         dispatch board + drivers (P4)
├── Guests
│   ├── Reservations      /restaurant/reservations     calendar/timeline/floor (P3)
│   ├── Waitlist          /restaurant/waitlist         walk-in queue (P3)
│   └── Customers         /restaurant/customers        customer 360 (P5)
├── Growth
│   ├── Promotions        /restaurant/promotions       engine + wizard (P5)
│   ├── Loyalty           /restaurant/loyalty          programs/tiers/ledger (P5)
│   ├── Gift cards        /restaurant/gift-cards       issue/reload/redeem (P5)
│   └── QR ordering       /restaurant/qr               codes + campaigns (P3)
├── Functions
│   ├── Events            /restaurant/events           bookings + calendar (P6)
│   ├── Party             /restaurant/party            hall/seating planner (P6)
│   └── Catering          /restaurant/catering         jobs + logistics (P6)
├── Insight
│   ├── Reports           /restaurant/reports          operational reports (P1)
│   └── Analytics         /restaurant/analytics        trends + heat maps (P1)
└── Configure
    ├── Menu              /restaurant/menu             menu engineering (exists)
    ├── Floor plan        /restaurant/floor-plan       areas/sections/tables (exists)
    └── Settings          /restaurant/settings         master data + config (P2)
```

Multi-branch scoping: every operational screen is branch-scoped through the
shared `BranchPicker` (`features/restaurant/shared/use-branches.ts`); dashboards
offer all-branch rollups with per-branch drill-down.

## 2. Personas

| Persona | Goals | Primary surfaces | Key needs |
|---|---|---|---|
| **Cashier** | Ring up orders fast, take payments, handle splits/refunds | POS/order screen, takeaway | <15s order entry, quick pay, keyboard shortcuts, big touch targets |
| **Waiter** | Seat guests, take table orders, fire to kitchen, transfer/split | Live floor, order screen | table status at a glance, <3-click transfer, per-seat items, notes |
| **Kitchen staff** | Cook in sequence, keep tickets moving, flag delays | KDS | station filtering, big timers, allergen flags, one-tap advance, recall |
| **Manager** | Watch revenue/ops, approve voids, tune menu/promos, staffing | Dashboard, reports, orders, settings | live KPIs, exception surfacing, audit trail, branch comparison |
| **Event coordinator** | Book & run events/parties/catering, track tasks and payments | Events, party, catering, reservations | wizard booking, task checklist, deposit tracking, kitchen/inventory planning |
| **Delivery dispatcher** | Assign drivers, watch routes and ETAs, resolve exceptions | Delivery board, drivers | queue-to-driver drag, zone view, timeline, proof of delivery |
| **Admin** | Configure tenant/branches/RBAC/devices/taxes | Settings, RBAC screens | guarded destructive actions, per-branch overrides, seed-able catalogs |

## 3. User journeys (speed budgets)

- **POS order in <15s** (cashier): open orders board → New order (1 tap) →
  category → item tap ×N (variants/modifiers only when required) → Quick pay
  (cash exact) → done. Keyboard: `N` new order, digits for qty, `F8` pay.
- **Table transfer in <3 clicks** (waiter): live floor → tap occupied table →
  "Transfer" → tap destination table. (Existing `ResOrderTransfer` flow; P2
  tightens to this click budget.)
- **Split bill in <2 clicks** (waiter/cashier): order screen → "Split" → choose
  preset (by seat / evenly ×N). Custom line-picking is the escape hatch, not the
  default path.
- **Reservation → seated** (host): reservations floor view → tap booking →
  "Seat now" → table suggested by capacity/status → order opens pre-linked.
- **Dispatch a delivery** (dispatcher): delivery board → drag READY card onto a
  driver lane (or tap-assign on touch) → ETA auto-set from zone.
- **Book an event** (coordinator): events → "New booking" wizard: type → date/
  hall (conflict-checked) → package/menu → guests → deposits → review → creates
  task checklist + kitchen plan skeleton.

## 4. Screen inventory

Existing (P2 upgrades in parentheses): orders board (filters, merge), order
workspace (split presets, combo builder, seat assignment), KDS (station lanes,
rush/allergen chips, recall), live floor (timer, bill preview, transfer flow),
floor-plan editor (spatial designer adoption), menu (engineering panels),
settings placeholder (replaced).

New: dashboard; reports; analytics; reservations (calendar/timeline/floor +
wizard + detail); waitlist; takeaway; delivery board; drivers; zones; QR codes +
campaigns; promotions (list, wizard, simulator, analytics); loyalty (program
builder, tiers, rewards, ledger); gift cards (list, detail, transactions);
customers (list + 360 detail); events (calendar, wizard, detail w/ tasks +
payments); party (bookings + hall/seating planner); catering (jobs, logistics,
cost analysis); settings (general, branch, POS, kitchen, receipts, taxes,
service charges, hours, devices/printers, QR defaults).

Every list screen ships loading / empty / error / data states; every detail
screen ships a timeline of `ResOrderEvent`-style audit entries where the
aggregate has one.

## 5. Navigation structure

- Sidebar: section `restaurant` in `src/lib/navigation/app-nav.ts`, grouped as
  the IA above; items carry `permissions[]` (OR semantics) so each persona sees
  only their surfaces. DB-driven nav tree mirrors via `module-catalog.ts`
  screens (seeded); command palette (Ctrl/Cmd+K) picks up all screens from the
  same catalogs.
- In-module: workspace pages use `FilterTabs` for sub-views (e.g. reservations
  calendar/timeline/floor) instead of extra routes, keeping URLs stable and the
  route tree small. Deep links: `$orderId`, `$reservationId`, `$eventId`,
  `$customerId` detail routes.

## 6. Wireframe descriptions (per archetype)

- **Dashboard**: `WorkspacePage` hero (today's sales, open orders, occupancy %,
  kitchen backlog metrics) → masonry of `WorkspacePanel`s: hourly sales line,
  revenue by channel bar, top items table, sales heat map (day×hour grid),
  kitchen performance, reservation coverage, inventory alerts, activity feed.
- **Board screens (KDS, delivery, takeaway)**: full-width `KanbanBoard`; cards
  are dense tickets (order #, table/customer, items w/ modifiers, elapsed timer
  chip, allergen/rush chips); status advance = drag or tap-button; realtime via
  `useRestaurantRealtime`.
- **List screens**: `WorkspacePage` compact + `FilterBar` (search, selects,
  tabs) + `DataTable` (sortable, paginated, row-click → detail drawer or route).
- **Detail screens**: two-column — main pane (summary cards, line items) +
  side pane (status chip stack, timeline, actions); actions gated by
  `context.permissions`.
- **Wizards (reservation, event, party, catering, promotion)**: `FormWizard`
  inside a route page (events) or `Dialog` (reservations); steps validate via
  Zod slices of the same schema used by the server fn.
- **Designers (floor plan, hall/seating)**: `FloorDesigner` canvas left, item
  inspector right (`DrawerForm` on select); zoom/pan/minimap; read-only variant
  for the live floor.
- **Settings**: left vertical tab rail (general/branch/POS/kitchen/receipts/
  taxes/hours/devices), right form panels; per-branch override toggles.

## 7. Responsive layouts

- **Desktop (≥1280px)**: full sidebar, multi-column masonry, boards show all
  columns.
- **Tablet (768–1279px)**: icon sidebar (`collapsible="icon"` already set),
  2-column panels, boards horizontally scrollable with snap; touch targets ≥44px
  (buttons h-9+ pass); KDS/floor optimized for landscape tablets at stations.
- **Mobile (<768px)**: sheet-based sidebar (exists), single column, tables
  scroll in `overflow-x-auto` containers, wizards go full-screen, boards become
  vertically stacked column accordions.
- **POS/KDS kiosk**: no hover-dependent affordances; drag interactions always
  have tap equivalents (KanbanBoard cards expose tap-advance buttons).

## 8. Component hierarchy / design system

Tokens & primitives (exist): `src/styles.css` (Pinterest palette, `--chart-*`,
`.ops-*`, `.pin-*`), `components/ui/*` (button, badge, dialog, sheet, command,
sidebar, inputs), `components/layout/workspace-page.tsx`,
`components/charts/*` (recharts wrappers).

Composite kit (built in P0, `src/components/`):
`data/data-table.tsx`, `data/filter-bar.tsx` (FilterBar/FilterSelect/
FilterSearch/FilterTabs), `forms/drawer-form.tsx` (DrawerForm/Field),
`forms/form-wizard.tsx`, `board/status-chip.tsx`, `board/kanban-board.tsx`,
`scheduler/calendar-scheduler.tsx` (month/week/day), `floor/floor-designer.tsx`
(drag/resize/zoom/pan/minimap), `map/delivery-map.tsx` (SVG zones/routes/points,
provider-pluggable).

Feature-level cards (built per phase in `features/restaurant/*`): OrderCard,
ReservationCard, CustomerCard, TicketCard — composed from StatusChip +
`.pin-card`.

Rule: feature code never imports recharts or hand-rolls tables/filters/wizards;
it composes this kit.

## 9. RBAC visibility

New permissions (all registered in `rbac-catalog.ts` `PERMISSION_DEFINITIONS`,
`module-catalog.ts` `PERMISSION_LINKS` + screens, and `app-nav.ts` items):

| Permission | Granted to (beyond `res:super_admin`/`res:admin`) |
|---|---|
| `res.reports.view`, `res.analytics.view` | `res:floor_manager` |
| `res.reservations.view/manage` | `res:floor_manager`; view also `res:cashier` |
| `res.takeaway.view/manage` | `res:cashier`, `res:floor_manager` |
| `res.delivery.view/manage`, `res.drivers.manage` | `res:floor_manager`; view also `res:cashier` |
| `res.qr.manage` | `res:floor_manager` |
| `res.promotions.view/manage` | manage: admin-only; view: `res:cashier` (apply at POS) |
| `res.loyalty.view/manage`, `res.giftcards.view/manage` | view+redeem: `res:cashier` |
| `res.customers.view/manage` | `res:floor_manager`, view `res:cashier` |
| `res.events.view/manage`, `res.catering.view/manage` | `res:floor_manager` |

UI gating: nav visibility via `permissions[]`; in-screen actions check
`context.permissions` (e.g. void needs `res.orders.cancel`). Server functions
are the enforcement boundary — every new fn chains
`getCurrentUserContext → requireTenantAccess → requirePermission`.

## 10. Workflow specifications (selected)

- **Split bill**: presets (evenly ×N → creates `ResOrderSplit` rows with equal
  shares; by seat → groups items by seat tag) then per-split payment capture;
  splits stay linked to the parent for reporting.
- **Merge orders**: multi-select on orders board → merge dialog shows combined
  totals → target order absorbs lines; source orders voided with audit event.
- **KDS ticket lifecycle**: item statuses (existing state machine) surface as
  lanes NEW→PREPARING→READY→SERVED; rush toggles `priority`; recall moves
  READY→PREPARING and logs an event; station filter persists per device
  (localStorage).
- **Reservation lifecycle**: REQUESTED→CONFIRMED→SEATED→COMPLETED with
  NO_SHOW/CANCELLED exits; deposit optional at confirm; seating links
  reservation→table→order; no-show emits `restaurant_reservation.no_show`.
- **Promotion application**: rules evaluated at order recompute (pure
  `promotion-engine.ts`): condition tree (channel, time window, items, customer
  segment, subtotal) → action (percent/fixed/free item/BOGO) → priority +
  stacking policy resolves conflicts; applications recorded on
  `ResOrderDiscount` with promotion id; simulator runs the same pure engine on
  a sample cart.
- **Gift card**: issue (liability opens) → reload → redeem as a payment method
  on `ResOrderPayment` → events `restaurant_gift_card.issued/redeemed` flow to
  finance (liability account) via posting rules.
- **Event booking**: wizard (see §3) → `ResEvent` with package/menu/hall +
  generated task checklist; deposits/final payments post via finance seam;
  kitchen planning explodes package menu through recipes for inventory forecast.

## 11. State management strategy

- **Server state**: React Query, keys `[resource, tenantId, branchId, filters]`;
  mutations invalidate by prefix. Realtime: `broadcastRestaurantEvent(tenantId,
  channels)` → `useRestaurantRealtime` invalidates matching prefixes (channels
  extended: `reservations`, `takeaway`, `delivery`, `events`).
- **UI state**: Zustand only for cross-screen prefs (branch selection, KDS
  station filter); everything else local `useState`.
- **Loading/empty/error**: every query renders all branches explicitly via
  `Skeleton` / `WorkspaceEmptyState` / error panel (built into `DataTable`).
- **Offline-ready**: query cache is the read model; mutations disable on
  `navigator.onLine === false` with a visible offline banner; POS-critical
  actions queue client-side (documented follow-up — first pass ships the banner
  + optimistic updates with rollback).

## 12. Accessibility & localization

- WCAG AA: semantic tables (`aria-sort`), `role="tablist"` filter tabs, focus
  traps in Dialog/Sheet (Radix), visible focus rings (`--ring`), keyboard
  equivalents for all drag interactions, `tabular-nums` for figures, color
  never the sole status signal (chips carry text).
- Shortcuts: Ctrl/Cmd+K palette (exists); POS: `N` new order, `F8` pay, `/`
  search focus; KDS: number keys select ticket, `Space` advance.
- i18n: all new strings via `t('res.<domain>.<key>', fallback)` in both
  `en/common.json` + `ar/common.json`; RTL via logical properties only
  (`ms-/me-/ps-/pe-/start-/end-`); Cairo font + flipped sidebar already handled
  globally; numerals stay Latin for order codes.

## 13. Folder structure

```
src/features/restaurant/
  shared/  dashboard/  reservations/  waitlist/  takeaway/  delivery/  qr/
  promotions/  loyalty/  gift-cards/  customers/  events/  party/  catering/
  settings/  reports/
    each: validation.ts · server-functions.ts · use-<domain>.ts ·
          <domain>-workspace.tsx · <domain>-dialogs.tsx (as needed)
src/server/restaurant/<domain>/   <domain>-service.ts · <domain>-dto.ts · pure engines
src/server/repos/res-<aggregate>-repo.ts
src/routes/_app/restaurant/<screen>.tsx      (thin shims)
src/components/{data,forms,board,scheduler,floor,map}/   (P0 kit)
```

## 14. Integration points

- **Inventory**: order/event/catering consumption via approved recipes →
  `consumeOrderInventory` → `postMovement` (`sourceDocType 'RESTAURANT_ORDER'`;
  add `'RESTAURANT_EVENT'`, `'RESTAURANT_CATERING'` when P6 lands). Inventory
  alerts feed the dashboard.
- **Finance**: order revenue, gift-card liability, event deposits post through
  `postJournalEntry` + posting rules/account mappings (idempotent per source
  doc); no finance code changes.
- **CRM**: `customerId` on orders/reservations/events; CRM timeline maps every
  restaurant event (`timeline-mapper.ts` entries are mandatory per new event);
  loyalty earn/redeem bridges via `crm.loyalty_*`.
- **Delivery**: new `restaurant_delivery.*` events; notifications via the
  existing notification seam (SMS/pickup/dispatch messages).
- **Reporting**: read-side aggregation services (pattern:
  `purchasing/reporting-server-functions.ts`) over `ResOrder*` + domain events.

## 15. Phase plan

| Phase | Scope | Exit criteria |
|---|---|---|
| P0 | Component kit + this spec + event contract extensions | kit tests green, `pnpm smoke` |
| P1 | Dashboard, Reports, Analytics | live KPIs from real orders, charts, heat map |
| P2 | Settings workspace; POS/KDS/floor/orders upgrades | placeholder gone; split/merge/transfer budgets met |
| P3 | Reservations, Waitlist, Takeaway, QR | booking→seat→order flow; reserved events wired |
| P4 | Delivery, Drivers, Zones | dispatch board + assignment + zone CRUD |
| P5 | Promotions, Loyalty, Gift cards, Customers | pure engine w/ TDD; POS applies promos; card redemption pays orders |
| P6 | Events, Party, Catering | wizard booking; hall designer; finance/inventory planning seams |

Each phase: schema (`prisma migrate diff` → `migrate deploy`, never `migrate
dev`) → repos → services (+DTO serializers — no raw Decimals) → server fns
(guard chain) → RBAC (3 files + re-seed) → hooks → workspaces → routes → i18n →
tests → `pnpm smoke`.
