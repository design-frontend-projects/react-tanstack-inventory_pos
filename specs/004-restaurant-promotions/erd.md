# Entity Relationship Diagrams — Feature 004

Mermaid ERDs per domain. Only intra-module relationships are drawn as crow's-foot lines. Cross-module
references (to `products`, `customers`, `warehouses`, `crm_*`) are **bare scalar UUIDs** with
app-enforced integrity and are shown as annotated `FK` columns, not relationship lines — consistent
with the inventory/CRM convention. Every table also carries `tenant_id` (omitted from diagrams for
readability; it leads every unique/index).

## Master data (Phase 1)

```mermaid
erDiagram
  res_restaurants ||--o{ res_branches : has
  res_branches ||--o{ res_business_hours : opens
  res_branches ||--o{ res_holidays : closes
  res_branches ||--o{ res_dining_areas : contains
  res_dining_areas ||--o{ res_table_sections : groups
  res_table_sections ||--o{ res_tables : seats
  res_tables ||--o| res_table_qr_codes : encodes
  res_branches ||--o{ res_service_types : offers
  res_branches ||--o{ res_shifts : schedules
  res_branches ||--o{ res_kitchen_stations : routes
  res_kitchen_stations ||--o{ res_kitchen_printers : prints
  res_branches ||--o{ res_tax_configs : taxes
  res_branches ||--o{ res_service_charge_rules : charges
  res_branches ||--o{ res_delivery_settings : delivers
  res_branches ||--o{ res_takeaway_settings : takeaway
  res_branches ||--o{ res_number_sequences : numbers
  res_branches ||--o{ res_receipt_templates : formats
  res_branches ||--o{ res_branch_members : staffs
  res_restaurants ||--o| res_restaurant_settings : configures
  res_branches ||--o| res_branch_settings : configures
```

## Menu (Phase 2)

```mermaid
erDiagram
  res_menus ||--o{ res_menu_categories : groups
  res_menu_categories ||--o{ res_menu_categories : subcategory
  res_menu_categories ||--o{ res_menu_items : lists
  res_menu_items ||--o{ res_menu_item_variants : varies
  res_menu_items ||--o{ res_menu_item_prices : priced
  res_menu_items ||--o{ res_menu_item_modifier_groups : uses
  res_modifier_groups ||--o{ res_modifiers : offers
  res_menu_item_modifier_groups }o--|| res_modifier_groups : links
  res_menu_items ||--o{ res_menu_item_allergens : warns
  res_menu_items ||--o{ res_menu_item_tags : tagged
  res_menu_items ||--o{ res_menu_availability : scheduled
  res_menu_items ||--o{ res_cross_sells : suggests
  res_combos ||--o{ res_combo_components : bundles
```

## Recipes (Phase 3)

```mermaid
erDiagram
  res_recipes ||--o{ res_recipe_versions : versioned
  res_recipe_versions ||--o{ res_recipe_lines : consumes
  res_recipe_versions ||--o{ res_recipe_steps : prepares
  res_recipe_versions ||--o{ res_recipe_sub_recipes : includes
  res_recipe_versions ||--o{ res_recipe_approvals : approves
  res_recipes }o..o| res_menu_items : "FK menu_item_id"
  res_recipe_lines }o..o| products : "FK product_id (inventory)"
```

## Orders (Phase 4)

```mermaid
erDiagram
  res_orders ||--o{ res_order_items : contains
  res_order_items ||--o{ res_order_item_modifiers : customizes
  res_orders ||--o{ res_order_payments : settles
  res_orders ||--o{ res_order_discounts : discounts
  res_orders ||--o{ res_order_charges : charges
  res_orders ||--o{ res_order_splits : splits
  res_orders ||--o{ res_order_transfers : transfers
  res_orders ||--o{ res_order_events : audits
  res_orders }o..o| res_tables : "FK table_id"
  res_orders }o..o| customers : "FK customer_id (crm)"
  res_order_items }o..o| res_menu_items : "FK menu_item_id"
```

## Kitchen Display System (Phase 5)

```mermaid
erDiagram
  res_orders ||--o{ res_kitchen_tickets : fires
  res_kitchen_tickets ||--o{ res_kitchen_ticket_items : lists
  res_kitchen_tickets ||--o{ res_kitchen_ticket_events : audits
  res_kitchen_tickets }o..o| res_kitchen_stations : "FK station_id"
  res_kitchen_ticket_items }o..o| res_order_items : "FK order_item_id"
  res_kitchen_stations ||--o{ res_kitchen_queue : queues
```

## Reservations (Phase 6)

```mermaid
erDiagram
  res_reservations ||--o{ res_reservation_notes : notes
  res_reservations ||--o| res_reservation_deposits : holds
  res_reservations ||--o{ res_table_allocations : assigns
  res_waitlist ||--o| res_table_allocations : promotes
  res_reservations }o..o| res_tables : "FK table_id"
  res_reservations }o..o| customers : "FK customer_id (crm)"
  res_walk_ins }o..o| res_tables : "FK table_id"
```

## Promotions (Phase 7)

```mermaid
erDiagram
  res_promotions ||--o{ res_promotion_conditions : requires
  res_promotions ||--o{ res_promotion_actions : grants
  res_promotions ||--o{ res_promotion_targets : scopes
  res_promotions ||--o{ res_promotion_usage : limits
  res_promotions ||--o{ res_promotion_applications : records
  res_promotion_applications }o..o| res_orders : "FK order_id"
  res_promotions }o..o| res_promotion_types : "FK type"
```

## Coupons, Loyalty, Gift cards (Phase 8)

```mermaid
erDiagram
  res_coupon_batches ||--o{ res_coupons : issues
  res_coupons ||--o{ res_coupon_redemptions : redeemed
  res_gift_cards ||--o{ res_gift_card_transactions : ledger
  res_coupons }o..o| res_promotions : "FK promotion_id"
  res_loyalty_rewards }o..o| res_promotions : "FK promotion_id"
  res_coupon_redemptions }o..o| res_orders : "FK order_id"
```

## Campaigns (Phase 9)

```mermaid
erDiagram
  res_campaigns ||--o{ res_campaign_targets : targets
  res_campaigns ||--o{ res_campaign_segments : audiences
  res_campaigns ||--o{ res_campaign_promotions : assigns
  res_campaigns ||--o{ res_campaign_metrics : measures
  res_campaign_segments }o..o| crm_segments : "FK segment_id (crm)"
  res_campaign_promotions }o--|| res_promotions : links
```

## Reporting (Phase 10)

```mermaid
erDiagram
  domain_events ||..o{ res_report_daily_sales : "folds into"
  domain_events ||..o{ res_report_item_sales : "folds into"
  domain_events ||..o{ res_report_kitchen_perf : "folds into"
  domain_events ||..o{ res_report_promotion_usage : "folds into"
```
