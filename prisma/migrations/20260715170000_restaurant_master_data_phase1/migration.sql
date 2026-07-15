-- CreateEnum
CREATE TYPE "ResRestaurantStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "ResBranchStatus" AS ENUM ('active', 'inactive', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "ResTableStatus" AS ENUM ('available', 'occupied', 'reserved', 'blocked');

-- CreateEnum
CREATE TYPE "ResServiceKind" AS ENUM ('dine_in', 'takeaway', 'pickup', 'delivery', 'drive_thru', 'qr_order', 'website', 'mobile_app', 'phone', 'third_party');

-- CreateEnum
CREATE TYPE "ResTaxAppliesTo" AS ENUM ('order', 'line', 'service_charge', 'delivery');

-- CreateEnum
CREATE TYPE "ResChargeType" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "ResReceiptTemplateType" AS ENUM ('receipt', 'invoice', 'kitchen_ticket');

-- CreateEnum
CREATE TYPE "ResSequenceType" AS ENUM ('order', 'invoice', 'kitchen_ticket', 'reservation');

-- CreateTable
CREATE TABLE "res_restaurants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "brand_color" TEXT,
    "logo_url" TEXT,
    "default_currency" TEXT NOT NULL DEFAULT 'USD',
    "default_locale" TEXT NOT NULL DEFAULT 'en',
    "status" "ResRestaurantStatus" NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_branches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address_json" JSONB,
    "phone" TEXT,
    "timezone" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "ResBranchStatus" NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "opened_at" TIMESTAMP(3),
    "created_by_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_branch_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "role_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_branch_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_business_hours" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "service_type_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "opens_at" TEXT NOT NULL,
    "closes_at" TEXT NOT NULL,
    "is_overnight" BOOLEAN NOT NULL DEFAULT false,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_holidays" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT true,
    "special_hours_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_dining_areas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_dining_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_table_sections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "dining_area_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_table_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_tables" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 2,
    "min_capacity" INTEGER,
    "shape" TEXT,
    "status" "ResTableStatus" NOT NULL DEFAULT 'available',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_table_qr_codes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "target_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rotated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_table_qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_service_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ResServiceKind" NOT NULL DEFAULT 'dine_in',
    "settings_json" JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_shifts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "starts_at" TEXT NOT NULL,
    "ends_at" TEXT NOT NULL,
    "days_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_kitchen_stations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_kitchen_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_kitchen_printers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "station_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "connection_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_kitchen_printers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_receipt_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_type" "ResReceiptTemplateType" NOT NULL DEFAULT 'receipt',
    "layout_json" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_receipt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_tax_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "tax_rate_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(9,6) NOT NULL,
    "is_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "applies_to" "ResTaxAppliesTo" NOT NULL DEFAULT 'line',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_tax_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_service_charge_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "charge_type" "ResChargeType" NOT NULL DEFAULT 'percent',
    "value" DECIMAL(19,4) NOT NULL,
    "min_guests" INTEGER,
    "applies_to_service_json" JSONB,
    "is_taxable" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_service_charge_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_delivery_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "base_fee" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "per_km_fee" DECIMAL(19,4),
    "free_threshold" DECIMAL(19,4),
    "max_radius_km" DECIMAL(9,6),
    "zones_json" JSONB,
    "estimated_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_delivery_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_takeaway_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "prep_buffer_minutes" INTEGER NOT NULL DEFAULT 15,
    "packaging_fee" DECIMAL(19,4),
    "pickup_slots_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_takeaway_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_number_sequences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "sequence_type" "ResSequenceType" NOT NULL,
    "prefix" TEXT,
    "pattern" TEXT,
    "padding" INTEGER NOT NULL DEFAULT 4,
    "next_value" BIGINT NOT NULL DEFAULT 1,
    "period_key" TEXT NOT NULL DEFAULT '-',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_restaurant_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "settings_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_restaurant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_branch_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "settings_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_branch_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "res_restaurants_tenant_status_idx" ON "res_restaurants"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "res_restaurants_tenant_code_unique" ON "res_restaurants"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "res_branches_tenant_restaurant_idx" ON "res_branches"("tenant_id", "restaurant_id");

