# 006 — Task tracker

Integration seams are specified in `spec.md` §14; data model in
`data-model.md`. Per-phase recipe: schema → `prisma validate`/`generate` →
`migrate diff`+`migrate deploy` → repos → services+DTOs → server fns (guard
chain) → RBAC (rbac-catalog + module-catalog + app-nav, re-seed) → hooks →
workspaces → routes → i18n (en+ar) → tests → `pnpm smoke`.

## P0 — Foundations
- [x] Component kit: DataTable, FilterBar, DrawerForm, FormWizard, StatusChip,
      KanbanBoard, CalendarScheduler, FloorDesigner, DeliveryMap
- [x] Kit unit tests (`tests/unit/ui-components.test.tsx`)
- [x] Spec (`spec.md`), data model (`data-model.md`)
- [x] Domain event contract extensions + timeline-mapper entries

## P1 — Dashboard / Reports / Analytics
- [x] Reporting aggregation service + server fns
      (`src/server/restaurant/reporting/`)
- [x] `/restaurant/dashboard` workspace (KPIs, charts, activity)
- [x] `/restaurant/reports`, `/restaurant/analytics` (trend, heat map, kitchen
      speed, staff ranking)
- [x] RBAC `res.reports.view`, `res.analytics.view` + nav + i18n + seed

## P2 — Settings + upgrades
- [x] Settings workspace over master-data server fns (replaces placeholder;
      restaurants/branches/service types/stations/taxes/service charges)
- [x] ResTable position fields (migration `20260719120000`); FloorDesigner
      adoption in floor-plan remains a follow-up
- [x] Orders: even-split presets ×N, merge (service+fn+dialog); KDS: recall
      (state-machine exception + button)

## P3 — Guests & front-desk
- [x] Schema: ResReservation(+Table), ResWaitlistEntry, ResPickup, ResQrCampaign
- [x] Reservations (calendar/list + booking drawer + seat flow), Waitlist,
      Takeaway (pickup lifecycle + code hand-over), QR (campaigns + rendering)
- [x] Wire `restaurant_reservation.created/no_show/seated/cancelled`

## P4 — Delivery
- [x] Schema: ResDriver, ResDeliveryZone, ResDelivery
- [x] Dispatch board (kanban), driver roster, zones; assignment auto-manages
      driver status; `restaurant_delivery.*` events

## P5 — Growth
- [x] Schema: promotions/coupons/gift cards (migration `20260719140000`);
      loyalty intentionally stays in CRM (crm_loyalty_*), customers 360 =
      /crm/customers — no duplication
- [x] Pure `promotion-engine.ts` (TDD, 12 tests) + promotions workspace +
      simulator seam (`simulatePromotions`)
- [x] Gift card lifecycle (issue/reload/redeem, ledger, no-overdraft)
- [x] Order integration: `applyPromotionsToOrder` (+coupon), events emitted

## P6 — Functions
- [x] Schema: ResEvent(+Task/Payment), ResPartyBooking, ResCateringJob
      (migration `20260719150000`)
- [x] Events calendar + booking wizard + task checklist + payments; party
      seating via FloorDesigner (seatingJson); catering jobs + lifecycle
- [ ] Finance GL posting for event deposits + recipe-based inventory planning
      for event/catering menus (documented follow-up)
