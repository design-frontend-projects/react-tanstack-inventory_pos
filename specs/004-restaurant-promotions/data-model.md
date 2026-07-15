# Data Model — Restaurant Management & Promotions (Feature 004)

The authoritative schema is `prisma/schema.prisma`; this document tracks the restaurant domain model
and its build status, **bilingually (English / العربية)** per the feature request. Each entity gives
its business purpose, key columns, relationships, and validation, in both languages.

## Conventions

Inherits every feature 001/002/003 convention: `id String @id @default(uuid()) @db.Uuid`; camelCase
fields with explicit snake_case `@map`/`@@map`; every tenant-owned model carries `tenantId` +
`tenant TenantAccount @relation(onDelete: Cascade)` and a back-relation array on `TenantAccount`;
enums `UPPER @map("lower")` + `@@map("PascalCase")`; `createdAt` always, `updatedAt @updatedAt` on
mutable rows only, `deletedAt?` on masters only; actor columns are bare `*ProfileId String? @db.Uuid`
scalars; **cross-aggregate references (productId, customerId, warehouseId, menuItemId, branchId…) are
bare scalar UUIDs with app-enforced integrity**; money `Decimal(19,4)`, quantities `Decimal(18,4)`,
costs `Decimal(19,6)`, rates/multipliers `Decimal(9,6)`, geo `Decimal(9,6)`; tenant-leading named
indexes.

**Restaurant-specific additions:**
- All restaurant tables use the **`res_` prefix** (explicit product requirement), matching the
  `crm_` precedent.
- **Branch is the operational scope** beneath tenant. Branch-scoped tables carry `branchId` (bare
  scalar → `res_branches.id`) in addition to `tenantId`, and `branchId` leads their operational
  indexes.
- **Append-only ledgers** (`res_order_events`, `res_kitchen_ticket_events`,
  `res_promotion_applications`, `res_gift_card_transactions`, `res_coupon_redemptions`) omit
  `updatedAt`/`deletedAt`; high-volume ones use `id BigInt @id @default(autoincrement())`.
- **RLS-ready:** every table has `tenant_id NOT NULL`. Isolation stays app-enforced (see Appendix B).
- **Integration:** stock via inventory services (never direct movement writes); customer intelligence
  via `domain_events`; see `integration.md`.

> **مقدمة (AR):** الجدول المرجعي الرسمي هو `prisma/schema.prisma`. تتبع وحدة المطاعم نفس اصطلاحات
> الوحدات السابقة: مفاتيح UUID، أعمدة snake_case، عزل المستأجر عبر `tenantId`، والقيم النقدية بدقة
> عشرية محددة. تبدأ جميع الجداول بالبادئة `res_`، والفرع هو نطاق التشغيل تحت المستأجر، والمخزون لا
> تملكه المطاعم بل يُستهلك عبر الوصفات.

---

## Planned — Phase 1 (restaurant master data)

**Restaurant** (`res_restaurants`) — the brand/company entity beneath a tenant; a tenant may run
several restaurant brands. **EN:** master row holding `code`, `name`, `legalName?`, `brandColor?`,
`logoUrl?`, `defaultCurrency`, `defaultLocale`, `status ResRestaurantStatus`, `isActive`,
`deletedAt?`. Root of the branch tree. **AR (المطعم):** الكيان التجاري للعلامة تحت المستأجر؛ يمكن
للمستأجر إدارة عدة علامات مطاعم. يحتوي على الكود والاسم والعملة واللغة الافتراضية والحالة. جذر شجرة
الفروع. *Validation:* `@@unique([tenantId, code])`; currency ISO-4217; locale ∈ {en, ar}.