-- CreateIndex
CREATE INDEX "res_branches_tenant_status_idx" ON "res_branches"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "res_branches_tenant_code_unique" ON "res_branches"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "res_branch_members_tenant_profile_idx" ON "res_branch_members"("tenant_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_branch_members_tenant_branch_profile_unique" ON "res_branch_members"("tenant_id", "branch_id", "profile_id");

-- CreateIndex
CREATE INDEX "res_business_hours_tenant_branch_day_idx" ON "res_business_hours"("tenant_id", "branch_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "res_holidays_tenant_branch_date_unique" ON "res_holidays"("tenant_id", "branch_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "res_dining_areas_tenant_branch_code_unique" ON "res_dining_areas"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE INDEX "res_table_sections_tenant_branch_idx" ON "res_table_sections"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_table_sections_tenant_area_code_unique" ON "res_table_sections"("tenant_id", "dining_area_id", "code");

-- CreateIndex
CREATE INDEX "res_tables_tenant_branch_status_idx" ON "res_tables"("tenant_id", "branch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "res_tables_tenant_branch_code_unique" ON "res_tables"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_table_qr_codes_token_key" ON "res_table_qr_codes"("token");

-- CreateIndex
CREATE INDEX "res_table_qr_codes_tenant_table_idx" ON "res_table_qr_codes"("tenant_id", "table_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_service_types_tenant_branch_code_unique" ON "res_service_types"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_shifts_tenant_branch_code_unique" ON "res_shifts"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_kitchen_stations_tenant_branch_code_unique" ON "res_kitchen_stations"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_kitchen_printers_tenant_branch_code_unique" ON "res_kitchen_printers"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_receipt_templates_tenant_branch_code_unique" ON "res_receipt_templates"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_tax_configs_tenant_branch_code_unique" ON "res_tax_configs"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_service_charge_rules_tenant_branch_code_unique" ON "res_service_charge_rules"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_delivery_settings_tenant_branch_unique" ON "res_delivery_settings"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_takeaway_settings_tenant_branch_unique" ON "res_takeaway_settings"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_number_sequences_tenant_branch_type_period_unique" ON "res_number_sequences"("tenant_id", "branch_id", "sequence_type", "period_key");

-- CreateIndex
CREATE UNIQUE INDEX "res_restaurant_settings_tenant_restaurant_unique" ON "res_restaurant_settings"("tenant_id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_branch_settings_tenant_branch_unique" ON "res_branch_settings"("tenant_id", "branch_id");

-- AddForeignKey
ALTER TABLE "res_restaurants" ADD CONSTRAINT "res_restaurants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_branches" ADD CONSTRAINT "res_branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_branch_members" ADD CONSTRAINT "res_branch_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_business_hours" ADD CONSTRAINT "res_business_hours_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_holidays" ADD CONSTRAINT "res_holidays_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_dining_areas" ADD CONSTRAINT "res_dining_areas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_table_sections" ADD CONSTRAINT "res_table_sections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_tables" ADD CONSTRAINT "res_tables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_table_qr_codes" ADD CONSTRAINT "res_table_qr_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_service_types" ADD CONSTRAINT "res_service_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_shifts" ADD CONSTRAINT "res_shifts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_kitchen_stations" ADD CONSTRAINT "res_kitchen_stations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_kitchen_printers" ADD CONSTRAINT "res_kitchen_printers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_receipt_templates" ADD CONSTRAINT "res_receipt_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_tax_configs" ADD CONSTRAINT "res_tax_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_service_charge_rules" ADD CONSTRAINT "res_service_charge_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_delivery_settings" ADD CONSTRAINT "res_delivery_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_takeaway_settings" ADD CONSTRAINT "res_takeaway_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_number_sequences" ADD CONSTRAINT "res_number_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_restaurant_settings" ADD CONSTRAINT "res_restaurant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_branch_settings" ADD CONSTRAINT "res_branch_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

