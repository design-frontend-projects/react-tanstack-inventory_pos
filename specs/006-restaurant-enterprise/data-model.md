# 006 — Data model additions

All models follow 004 conventions: `Res<Entity>` → `@@map("res_<snake>")`,
`tenantId` (`tenant_id`, NOT NULL, FK → `TenantAccount` with back-relation),
branch-scoped rows carry `branchId`, cross-aggregate refs are bare UUID
scalars, soft-delete via `deletedAt` where listed, money/qty as `Decimal`
(serialized to strings in DTOs).

## Phase 3 — Guests & front-desk

- **ResReservation**: branchId, code, customerId?, guestName, guestPhone?,
  partySize, requestedAt (slot start), durationMinutes, status
  (`REQUESTED|CONFIRMED|SEATED|COMPLETED|NO_SHOW|CANCELLED`), depositAmount?
  Decimal, depositPaidAt?, notes?, source (`PHONE|WALK_IN|QR|ONLINE`), orderId?,
  timestamps. Index (tenant, branch, requestedAt), (tenant, branch, status).
- **ResReservationTable**: reservationId FK, tableId (uuid scalar) — M:N seat
  assignment.
- **ResWaitlistEntry**: branchId, guestName, guestPhone?, partySize, priority
  (`NORMAL|FAMILY|VIP`), quotedMinutes, status
  (`WAITING|NOTIFIED|SEATED|LEFT`), notifiedAt?, seatedAt?, reservationId?
  (promotion to booking), timestamps.
- **ResQrCampaign**: name, target (`TABLE|MENU|CAMPAIGN`), tableId?, menuId?,
  slug (unique per tenant), expiresAt?, isActive, scanCount Int, timestamps.
  (Table QRs continue to live on `ResTableQrCode`; campaigns add marketing QRs.)

Takeaway rides on `ResOrder` (`serviceType = TAKEAWAY`) plus:
- **ResPickup**: orderId (unique), promisedAt, packedAt?, pickedUpAt?,
  verificationCode (4–6 chars), notifiedAt?, counter?.

## Phase 4 — Delivery

- **ResDriver**: branchId?, profileId? (uuid scalar), name, phone, vehicle?,
  status (`OFFLINE|AVAILABLE|ON_DELIVERY`), isActive, timestamps.
- **ResDeliveryZone**: branchId, name, feeAmount Decimal, etaMinutes,
  polygon Json? (normalized vertices), isActive.
- **ResDelivery**: orderId (unique), driverId?, zoneId?, status
  (`PENDING|ASSIGNED|PICKED_UP|EN_ROUTE|DELIVERED|FAILED`), addressLine,
  addressNotes?, lat?/lng? Decimal, assignedAt?, pickedUpAt?, deliveredAt?,
  proofUrl?, failReason?, timestamps.

## Phase 5 — Growth

- **ResPromotion**: name, kind (`PERCENT|FIXED|BOGO|FREE_ITEM|BUNDLE|HAPPY_HOUR
  |CASHBACK`), status (`DRAFT|ACTIVE|PAUSED|ENDED`), priority Int, stacking
  (`STACKABLE|EXCLUSIVE`), startsAt?, endsAt?, conditions Json (typed tree),
  action Json, usageLimit?, usedCount, timestamps. Pure evaluation in
  `promotion-engine.ts` — DB stores the declarative rule tree only.
- **ResCoupon**: promotionId, code (unique per tenant), maxUses?, usedCount,
  expiresAt?, isActive.
- **ResPromotionApplication**: promotionId, orderId, couponId?, amount Decimal,
  appliedAt — feeds analytics; `ResOrderDiscount` keeps the financial line.
- **ResGiftCard**: code (unique per tenant), customerId?, status
  (`ACTIVE|FROZEN|EXPIRED|DEPLETED`), balance Decimal, issuedAmount Decimal,
  expiresAt?, timestamps.
- **ResGiftCardTransaction**: giftCardId, kind (`ISSUE|RELOAD|REDEEM|ADJUST`),
  amount Decimal, orderId?, balanceAfter Decimal, createdAt.
- **ResLoyaltyProgram**: name, pointsPerCurrency Decimal, expiryMonths?,
  isActive (one active per tenant enforced in service).
- **ResLoyaltyTier**: programId, name, minPoints Int, multiplier Decimal, perks?
- **ResLoyaltyReward**: programId, name, costPoints Int, kind
  (`FREE_ITEM|DISCOUNT`), payload Json, isActive.
- **ResLoyaltyLedger**: customerId, programId, kind (`EARN|REDEEM|EXPIRE|
  ADJUST`), points Int, orderId?, rewardId?, balanceAfter Int, createdAt.

Customers 360 is a read-side projection over CRM + `ResOrder`/reservations —
no new customer table (CRM owns the customer aggregate).

## Phase 6 — Functions

- **ResEvent**: branchId, code, kind (`BIRTHDAY|CORPORATE|WEDDING|FAMILY|
  GRADUATION|VIP|HOLIDAY|PRIVATE`), status (`INQUIRY|QUOTED|CONFIRMED|
  IN_PROGRESS|COMPLETED|CANCELLED`), customerId?, hallId? (section uuid),
  startsAt, endsAt, guestCount, packageJson Json (menu/package selection),
  notes?, timestamps.
- **ResEventTask**: eventId, title, dueAt?, status (`TODO|DOING|DONE`),
  assigneeId?, sortOrder.
- **ResEventPayment**: eventId, kind (`DEPOSIT|INSTALLMENT|FINAL|REFUND`),
  amount Decimal, method, paidAt?, reference?.
- **ResPartyBooking**: eventId (unique) — party-specific extension: theme?,
  decorationsJson?, seatingJson (FloorDesigner layout), vendorJson?,
  costAmount Decimal, revenueAmount Decimal.
- **ResCateringJob**: branchId, code, kind (`CORPORATE|DELIVERY|OUTSIDE`),
  status (`DRAFT|CONFIRMED|PREPPING|DISPATCHED|COMPLETED|CANCELLED`),
  customerId?, eventDate, addressLine?, guestCount, menuJson,
  equipmentJson?, vehicleJson?, staffJson?, costAmount Decimal,
  quoteAmount Decimal, timestamps.

## Table position fields (P2, for FloorDesigner adoption)

Extend `ResTable`: `posX Decimal?`, `posY Decimal?`, `width Decimal?`,
`height Decimal?` (normalized [0,1]) — nullable so existing card UI keeps
working until positions are set.