**RestaurantBranch** (`res_branches`) — a physical outlet. **EN:** `restaurantId` (scalar),
`code`, `name`, `warehouseId?` (bare scalar → `warehouses.id`; the stock source),
`addressJson`, `phone?`, `timezone`, `latitude?/longitude? Decimal(9,6)`, `currencyCode`,
`isDefault`, `status ResBranchStatus`, `openedAt?`, `deletedAt?`. The operational scope for orders,
tables, menus-in-service, and sequences. **AR (الفرع):** منفذ مادي؛ يحمل الكود والاسم والمستودع
المصدر للمخزون والعنوان والمنطقة الزمنية والإحداثيات والحالة. هو نطاق التشغيل للطلبات والطاولات
والأرقام التسلسلية. *Validation:* `@@unique([tenantId, code])`; a branch serving stock-tracked
recipes must have `warehouseId`.

**BranchMember** (`res_branch_members`) — which tenant users may operate which branches. **EN:**
`branchId`, `profileId` (scalar → `profiles.id`), `roleCode?` (a `res:` role), `isActive`. Enforces
branch-level scope in services (guard proves tenant+permission; this proves branch). **AR (عضو
الفرع):** يحدد أي مستخدمين يمكنهم تشغيل أي فرع؛ يفرض نطاق الفرع في طبقة الخدمة. *Validation:*
`@@unique([tenantId, branchId, profileId])`.

**BusinessHours** (`res_business_hours`) — weekly opening template. **EN:** `branchId`, `dayOfWeek
Int (0–6)`, `opensAt`/`closesAt` (minutes or `HH:mm`), `isClosed`, `serviceTypeId?` (hours can vary
by service type). **AR (ساعات العمل):** قالب أسبوعي لأوقات الفتح والإغلاق لكل يوم، مع دعم اختلافها
حسب نوع الخدمة. *Validation:* `opensAt < closesAt` unless overnight flag.

**Holiday** (`res_holidays`) — calendar closures/special days. **EN:** `branchId`, `date`, `name`,
`isClosed`, `specialHoursJson?`. Drives holiday pricing and closures. **AR (العطلات):** أيام الإغلاق
أو الأيام الخاصة التي تؤثر على التسعير وساعات العمل. *Validation:* `@@unique([tenantId, branchId,
date])`.

**DiningArea** (`res_dining_areas`) — a top-level floor zone (e.g. Terrace, Main Hall). **EN:**
`branchId`, `code`, `name`, `displayOrder`, `isActive`. **AR (منطقة الطعام):** منطقة رئيسية في
الصالة مثل الشرفة أو القاعة الرئيسية. *Validation:* `@@unique([tenantId, branchId, code])`.

**TableSection** (`res_table_sections`) — a subdivision of a dining area (waiter station/zone).
**EN:** `diningAreaId` (scalar), `branchId`, `code`, `name`, `displayOrder`. **AR (قسم الطاولات):**
تقسيم فرعي لمنطقة الطعام يمثل نطاق خدمة نادل. *Validation:* unique per area+code.

**RestaurantTable** (`res_tables`) — a physical table. **EN:** `sectionId` (scalar), `branchId`,
`code`/`number`, `seats Int`, `minCapacity?`, `shape?`, `status ResTableStatus`
(`available/occupied/reserved/blocked`), `isActive`, `deletedAt?`. One active order per table
(enforced in service). **AR (الطاولة):** طاولة مادية بعدد مقاعد وحالة؛ يُسمح بطلب نشط واحد لكل طاولة.
*Validation:* `@@unique([tenantId, branchId, code])`.

**TableQrCode** (`res_table_qr_codes`) — QR encoding for guest ordering. **EN:** `tableId` (scalar),
`branchId`, `token @unique`, `targetUrl`, `isActive`, `rotatedAt?`. **AR (رمز QR للطاولة):** رمز
استجابة سريعة لكل طاولة لتمكين الطلب الذاتي من الضيف. *Validation:* `token` globally unique.

