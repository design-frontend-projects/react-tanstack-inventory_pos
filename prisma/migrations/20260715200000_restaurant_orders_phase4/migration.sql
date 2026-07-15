-- CreateEnum
CREATE TYPE "ResOrderStatus" AS ENUM ('draft', 'open', 'confirmed', 'preparing', 'cooking', 'ready', 'served', 'completed', 'cancelled', 'refunded', 'voided');

-- CreateEnum
CREATE TYPE "ResOrderType" AS ENUM ('dine_in', 'takeaway', 'pickup', 'delivery', 'drive_thru');

-- CreateEnum
CREATE TYPE "ResOrderChannel" AS ENUM ('pos', 'qr', 'website', 'mobile_app', 'phone', 'third_party');

-- CreateEnum
CREATE TYPE "ResOrderItemStatus" AS ENUM ('pending', 'fired', 'preparing', 'ready', 'served', 'voided');

-- CreateEnum
CREATE TYPE "ResPaymentMethod" AS ENUM ('cash', 'card', 'wallet', 'loyalty', 'gift_card', 'online', 'third_party');

-- CreateEnum
CREATE TYPE "ResPaymentStatus" AS ENUM ('pending', 'captured', 'voided', 'refunded');

-- CreateEnum
CREATE TYPE "ResOrderChargeKind" AS ENUM ('service_charge', 'delivery_fee', 'packaging', 'tip', 'rounding', 'other');

-- AlterEnum
ALTER TYPE "SourceDocType" ADD VALUE 'restaurant_order';

-- CreateTable
CREATE TABLE "res_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "table_id" UUID,
    "customer_id" UUID,
    "service_type_id" UUID,
    "order_type" "ResOrderType" NOT NULL DEFAULT 'dine_in',
    "channel" "ResOrderChannel" NOT NULL DEFAULT 'pos',
    "status" "ResOrderStatus" NOT NULL DEFAULT 'draft',
    "guest_count" INTEGER NOT NULL DEFAULT 1,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "service_charge_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "delivery_fee" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tip_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "rounding_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "kitchen_notes" TEXT,
    "source_ref" TEXT,
    "warehouse_id" UUID,
    "location_id" UUID,
    "opened_by_profile_id" UUID,
    "closed_by_profile_id" UUID,
    "void_reason_id" UUID,
    "cancel_reason_id" UUID,
    "confirmed_at" TIMESTAMP(3),
    "served_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_order_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "variant_id" UUID,
    "product_id" UUID,
    "station_id" UUID,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "line_discount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_tax" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" "ResOrderItemStatus" NOT NULL DEFAULT 'pending',
    "special_request" TEXT,
    "void_reason_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_order_item_modifiers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "modifier_id" UUID,
    "name" TEXT NOT NULL,
    "price_delta" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_order_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_order_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "split_id" UUID,
    "method" "ResPaymentMethod" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reference" TEXT,
    "status" "ResPaymentStatus" NOT NULL DEFAULT 'captured',
    "gift_card_id" UUID,
    "created_by_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_order_discounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "promotion_id" UUID,
    "coupon_id" UUID,
    "reason_id" UUID,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_order_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_order_charges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "kind" "ResOrderChargeKind" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "is_taxable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_order_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_order_splits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "split_type" TEXT NOT NULL DEFAULT 'amount',
    "label" TEXT,
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_order_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_order_transfers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "transfer_type" TEXT NOT NULL DEFAULT 'table',
    "from_table_id" UUID,
    "to_table_id" UUID,
    "merged_order_id" UUID,
    "actor_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_order_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_order_events" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "ResOrderStatus",
    "to_status" "ResOrderStatus" NOT NULL,
    "actor_profile_id" UUID,
    "reason" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_void_reasons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_void_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_cancel_reasons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_cancel_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "res_orders_tenant_branch_status_idx" ON "res_orders"("tenant_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "res_orders_tenant_customer_idx" ON "res_orders"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_orders_tenant_branch_number_unique" ON "res_orders"("tenant_id", "branch_id", "order_number");

-- CreateIndex
CREATE INDEX "res_order_items_tenant_order_idx" ON "res_order_items"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "res_order_item_modifiers_tenant_item_idx" ON "res_order_item_modifiers"("tenant_id", "order_item_id");

-- CreateIndex
CREATE INDEX "res_order_payments_tenant_order_idx" ON "res_order_payments"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "res_order_discounts_tenant_order_idx" ON "res_order_discounts"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "res_order_charges_tenant_order_idx" ON "res_order_charges"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "res_order_splits_tenant_order_idx" ON "res_order_splits"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "res_order_transfers_tenant_order_idx" ON "res_order_transfers"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "res_order_events_tenant_order_idx" ON "res_order_events"("tenant_id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_void_reasons_tenant_branch_code_unique" ON "res_void_reasons"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_cancel_reasons_tenant_branch_code_unique" ON "res_cancel_reasons"("tenant_id", "branch_id", "code");

-- AddForeignKey
ALTER TABLE "res_orders" ADD CONSTRAINT "res_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_items" ADD CONSTRAINT "res_order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_items" ADD CONSTRAINT "res_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "res_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_item_modifiers" ADD CONSTRAINT "res_order_item_modifiers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_item_modifiers" ADD CONSTRAINT "res_order_item_modifiers_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "res_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_payments" ADD CONSTRAINT "res_order_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_payments" ADD CONSTRAINT "res_order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "res_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_discounts" ADD CONSTRAINT "res_order_discounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_discounts" ADD CONSTRAINT "res_order_discounts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "res_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_charges" ADD CONSTRAINT "res_order_charges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_charges" ADD CONSTRAINT "res_order_charges_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "res_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_splits" ADD CONSTRAINT "res_order_splits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_transfers" ADD CONSTRAINT "res_order_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_order_events" ADD CONSTRAINT "res_order_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_void_reasons" ADD CONSTRAINT "res_void_reasons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_cancel_reasons" ADD CONSTRAINT "res_cancel_reasons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

