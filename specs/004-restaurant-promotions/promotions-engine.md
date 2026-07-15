# Promotions Engine Architecture — Feature 004

The promotion engine is **fully data-driven**: no promotion, discount, coupon, or reward logic is
hardcoded in application code. Application code is a generic evaluator over configuration tables.
Adding a "Ramadan family combo −25%" or "Black Friday BOGO" is inserting rows, never a deploy.

## Data model (Phase 7)

```
res_promotions ──1:N── res_promotion_conditions   (ANDed within a group, ORed across groups)
      │        ──1:N── res_promotion_actions       (what to grant when eligible)
      │        ──1:N── res_promotion_targets        (scope: branch / channel / service type / menu)
      │        ──1:N── res_promotion_usage          (counters: global / per-customer / per-branch)
      └────────1:N── res_promotion_applications     (append-only audit: every apply/skip on an order)
```

### res_promotions (header)
- `code`, `name`, `description`, `promoType` (`ResPromoType`), `status` (`ResPromoStatus`:
  `draft/active/paused/expired/archived`), validity window (`startsAt`/`endsAt`),
  `priority Int` (higher wins conflicts), `isStackable Boolean`, `stackGroup String?`
  (non-stackable promotions sharing a group are mutually exclusive), `isExclusive Boolean`
  (wins the whole order alone), `requiresCoupon Boolean`, `requiresApproval`, `maxDiscount`
  (`Decimal(19,4)` cap), `budgetAmount?`, `campaignId?`, per-scope flags.

### res_promotion_conditions (many; the "IF")
- `conditionGroup Int` (conditions in the same group are ANDed; groups are ORed),
  `conditionType` (`ResPromoConditionType`), `operator` (`ResPromoOperator`:
  `eq/neq/gte/lte/gt/lt/in/not_in/between`), `valueJson` (operand, e.g. `{ "amount": "100.00" }`,
  `{ "segmentIds": [...] }`, `{ "from": "16:00", "to": "18:00" }`, `{ "weekdays": [2,3,4] }`,
  `{ "categoryIds": [...] }`, `{ "min": 2 }`).

`ResPromoConditionType` values: `MIN_ORDER`, `MAX_DISCOUNT`, `CUSTOMER_GROUP`, `CUSTOMER_SEGMENT`,
`LOYALTY_TIER`, `CUSTOMER_BIRTHDAY`, `FIRST_ORDER`, `NTH_ORDER`, `ORDER_TIME`, `DATE_RANGE`,
`WEEKDAY`, `MONTH`, `BRANCH`, `RESTAURANT`, `ORDER_SOURCE`, `SERVICE_TYPE`, `PAYMENT_METHOD`,
`MENU`, `CATEGORY`, `PRODUCT`, `QUANTITY`, `REQUIRED_PRODUCTS`, `EXCLUDED_PRODUCTS`,
`INCLUDED_CATEGORIES`, `EXCLUDED_CATEGORIES`, `COUPON_PRESENT`, `EMPLOYEE`, `STUDENT`, `VIP`.

### res_promotion_actions (many; the "THEN")
- `actionType` (`ResPromoActionType`), `valueJson`, `maxAmount?`, `targetScope`
  (`order/line/category/product/delivery/cheapest_item/most_expensive_item`), `sortOrder`.

`ResPromoActionType` values: `DISCOUNT_PERCENT`, `DISCOUNT_FIXED`, `PRICE_OVERRIDE`,
`BUY_X_GET_Y`, `ADD_FREE_ITEM`, `FREE_DELIVERY`, `FREE_UPGRADE`, `AWARD_POINTS`, `CASHBACK`,
`GIFT_CARD_CREDIT`.

### res_promotion_usage & res_promotion_applications
- `res_promotion_usage`: `scope` (`global/customer/branch`), `scopeRefId?`, `usedCount`,
  `limitCount?`, `periodKey?` (for per-day/per-month limits). Incremented atomically on apply.
- `res_promotion_applications` (append-only ledger, `BigInt` id): `promotionId`, `orderId`,
  `outcome` (`applied/skipped/rejected`), `reason?`, `discountAmount`, `snapshotJson` (conditions
  matched + actions applied), `actorProfileId?`, `createdAt`. Feeds promotion-usage reporting.

## Evaluation flow (`src/server/restaurant/promotions/promotion-engine.ts`)

A **pure function** over an evaluation context and a set of candidate promotions — no DB or clock
access inside (both injected), so it is exhaustively unit-testable.

```
evaluatePromotions(context, candidates) -> PromotionOutcome
```

1. **Build context** (`buildEvalContext`): order snapshot (lines w/ menuItemId, productId,
   categoryId, qty, unitPrice), customer facts (segments, loyalty tier, order count, birthday,
   group, VIP/employee/student flags — read from CRM projections), branch, service type, channel,
   payment method(s), evaluation time (injected).
2. **Fetch candidates**: active promotions whose validity window contains `now` and whose targets
   include the order's scope (branch/channel/service type). Coupon-gated promotions only enter if a
   valid coupon is present.
3. **Filter by eligibility**: for each candidate, evaluate its condition groups — a group passes
   when all its conditions pass; the promotion is eligible when any group passes (AND-within /
   OR-across). Usage limits are checked here (global/customer/branch) — a promotion at its limit is
   ineligible.
4. **Resolve conflicts**:
   - Any eligible `isExclusive` promotion with the highest priority wins the order alone.
   - Otherwise sort eligible by `priority` desc. Walk the list applying promotions; skip a
     promotion whose `stackGroup` already has an applied member and which is not `isStackable`.
     Non-stackable + no group ⇒ only the top-priority non-stackable applies.
5. **Apply actions** to an **immutable pricing snapshot** (new object per step — never mutate the
   order): compute discount lines, free items, upgrades, points, cashback, free delivery. Respect
   per-promotion `maxDiscount` and per-action `maxAmount`.
6. **Emit outcome**: `{ pricing, appliedPromotions[], skippedPromotions[], freeItems[], points,
   cashback }`. The caller persists `res_promotion_applications` (applied + skipped + rejected) and
   increments `res_promotion_usage` atomically when the order commits.

Coupons, loyalty rewards, gift cards, and campaigns are **sources of candidates/conditions/actions**,
not separate engines: a coupon carries a `promotionId`; a campaign assigns promotions; a loyalty
reward is a promotion with an `AWARD_POINTS`/`GIFT_CARD_CREDIT` action.

## Re-evaluation points
- **Order pricing** (draft → confirmed): preview promotions.
- **Payment**: re-evaluate (a validity window may have closed, coupon may have expired) — the
  applied set at payment is authoritative and is what the application ledger records.

## Testing surface (highest value)
Table-driven vitest cases per `conditionType` and per `actionType`; stacking/exclusive/priority
conflict matrices; usage-limit enforcement (global/customer/branch); immutability assertions on the
pricing snapshot; coupon-gated candidacy; BOGO cheapest-item selection.