**ServiceType** (`res_service_types`) — configurable order-fulfillment channel (dine-in, takeaway,
pickup, delivery, drive-thru, QR, web, app, phone, third-party). **EN:** `branchId?` (null = tenant
default set), `code`, `name`, `kind ResServiceKind`, `isActive`, `settingsJson`. **Future order types
are just new rows.** **AR (نوع الخدمة):** قناة تنفيذ الطلب قابلة للتهيئة (صالة، سفري، توصيل...)؛ أي
نوع مستقبلي هو مجرد صف جديد. *Validation:* `@@unique([tenantId, branchId, code])`.

**Shift** (`res_shifts`) — operational shift windows for staffing/reporting. **EN:** `branchId`,
`code`, `name`, `startsAt`/`endsAt`, `daysJson`, `isActive`. **AR (الوردية):** نوافذ الورديات
التشغيلية لأغراض التوظيف والتقارير. *Validation:* unique per branch+code.

**KitchenStation** (`res_kitchen_stations`) — a prep station orders route to (Grill, Bar, Cold).
**EN:** `branchId`, `code`, `name`, `displayOrder`, `isActive`. Referenced by menu items (routing)
and KDS tickets. **AR (محطة المطبخ):** محطة تحضير تُوجَّه إليها الأصناف مثل الشواء أو البار.
*Validation:* unique per branch+code.

**KitchenPrinter** (`res_kitchen_printers`) — a printer bound to a station. **EN:** `stationId`
(scalar), `branchId`, `code`, `name`, `connectionJson`, `isActive`. **AR (طابعة المطبخ):** طابعة
مرتبطة بمحطة لطباعة تذاكر التحضير. *Validation:* unique per branch+code.

**ReceiptTemplate** (`res_receipt_templates`) — configurable receipt/invoice layout. **EN:**
`branchId?`, `code`, `name`, `templateType` (`receipt/invoice/kitchen_ticket`), `layoutJson`,
`isDefault`, `isActive`. **AR (قالب الإيصال):** تخطيط قابل للتهيئة للإيصالات والفواتير وتذاكر
المطبخ. *Validation:* one default per (branch, templateType).

**TaxConfig** (`res_tax_configs`) — tax rule applied to orders/lines. **EN:** `branchId?`, `code`,
`name`, `rate Decimal(9,6)`, `isInclusive`, `appliesTo` (`order/line/service_charge/delivery`),
`taxRateId?` (bare scalar → inventory `tax_rates.id` for reuse), `isActive`. Multiple configs per
branch supported. **AR (إعداد الضريبة):** قاعدة ضريبية تُطبَّق على الطلبات أو البنود بنسبة ومعرفة إن
كانت شاملة، مع دعم عدة إعدادات لكل فرع. *Validation:* rate ∈ [0,1].

**ServiceChargeRule** (`res_service_charge_rules`) — auto service charge. **EN:** `branchId?`,
`code`, `name`, `chargeType` (`percent/fixed`), `value Decimal(19,4)`, `appliesToServiceTypeJson?`,
`minGuests?`, `isTaxable`, `isActive`. **AR (رسوم الخدمة):** رسوم خدمة تلقائية بنسبة أو قيمة ثابتة،
قابلة للتطبيق حسب نوع الخدمة وعدد الضيوف. *Validation:* percent value ∈ [0,1] when `percent`.

**DeliverySettings** (`res_delivery_settings`) — delivery configuration. **EN:** `branchId`,
`baseFee Decimal(19,4)`, `perKmFee?`, `freeThreshold?`, `maxRadiusKm?`, `zonesJson?`,
`estimatedMinutes?`, `isActive`. **AR (إعدادات التوصيل):** تهيئة التوصيل من رسوم أساسية ورسوم لكل
كيلومتر وحد مجاني ونطاق ومناطق. *Validation:* one active row per branch.

