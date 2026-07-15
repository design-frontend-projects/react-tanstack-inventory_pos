-- CreateEnum
CREATE TYPE "ResMenuType" AS ENUM ('standard', 'breakfast', 'lunch', 'dinner', 'seasonal', 'limited_time');

-- CreateEnum
CREATE TYPE "ResMenuVisibility" AS ENUM ('visible', 'hidden', 'staff_only');

-- CreateEnum
CREATE TYPE "ResMenuItemStatus" AS ENUM ('active', 'inactive', 'out_of_stock', 'archived');

-- CreateEnum
CREATE TYPE "ResPriceType" AS ENUM ('base', 'happy_hour', 'weekend', 'holiday', 'delivery', 'takeaway', 'channel');

-- CreateEnum
CREATE TYPE "ResModifierSelectionType" AS ENUM ('single', 'multi');

-- CreateEnum
CREATE TYPE "ResComboPricingType" AS ENUM ('fixed', 'discounted', 'component_sum');

-- CreateEnum
CREATE TYPE "ResCrossSellType" AS ENUM ('cross_sell', 'upsell', 'recommended', 'related');

-- CreateTable
CREATE TABLE "res_menus" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "menu_type" "ResMenuType" NOT NULL DEFAULT 'standard',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_menu_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_menu_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "kitchen_station_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "prep_time_minutes" INTEGER,
    "calorie_count" INTEGER,
    "nutrition_json" JSONB,
    "cooking_instructions" TEXT,
    "image_url" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_seasonal" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "ResMenuVisibility" NOT NULL DEFAULT 'visible',
    "status" "ResMenuItemStatus" NOT NULL DEFAULT 'active',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_menu_item_variants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "product_variant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_menu_item_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_menu_item_prices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "variant_id" UUID,
    "service_type_id" UUID,
    "price_type" "ResPriceType" NOT NULL DEFAULT 'base',
    "channel" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "schedule_json" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_menu_item_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_modifier_groups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selection_type" "ResModifierSelectionType" NOT NULL DEFAULT 'single',
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_modifiers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "product_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_menu_item_modifier_groups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "modifier_group_id" UUID NOT NULL,
    "is_required_override" BOOLEAN,
    "min_select_override" INTEGER,
    "max_select_override" INTEGER,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_menu_item_modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_combos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricing_type" "ResComboPricingType" NOT NULL DEFAULT 'fixed',
    "price" DECIMAL(19,4),
    "status" "ResMenuItemStatus" NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_combos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_combo_components" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "combo_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_delta" DECIMAL(19,4),
    "is_swappable" BOOLEAN NOT NULL DEFAULT false,
    "group_label" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_combo_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_menu_item_allergens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "allergen_code" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_menu_item_allergens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_menu_item_tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "tag_code" TEXT NOT NULL,
    "tag_type" TEXT NOT NULL DEFAULT 'tag',
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_menu_item_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_menu_availability" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "day_of_week" INTEGER,
    "starts_at" TEXT,
    "ends_at" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_menu_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_cross_sells" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_item_id" UUID NOT NULL,
    "target_item_id" UUID NOT NULL,
    "relation_type" "ResCrossSellType" NOT NULL DEFAULT 'related',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_cross_sells_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "res_menus_tenant_branch_code_unique" ON "res_menus"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE INDEX "res_menu_categories_tenant_menu_parent_idx" ON "res_menu_categories"("tenant_id", "menu_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_menu_categories_tenant_menu_code_unique" ON "res_menu_categories"("tenant_id", "menu_id", "code");

-- CreateIndex
CREATE INDEX "res_menu_items_tenant_status_idx" ON "res_menu_items"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "res_menu_items_tenant_category_idx" ON "res_menu_items"("tenant_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_menu_items_tenant_category_code_unique" ON "res_menu_items"("tenant_id", "category_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_menu_item_variants_tenant_item_code_unique" ON "res_menu_item_variants"("tenant_id", "menu_item_id", "code");

-- CreateIndex
CREATE INDEX "res_menu_item_prices_tenant_item_type_idx" ON "res_menu_item_prices"("tenant_id", "menu_item_id", "price_type");

-- CreateIndex
CREATE UNIQUE INDEX "res_modifier_groups_tenant_branch_code_unique" ON "res_modifier_groups"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_modifiers_tenant_group_code_unique" ON "res_modifiers"("tenant_id", "group_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_menu_item_modifier_groups_unique" ON "res_menu_item_modifier_groups"("tenant_id", "menu_item_id", "modifier_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_combos_tenant_branch_code_unique" ON "res_combos"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE INDEX "res_combo_components_tenant_combo_idx" ON "res_combo_components"("tenant_id", "combo_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_menu_item_allergens_unique" ON "res_menu_item_allergens"("tenant_id", "menu_item_id", "allergen_code");

-- CreateIndex
CREATE UNIQUE INDEX "res_menu_item_tags_unique" ON "res_menu_item_tags"("tenant_id", "menu_item_id", "tag_type", "tag_code");

-- CreateIndex
CREATE INDEX "res_menu_availability_tenant_item_idx" ON "res_menu_availability"("tenant_id", "menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_cross_sells_unique" ON "res_cross_sells"("tenant_id", "source_item_id", "target_item_id", "relation_type");

-- AddForeignKey
ALTER TABLE "res_menus" ADD CONSTRAINT "res_menus_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_menu_categories" ADD CONSTRAINT "res_menu_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_menu_items" ADD CONSTRAINT "res_menu_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_menu_item_variants" ADD CONSTRAINT "res_menu_item_variants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_menu_item_prices" ADD CONSTRAINT "res_menu_item_prices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_modifier_groups" ADD CONSTRAINT "res_modifier_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_modifiers" ADD CONSTRAINT "res_modifiers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_menu_item_modifier_groups" ADD CONSTRAINT "res_menu_item_modifier_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_combos" ADD CONSTRAINT "res_combos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_combo_components" ADD CONSTRAINT "res_combo_components_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_menu_item_allergens" ADD CONSTRAINT "res_menu_item_allergens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_menu_item_tags" ADD CONSTRAINT "res_menu_item_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_menu_availability" ADD CONSTRAINT "res_menu_availability_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_cross_sells" ADD CONSTRAINT "res_cross_sells_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

