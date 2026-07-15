# Integration Architecture — Feature 004

How the Restaurant module plugs into the existing platform. The guiding rule: **restaurant owns
operations; it does not own stock, customers, identity, or the ledger.** It reuses those modules
through their published contracts.

## 1. Inventory integration (stock is never owned by restaurant)

**Contract:** menu items consume inventory through **recipes**. Restaurant never writes
`inventory_movements`, `stock_balances`, or `cost_layers` directly — it calls inventory services so
FIFO/weighted-average costing, valuation, and reservation invariants remain owned by inventory.

Flow:
1. **Order confirm** → for each order line with a recipe, explode the recipe into component product
   quantities (× quantity × waste factor ÷ yield) → call the inventory **reservation** service to
   create `StockReservation` rows against the branch's warehouse (`ReservationType` = restaurant
   order). Insufficient stock (when the branch disallows negative stock) → typed conflict error.
2. **Order serve/complete** → convert reservations to consumption: call the inventory movement
   service to post `InventoryMovement` (`sourceDocType = 'restaurant_order'`, `sourceDocId =
   order.id`) and release the reservation. Sub-recipes explode recursively.
3. **Order void/cancel before serve** → release reservations; no movement is posted.
4. **Recipe cost** is read from inventory product cost (`standardCost` / moving average) at
   compute time; recipe costing does not cache stale costs — it recomputes on demand and on a
   costing event.

Branch → warehouse mapping: `res_branches.warehouseId` (bare scalar → `warehouses.id`) designates
the stock source; a branch with no warehouse cannot serve stock-tracked recipes (validation).

## 2. CRM integration (event-driven, no duplication)

**Contract:** restaurant appends `restaurant_*` rows to the existing `domain_events` outbox **in the
same DB transaction** as the business write; CRM projectors fold them. Restaurant never writes
`crm_*` tables except the loyalty **redeem** bridge (see §4).

Events emitted (added to `src/server/events/domain-event-types.ts`):

| Event type | When | Payload (Decimal-as-string) |
|------------|------|------------------------------|
| `restaurant_order.completed` | order reaches `completed` | documentNumber, branchId, orderType, serviceType, channel, currencyCode, subtotal, discountTotal, taxTotal, serviceChargeTotal, deliveryFee, tipTotal, roundingTotal, grandTotal, amountPaid, paymentMethods[], customerId?, guestCount, lines[{ menuItemId, productId?, categoryId?, quantity, unitPrice, lineTotal }], promotions[{ promotionId, code, discount }] |
| `restaurant_order.refunded` | order refunded | documentNumber, amount, reason? |
| `restaurant_order.voided` | order voided | documentNumber, reason? |
| `restaurant_reservation.created` | reservation confirmed | reservationId, branchId, customerId?, partySize, scheduledAt |
| `restaurant_reservation.no_show` | reservation no-show | reservationId, customerId? |
| `restaurant_gift_card.issued` | gift card issued | cardId, code, initialBalance, customerId? |
| `restaurant_gift_card.redeemed` | gift card redeemed | cardId, amount, balanceAfter |
| `restaurant_promotion.applied` | promotion applied to a completed order | promotionId, code, orderId, discount |

`customerId` is denormalized onto the event (nullable — walk-ins still emit) exactly like
`pos_sale.completed`, so CRM can filter cheaply. Payloads carry all money as strings; consumers
re-hydrate with `new Prisma.Decimal(...)`.

**Reuse:** `appendDomainEvent(tx, …)` helper and the typed `DomainEventPayloadMap`. CRM's existing
metrics/loyalty/timeline projectors consume `restaurant_order.completed` to update visit frequency,
spend, favorites, and to accrue loyalty (its earn rules already key off order-shaped events).

## 3. Financial integration (event-readiness)

No GL module exists yet. The `restaurant_order.completed` / `.refunded` payloads carry the full
accounting decomposition (revenue, discount, tax, service charge, delivery, tips, rounding, payment
allocation by method). When a financial module lands, a projector consumes these events and posts
journal entries — **no restaurant schema change required**. This satisfies the "accounting entries
can be generated automatically" requirement as a contract, consistent with how CRM designed
deferred consumers.

## 4. Loyalty & gift cards

- **Loyalty earn** is passive: CRM's loyalty projector accrues points from
  `restaurant_order.completed` using its existing earn rules. Restaurant does not write points.
- **Loyalty redeem** is synchronous at payment: the order payment service calls the existing CRM
  loyalty **redeem** service (append-only `crm_loyalty_ledger` debit) inside the payment
  transaction, then records a `res_order_payments` row of method `LOYALTY`. This is the one place
  restaurant touches a `crm_` table, through its service, not by direct write.
- **Gift cards** are restaurant-owned (`res_gift_cards` + `res_gift_card_transactions`, append-only).
  Redemption debits the card inside the payment transaction and records a payment of method
  `GIFT_CARD`.

## 5. RBAC integration

Restaurant extends the **already-seeded** `restaurant` module. Per phase we add:
- `res.*` permissions to `PERMISSION_DEFINITIONS` (`rbac-catalog.ts`) + a `PERMISSION_LINKS` entry
  in `module-catalog.ts` for **every** code (the seed throws otherwise).
- `res:` roles already exist (`res:super_admin/admin/floor_manager/cashier/kitchen/user`); new
  permissions are granted to them via `ROLE_PERMISSION_MAP` (and auto-included in `super_admin`).
- New screens/actions to `SCREEN_DEFINITIONS` / `SCREEN_ACTION_DEFINITIONS`.

Every restaurant server function chains `getCurrentUserContext → requireTenantAccess →
requirePermission('res.x')`. Branch-level authorization (a user limited to certain branches) is
enforced in the service layer via a `res_branch_members` check (Phase 1) — the guard proves tenant
+ permission; the service proves branch scope.

## 6. Numbering & sequences

Reuses the pattern of the inventory `DocumentSequence` but restaurant-owned per branch:
`res_number_sequences` issues order/invoice/ticket numbers atomically per (tenant, branch,
sequenceType), gap-tolerant, formatted by a configurable prefix/pattern.