**TakeawaySettings** (`res_takeaway_settings`) — takeaway/pickup configuration. **EN:** `branchId`,
`prepBufferMinutes`, `packagingFee?`, `pickupSlotsJson?`, `isActive`. **AR (إعدادات السفري):** تهيئة
السفري/الاستلام من مهلة التحضير ورسوم التغليف وفترات الاستلام. *Validation:* one active row per branch.

**NumberSequence** (`res_number_sequences`) — per-branch atomic numbering (order/invoice/ticket).
**EN:** `branchId`, `sequenceType` (`order/invoice/kitchen_ticket/reservation`), `prefix?`,
`pattern?`, `nextValue BigInt`, `padding?`, `periodKey?` (for daily reset). Issued atomically inside
the source transaction. **AR (تسلسل الأرقام):** ترقيم ذري لكل فرع للطلبات والفواتير والتذاكر، مع دعم
البادئة والنمط وإعادة التصفير اليومي. *Validation:* `@@unique([tenantId, branchId, sequenceType,
periodKey])`.

**RestaurantSettings** (`res_restaurant_settings`) / **BranchSettings** (`res_branch_settings`) —
free-form configuration bags (1:1). **EN:** `restaurantId`/`branchId`, `settingsJson`
(feature flags, rounding mode, tipping policy, currency display, KDS behavior…). **AR (إعدادات
المطعم/الفرع):** حاويات تهيئة مرنة لكل مطعم/فرع تضم أعلام الميزات وسياسة التقريب والإكراميات وسلوك
شاشة المطبخ. *Validation:* one row per parent.

---

## Planned — Phase 2 (menu management)

**Menu** (`res_menus`) — a named, scheduled menu (Breakfast, All-Day, Ramadan). `branchId?`,
`code`, `name`, `menuType`, validity window, `isActive`. **AR (القائمة):** قائمة مسماة ومجدولة.
**MenuCategory** (`res_menu_categories`) — self-nesting categories/subcategories (`parentId?`,
`displayOrder`, `imageUrl?`). **AR (فئة القائمة):** فئات وفئات فرعية متداخلة. **MenuItem**
(`res_menu_items`) — the sellable item: `categoryId`, `code`, `name`, `description?`, `basePrice`,
`kitchenStationId?` (routing), `prepTimeMinutes?`, `calorieCount?`, `nutritionJson?`,
`cookingInstructions?`, `isFeatured`, `isSeasonal`, `visibility ResMenuVisibility`, `status`,
`deletedAt?`. **AR (صنف القائمة):** الصنف القابل للبيع بسعره الأساسي ووقت تحضيره ومحطته وحالته.
**MenuItemVariant** (`res_menu_item_variants`) — size/variant with price delta and optional
`productVariantId` (scalar → inventory). **MenuItemPrice** (`res_menu_item_prices`) — a price rule:
`priceType` (`base/happy_hour/weekend/holiday/delivery/takeaway/channel`), `amount`, `serviceTypeId?`,
`channel?`, `scheduleJson` (weekdays + time window + date range), `priority`. Resolved by the pricing
resolver (see promotions/pricing). **AR (سعر الصنف):** قاعدة سعر بنوعها وجدولها وأولويتها.
**ModifierGroup** (`res_modifier_groups`) — a set of choices (`selectionType` single/multi,
`minSelect`, `maxSelect`, `isRequired`). **Modifier** (`res_modifiers`) — a choice: `groupId`,
`name`, `priceDelta`, `productId?` (extra ingredient consumes inventory), `isDefault`.
**MenuItemModifierGroup** (`res_menu_item_modifier_groups`) — links items ↔ groups with overrides.
**Combo** (`res_combos`) + **ComboComponent** (`res_combo_components`) — meal deals/bundles with
fixed or discounted component pricing and swap rules. **MenuItemAllergen**
(`res_menu_item_allergens`) / **MenuItemTag** (`res_menu_item_tags`) — allergens, diet types, tags.
**MenuAvailability** (`res_menu_availability`) — per-item availability schedule + stock-out toggle.
**CrossSell** (`res_cross_sells`) — cross/up-sell and recommended/related links (`sourceItemId`,
`targetItemId`, `relationType`). **AR:** المُعدِّلات والإضافات والوجبات المدمجة والحساسيات والوسوم
وجداول التوفر والبيع المتقاطع/الإضافي — كلها قابلة للتهيئة بالكامل.

