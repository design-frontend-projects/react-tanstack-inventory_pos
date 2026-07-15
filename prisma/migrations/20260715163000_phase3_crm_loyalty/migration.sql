-- CreateEnum
CREATE TYPE "LoyaltyEntryType" AS ENUM ('earn', 'redeem', 'adjust', 'expire', 'bonus', 'reversal');

-- CreateEnum
CREATE TYPE "LoyaltyRuleType" AS ENUM ('base', 'category_bonus', 'product_bonus', 'birthday', 'anniversary', 'channel');

-- CreateTable
CREATE TABLE "crm_loyalty_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "points_per_currency_unit" DECIMAL(9,6) NOT NULL DEFAULT 1,
    "redemption_value_per_point" DECIMAL(9,6) NOT NULL DEFAULT 0.01,
    "min_redeem_points" INTEGER NOT NULL DEFAULT 0,
    "expiry_months" INTEGER,
    "birthday_bonus_points" INTEGER NOT NULL DEFAULT 0,
    "anniversary_bonus_points" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_loyalty_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_loyalty_tiers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "min_lifetime_points" INTEGER NOT NULL DEFAULT 0,
    "min_annual_spend" DECIMAL(19,4),
    "earn_multiplier" DECIMAL(9,6) NOT NULL DEFAULT 1,
    "benefits_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_loyalty_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_loyalty_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "tier_id" UUID,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_points" INTEGER NOT NULL DEFAULT 0,
    "wallet_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tier_achieved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_loyalty_ledger" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "entry_type" "LoyaltyEntryType" NOT NULL,
    "points" INTEGER NOT NULL,
    "wallet_amount" DECIMAL(19,4),
    "source_event_id" UUID,
    "ref_type" TEXT,
    "ref_id" UUID,
    "expires_at" TIMESTAMP(3),
    "remaining_points" INTEGER,
    "note" TEXT,
    "created_by_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_loyalty_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_loyalty_earn_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rule_type" "LoyaltyRuleType" NOT NULL,
    "conditions_json" JSONB,
    "multiplier" DECIMAL(9,6),
    "fixed_points" INTEGER,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_loyalty_earn_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_loyalty_settings_tenant_unique" ON "crm_loyalty_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "crm_loyalty_tiers_tenant_rank_idx" ON "crm_loyalty_tiers"("tenant_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "crm_loyalty_tiers_tenant_code_unique" ON "crm_loyalty_tiers"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "crm_loyalty_accounts_tenant_customer_unique" ON "crm_loyalty_accounts"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_loyalty_ledger_source_event_unique" ON "crm_loyalty_ledger"("source_event_id");

-- CreateIndex
CREATE INDEX "crm_loyalty_ledger_tenant_customer_time_idx" ON "crm_loyalty_ledger"("tenant_id", "customer_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_loyalty_ledger_tenant_expiry_idx" ON "crm_loyalty_ledger"("tenant_id", "expires_at");

-- CreateIndex
CREATE INDEX "crm_loyalty_earn_rules_tenant_active_idx" ON "crm_loyalty_earn_rules"("tenant_id", "is_active");

-- AddForeignKey
ALTER TABLE "crm_loyalty_settings" ADD CONSTRAINT "crm_loyalty_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_loyalty_tiers" ADD CONSTRAINT "crm_loyalty_tiers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_loyalty_accounts" ADD CONSTRAINT "crm_loyalty_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_loyalty_ledger" ADD CONSTRAINT "crm_loyalty_ledger_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_loyalty_ledger" ADD CONSTRAINT "crm_loyalty_ledger_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_loyalty_earn_rules" ADD CONSTRAINT "crm_loyalty_earn_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
