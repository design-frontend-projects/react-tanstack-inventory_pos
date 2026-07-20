-- CreateEnum
CREATE TYPE "ResPromotionKind" AS ENUM ('percent', 'fixed', 'bogo', 'free_item', 'bundle', 'happy_hour', 'cashback');

-- CreateEnum
CREATE TYPE "ResPromotionStatus" AS ENUM ('draft', 'active', 'paused', 'ended');

-- CreateEnum
CREATE TYPE "ResPromotionStacking" AS ENUM ('stackable', 'exclusive');

-- CreateEnum
CREATE TYPE "ResGiftCardStatus" AS ENUM ('active', 'frozen', 'expired', 'depleted');

-- CreateEnum
CREATE TYPE "ResGiftCardTxnKind" AS ENUM ('issue', 'reload', 'redeem', 'adjust');

-- CreateTable
CREATE TABLE "res_promotions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" TEXT NOT NULL,
    "kind" "ResPromotionKind" NOT NULL DEFAULT 'percent',
    "status" "ResPromotionStatus" NOT NULL DEFAULT 'draft',
    "priority" INTEGER NOT NULL DEFAULT 10,
    "stacking" "ResPromotionStacking" NOT NULL DEFAULT 'stackable',
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "action" JSONB NOT NULL,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_coupons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_promotion_applications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "coupon_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_promotion_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_gift_cards" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" UUID,
    "status" "ResGiftCardStatus" NOT NULL DEFAULT 'active',
    "balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "issued_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_gift_card_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "gift_card_id" UUID NOT NULL,
    "kind" "ResGiftCardTxnKind" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "balance_after" DECIMAL(19,4) NOT NULL,
    "order_id" UUID,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_gift_card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "res_promotions_tenant_status_idx" ON "res_promotions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "res_coupons_tenant_code_unique" ON "res_coupons"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "res_promotion_applications_tenant_promo_idx" ON "res_promotion_applications"("tenant_id", "promotion_id");

-- CreateIndex
CREATE INDEX "res_promotion_applications_tenant_order_idx" ON "res_promotion_applications"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "res_gift_cards_tenant_customer_idx" ON "res_gift_cards"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_gift_cards_tenant_code_unique" ON "res_gift_cards"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "res_gift_card_txns_tenant_card_idx" ON "res_gift_card_transactions"("tenant_id", "gift_card_id");

-- AddForeignKey
ALTER TABLE "res_promotions" ADD CONSTRAINT "res_promotions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_coupons" ADD CONSTRAINT "res_coupons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_coupons" ADD CONSTRAINT "res_coupons_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "res_promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_promotion_applications" ADD CONSTRAINT "res_promotion_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_gift_cards" ADD CONSTRAINT "res_gift_cards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_gift_card_transactions" ADD CONSTRAINT "res_gift_card_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_gift_card_transactions" ADD CONSTRAINT "res_gift_card_transactions_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "res_gift_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