## Planned — Phase 3 (recipe management)

**Recipe** (`res_recipes`) — binds a menu item/variant to a production formula: `menuItemId`,
`variantId?`, `name`, `status ResRecipeStatus` (`draft/approved/archived`), `currentVersionId?`,
`yieldQty Decimal(18,4)`, `yieldUom?`. **RecipeVersion** (`res_recipe_versions`) — immutable version:
`recipeId`, `versionNo`, `notes?`, `computedCost Decimal(19,6)?`, `approvedByProfileId?`,
`approvedAt?`. **RecipeLine** (`res_recipe_lines`) — an ingredient: `versionId`, `productId` (scalar
→ inventory), `variantId?`, `quantity Decimal(18,4)`, `uomId?`, `wastePercent Decimal(9,6)`,
`isOptional`. **RecipeSubRecipe** (`res_recipe_sub_recipes`) — nested prep (`parentVersionId`,
`childRecipeId`, `quantity`). **RecipeStep** (`res_recipe_steps`) — ordered preparation steps.
**RecipeApproval** (`res_recipe_approvals`) — approval workflow trail. **AR:** إدارة الوصفات تربط
أصناف القائمة بمنتجات المخزون مع نسب الهدر والإنتاجية والإصدارات والتكلفة المحسوبة والاعتماد.
*Cost recalculation* reads inventory product cost on demand (see `integration.md`).

## Planned — Phase 4 (order lifecycle)

**RestaurantOrder** (`res_orders`) — the order aggregate: `branchId`, `orderNumber`, `tableId?`,
`customerId?` (scalar → crm `customers`), `serviceTypeId`, `orderType ResOrderType`,
`channel ResOrderChannel`, `status ResOrderStatus` (`draft/open/confirmed/preparing/cooking/ready/
served/completed/cancelled/refunded/voided`), `guestCount`, `subtotal`, `discountTotal`, `taxTotal`,
`serviceChargeTotal`, `deliveryFee`, `tipTotal`, `roundingTotal`, `grandTotal`, `amountPaid`,
`currencyCode`, `notes?`, `kitchenNotes?`, `sourceRef?`, `openedByProfileId?`, `closedByProfileId?`,
`voidReasonId?`, `cancelReasonId?`, `completedAt?`. **AR (الطلب):** تجميعة الطلب بدورة حياتها الكاملة
وإجماليّاتها المالية ومصدرها ونوعها. **RestaurantOrderItem** (`res_order_items`) — a line:
`orderId`, `menuItemId`, `variantId?`, `productId?` (denormalized for consumption/reporting), `name`,
`quantity`, `unitPrice`, `lineDiscount`, `lineTax`, `lineTotal`, `status`, `stationId?`,
`specialRequest?`, `voidReasonId?`. **OrderItemModifier** (`res_order_item_modifiers`) — chosen
modifiers with price deltas. **OrderPayment** (`res_order_payments`) — `method ResPaymentMethod`
(`cash/card/wallet/loyalty/gift_card/online/third_party`), `amount`, `splitId?`, `reference?`,
`status`. **OrderDiscount** (`res_order_discounts`) — applied discount/promotion lines (`promotionId?`,
`couponId?`, `reasonId?`, `amount`). **OrderCharge** (`res_order_charges`) — service charge/delivery/
tip/rounding lines. **OrderSplit** (`res_order_splits`) — bill splits (by seat/amount/item).
**OrderTransfer** (`res_order_transfers`) — table/order transfers + merges (`fromTableId`,
`toTableId`, `type`). **OrderEvent** (`res_order_events`, append-only `BigInt`) — every state
transition with `fromStatus`/`toStatus`, `actorProfileId?`, `reason?`, `payloadJson`. **VoidReason**
(`res_void_reasons`) / **CancelReason** (`res_cancel_reasons`) — configurable reason lookups. **AR:**
تدعم الطلبات التقسيم والدمج والتحويل والإكراميات والتقريب وسجل تدقيق كامل، وتُحدِث المخزون عند
التأكيد/التقديم وتُصدر أحداث الدومين عند الإكمال/الاسترجاع.

