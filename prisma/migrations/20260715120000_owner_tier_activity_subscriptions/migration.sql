-- Owner tier: global platform / SaaS-operator tables (activity options + subscription
-- plans/features/tenant subscriptions), plus strict activity_option_id foreign keys on
-- the existing tenant/registration tables. This migration preserves existing data by
-- seeding baseline activity options and backfilling the new FK columns from the legacy
-- free-text `activity` code before the columns are used.

-- CreateEnum
CREATE TYPE "OwnerSubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "OwnerBillingCycle" AS ENUM ('monthly', 'yearly');

-- CreateTable
CREATE TABLE "owner_activity_options" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "owner_activity_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_subscription_plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_monthly" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price_yearly" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "owner_subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_subscription_plans_features" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_included" BOOLEAN NOT NULL DEFAULT true,
    "limit_value" INTEGER,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_subscription_plans_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_tenant_subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "OwnerSubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "billing_cycle" "OwnerBillingCycle" NOT NULL DEFAULT 'monthly',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trial_ends_at" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_tenant_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "owner_activity_options_code_key" ON "owner_activity_options"("code");

-- CreateIndex
CREATE INDEX "owner_activity_options_active_order_idx" ON "owner_activity_options"("is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "owner_subscription_plans_code_key" ON "owner_subscription_plans"("code");

-- CreateIndex
CREATE INDEX "owner_subscription_plans_active_order_idx" ON "owner_subscription_plans"("is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "owner_plan_features_plan_code_unique" ON "owner_subscription_plans_features"("plan_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "owner_tenant_subscriptions_tenant_id_key" ON "owner_tenant_subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "owner_tenant_subscriptions_plan_idx" ON "owner_tenant_subscriptions"("plan_id");

-- Seed baseline activity options so the FK targets exist before backfill. The
-- prisma/seed.ts seeder is idempotent and will keep these (and the plans) in sync.
INSERT INTO "owner_activity_options" ("id", "code", "name", "name_ar", "description", "display_order", "is_active", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'restaurant', 'Restaurant', 'مطعم', 'Food service, dine-in, and kitchen operations.', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'retail', 'Retail', 'تجزئة', 'Storefront and point-of-sale retail operations.', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'hybrid', 'Hybrid', 'مختلط', 'Combined restaurant and retail operations.', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- AlterTable
ALTER TABLE "tenant_accounts" ADD COLUMN "activity_option_id" UUID;

-- AlterTable
ALTER TABLE "tenant_registration_requests" ADD COLUMN "activity_option_id" UUID;

-- Backfill the new FK columns from the legacy free-text activity code.
UPDATE "tenant_accounts" t
SET "activity_option_id" = o."id"
FROM "owner_activity_options" o
WHERE lower(t."activity") = o."code" AND t."activity_option_id" IS NULL;

UPDATE "tenant_registration_requests" t
SET "activity_option_id" = o."id"
FROM "owner_activity_options" o
WHERE lower(t."activity") = o."code" AND t."activity_option_id" IS NULL;

-- AddForeignKey
ALTER TABLE "tenant_accounts" ADD CONSTRAINT "tenant_accounts_activity_option_id_fkey" FOREIGN KEY ("activity_option_id") REFERENCES "owner_activity_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_registration_requests" ADD CONSTRAINT "tenant_registration_requests_activity_option_id_fkey" FOREIGN KEY ("activity_option_id") REFERENCES "owner_activity_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_subscription_plans_features" ADD CONSTRAINT "owner_subscription_plans_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "owner_subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_tenant_subscriptions" ADD CONSTRAINT "owner_tenant_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_tenant_subscriptions" ADD CONSTRAINT "owner_tenant_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "owner_subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
