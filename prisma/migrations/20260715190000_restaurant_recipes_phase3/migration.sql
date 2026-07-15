-- CreateEnum
CREATE TYPE "ResRecipeStatus" AS ENUM ('draft', 'approved', 'archived');

-- CreateEnum
CREATE TYPE "ResRecipeApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "res_recipes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "variant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ResRecipeStatus" NOT NULL DEFAULT 'draft',
    "current_version_id" UUID,
    "yield_qty" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "yield_uom_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_recipe_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "notes" TEXT,
    "computed_cost" DECIMAL(19,6),
    "cost_computed_at" TIMESTAMP(3),
    "approved_by_profile_id" UUID,
    "approved_at" TIMESTAMP(3),
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_recipe_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_recipe_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "uom_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "waste_percent" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(19,6),
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_recipe_sub_recipes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_version_id" UUID NOT NULL,
    "child_recipe_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_recipe_sub_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_recipe_steps" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "step_no" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "duration_min" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_recipe_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_recipe_approvals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "status" "ResRecipeApprovalStatus" NOT NULL DEFAULT 'pending',
    "requested_by_profile_id" UUID,
    "decided_by_profile_id" UUID,
    "decided_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_recipe_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "res_recipes_tenant_menu_item_idx" ON "res_recipes"("tenant_id", "menu_item_id");

-- CreateIndex
CREATE INDEX "res_recipes_tenant_status_idx" ON "res_recipes"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "res_recipes_tenant_code_unique" ON "res_recipes"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "res_recipe_versions_tenant_recipe_version_unique" ON "res_recipe_versions"("tenant_id", "recipe_id", "version_no");

-- CreateIndex
CREATE INDEX "res_recipe_lines_tenant_version_idx" ON "res_recipe_lines"("tenant_id", "version_id");

-- CreateIndex
CREATE INDEX "res_recipe_lines_tenant_product_idx" ON "res_recipe_lines"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "res_recipe_sub_recipes_tenant_parent_idx" ON "res_recipe_sub_recipes"("tenant_id", "parent_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_recipe_steps_tenant_version_step_unique" ON "res_recipe_steps"("tenant_id", "version_id", "step_no");

-- CreateIndex
CREATE INDEX "res_recipe_approvals_tenant_version_idx" ON "res_recipe_approvals"("tenant_id", "version_id");

-- AddForeignKey
ALTER TABLE "res_recipes" ADD CONSTRAINT "res_recipes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_recipe_versions" ADD CONSTRAINT "res_recipe_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_recipe_lines" ADD CONSTRAINT "res_recipe_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_recipe_sub_recipes" ADD CONSTRAINT "res_recipe_sub_recipes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_recipe_steps" ADD CONSTRAINT "res_recipe_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_recipe_approvals" ADD CONSTRAINT "res_recipe_approvals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