## Planned — Phase 5 (kitchen display system)

**KitchenTicket** (`res_kitchen_tickets`) — one per (order, station): `orderId`, `branchId`,
`stationId`, `ticketNumber`, `status ResKitchenTicketStatus` (`queued/preparing/cooking/ready/served/
recalled/cancelled`), `priority ResKitchenPriority` (`normal/rush/vip`), `firedAt`, `startedAt?`,
`readyAt?`, `servedAt?`, `prepSeconds?`. **KitchenTicketItem** (`res_kitchen_ticket_items`) —
`ticketId`, `orderItemId`, `name`, `quantity`, `status`, `modifiersJson`, `notes?`.
**KitchenTicketEvent** (`res_kitchen_ticket_events`, append-only) — status transitions + timers.
**KitchenQueue** (`res_kitchen_queue`) — live queue projection per station (position, waitSeconds).
**StationAssignment** (`res_station_assignments`) — staff↔station assignment per shift. **AR:** نظام
شاشة المطبخ يوجّه الأصناف إلى المحطات، ويتتبّع حالات التحضير والطهي والجاهزية ومؤقتات الطهي والأولوية
وأداء المطبخ.

## Planned — Phase 6 (reservations & table service)

**Reservation** (`res_reservations`) — `branchId`, `customerId?`, `reservationNumber`, `partySize`,
`scheduledAt`, `durationMinutes`, `status ResReservationStatus` (`pending/confirmed/seated/completed/
cancelled/no_show`), `source ResReservationSource`, `tableId?`, `guestName?`, `guestPhone?`,
`preferencesJson?`, `depositId?`. **WalkIn** (`res_walk_ins`) — unbooked arrivals seated ad-hoc.
**Waitlist** (`res_waitlist`) — queued parties with `quotedWaitMinutes`, `notifiedAt?`, `status`.
**ReservationDeposit** (`res_reservation_deposits`) — `amount`, `method`, `status`, `refundedAt?`.
**ReservationNote** (`res_reservation_notes`) — staff notes. **TableAllocation**
(`res_table_allocations`) — assignment of a table to a reservation/walk-in/waitlist entry with
auto-allocation metadata. **AR:** إدارة الحجوزات والانتظار والطاولات مع الودائع وحالات عدم الحضور
والتخصيص التلقائي للطاولات ومنع الحجز المزدوج.

## Planned — Phase 7 (promotions engine)

See `promotions-engine.md` for the full architecture. **Promotion** (`res_promotions`),
**PromotionType** (`res_promotion_types`, lookup), **PromotionCondition**
(`res_promotion_conditions`), **PromotionAction** (`res_promotion_actions`), **PromotionTarget**
(`res_promotion_targets`), **PromotionUsage** (`res_promotion_usage`), **PromotionApplication**
(`res_promotion_applications`, append-only `BigInt` ledger). **AR:** محرك العروض قابل للتهيئة بالكامل
عبر شروط وإجراءات، مع الأولوية والتراكم وحل التعارض وحدود الاستخدام وسجل تطبيق كامل — لا منطق مبرمج
ثابت.

## Planned — Phase 8 (coupons, loyalty, gift cards)

**CouponBatch** (`res_coupon_batches`) — generation config (`promotionId`, `quantity`, `codePattern`,
`singleUse`, `perCustomerLimit`, `expiresAt`). **Coupon** (`res_coupons`) — `code @unique`,
`batchId?`, `promotionId`, `customerId?`, `status`, `usedCount`, `maxUses`, `expiresAt`.
**CouponRedemption** (`res_coupon_redemptions`, append-only) — `couponId`, `orderId`, `customerId?`,
`discountAmount`. **GiftCard** (`res_gift_cards`) — `code @unique`, `initialBalance`, `balance`,
`currencyCode`, `status`, `customerId?`, `expiresAt`. **GiftCardTransaction**
(`res_gift_card_transactions`, append-only) — `cardId`, `type` (`issue/reload/redeem/adjust/expire`),
`amount`, `balanceAfter`, `orderId?`. **LoyaltyReward** (`res_loyalty_rewards`) — a redeemable reward
mapped to a promotion (`AWARD_POINTS`/`GIFT_CARD_CREDIT` bridge to CRM loyalty ledger). **AR:**
الكوبونات والولاء وبطاقات الهدايا؛ يجسر الولاء إلى سجل الولاء في CRM، وبطاقات الهدايا مملوكة للمطعم
بسجل معاملات إضافي فقط.

## Planned — Phase 9 (marketing campaigns)

**Campaign** (`res_campaigns`) — `code`, `name`, `campaignType`, `status`, schedule, `budgetAmount?`,
`spentAmount`. **CampaignTarget** (`res_campaign_targets`) — targeting rules. **CampaignSegment**
(`res_campaign_segments`) — links to `crm_segments` (scalar). **CampaignPromotion**
(`res_campaign_promotions`) — assigned promotions. **CampaignMetric** (`res_campaign_metrics`) —
performance projection (reach, redemptions, revenue, ROI). **AR:** حملات تسويقية بميزانيات واستهداف
لشرائح CRM وربط العروض ومقاييس الأداء.

## Planned — Phase 10 (reporting)

Projection tables folded from `domain_events` (CRM-style, guarded by a sequence cursor):
**ResReportDailySales** (`res_report_daily_sales`), **ResReportItemSales** (`res_report_item_sales`),
**ResReportKitchenPerf** (`res_report_kitchen_perf`), **ResReportPromotionUsage**
(`res_report_promotion_usage`). Heavy cross-cuts may add Postgres **materialized views**. Report
server functions serve daily/hourly/branch sales, cashier/waiter/kitchen performance, popular/slow
items, food cost, average ticket, table turnover, promotion/coupon usage, refunds, tax, delivery.
**AR:** جداول إسقاط تُبنى من أحداث الدومين لخدمة تقارير المبيعات والأداء وتكلفة الطعام ودوران
الطاولات واستخدام العروض دون إعادة تشغيل المعاملات.

---

## Appendix A — Reserved enums

`ResRestaurantStatus`, `ResBranchStatus`, `ResTableStatus`, `ResServiceKind`, `ResMenuVisibility`,
`ResRecipeStatus`, `ResOrderStatus`, `ResOrderType`, `ResOrderChannel`, `ResPaymentMethod`,
`ResKitchenTicketStatus`, `ResKitchenPriority`, `ResReservationStatus`, `ResReservationSource`,
`ResPromoType`, `ResPromoStatus`, `ResPromoConditionType`, `ResPromoOperator`, `ResPromoActionType`,
`ResCouponStatus`, `ResGiftCardStatus`, `ResCampaignStatus`. Values are defined phase-by-phase in
`schema.prisma`.

## Appendix B — RLS readiness

Every `res_` table has `tenant_id NOT NULL`. When RLS is enabled platform-wide, a uniform policy
`USING (tenant_id = current_setting('app.tenant_id')::uuid)` applies to all `res_` tables; branch
scope stays app-enforced via `res_branch_members`. No exemptions (unlike CRM's global
`crm_projection_cursors`), because restaurant projection cursors are modeled per-tenant.
