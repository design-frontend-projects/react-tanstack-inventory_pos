-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('purchase_requisition', 'purchase_order', 'goods_receipt', 'purchase_return', 'debit_note', 'sales_order', 'sales_invoice', 'pos_sale', 'sales_return', 'credit_note', 'stock_transfer', 'stock_adjustment', 'stock_count', 'production_order');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('simple', 'variant', 'bundle', 'kit', 'service', 'composite');

-- CreateEnum
CREATE TYPE "TrackingPolicy" AS ENUM ('none', 'lot', 'serial', 'lot_serial');

-- CreateEnum
CREATE TYPE "CostingMethod" AS ENUM ('weighted_average', 'fifo', 'standard');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "UomType" AS ENUM ('count', 'weight', 'volume', 'length', 'time');

-- CreateEnum
CREATE TYPE "AttributeInputType" AS ENUM ('select', 'text', 'number', 'boolean');

-- CreateEnum
CREATE TYPE "BarcodeType" AS ENUM ('ean13', 'upc', 'code128', 'qr', 'custom');

-- CreateEnum
CREATE TYPE "PriceListType" AS ENUM ('sales', 'purchase');

-- CreateEnum
CREATE TYPE "BundleComponentType" AS ENUM ('kit_static', 'bundle_priced');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('vat', 'gst', 'sales', 'none');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('retail', 'wholesale', 'b2b');

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'default',
    "period_key" TEXT,
    "prefix" TEXT,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "next_value" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "uom_type" "UomType" NOT NULL,
    "is_base_unit" BOOLEAN NOT NULL DEFAULT false,
    "decimal_places" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uom_conversions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID,
    "from_uom_id" UUID NOT NULL,
    "to_uom_id" UUID NOT NULL,
    "factor" DECIMAL(18,8) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uom_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "product_type" "ProductType" NOT NULL DEFAULT 'simple',
    "tracking_policy" "TrackingPolicy" NOT NULL DEFAULT 'none',
    "is_stock_tracked" BOOLEAN NOT NULL DEFAULT true,
    "has_expiry" BOOLEAN NOT NULL DEFAULT false,
    "shelf_life_days" INTEGER,
    "category_id" UUID,
    "brand_id" UUID,
    "base_uom_id" UUID NOT NULL,
    "sales_uom_id" UUID,
    "purchase_uom_id" UUID,
    "costing_method" "CostingMethod" NOT NULL DEFAULT 'weighted_average',
    "standard_cost" DECIMAL(19,6),
    "default_price" DECIMAL(19,4),
    "tax_rate_id" UUID,
    "barcode" TEXT,
    "weight" DECIMAL(18,4),
    "dimensions" JSONB,
    "reorder_point" DECIMAL(18,4),
    "reorder_qty" DECIMAL(18,4),
    "min_stock" DECIMAL(18,4),
    "max_stock" DECIMAL(18,4),
    "safety_stock" DECIMAL(18,4),
    "lead_time_days" INTEGER,
    "preferred_supplier_id" UUID,
    "status" "ProductStatus" NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributes_json" JSONB NOT NULL DEFAULT '{}',
    "barcode" TEXT,
    "price_override" DECIMAL(19,4),
    "cost_override" DECIMAL(19,6),
    "weight" DECIMAL(18,4),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_barcodes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "barcode" TEXT NOT NULL,
    "barcode_type" "BarcodeType" NOT NULL DEFAULT 'ean13',
    "uom_id" UUID NOT NULL,
    "pack_qty" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "url" TEXT NOT NULL,
    "alt_text" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_sku" TEXT,
    "supplier_product_name" TEXT,
    "last_purchase_cost" DECIMAL(19,6),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "lead_time_days" INTEGER,
    "min_order_qty" DECIMAL(18,4),
    "pack_size" DECIMAL(18,4),
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "type" "PriceListType" NOT NULL DEFAULT 'sales',
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_prices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "uom_id" UUID NOT NULL,
    "min_qty" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "tax_included" BOOLEAN NOT NULL DEFAULT false,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_components" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bundle_product_id" UUID NOT NULL,
    "component_product_id" UUID NOT NULL,
    "component_variant_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom_id" UUID NOT NULL,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "component_type" "BundleComponentType" NOT NULL DEFAULT 'kit_static',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundle_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "input_type" "AttributeInputType" NOT NULL DEFAULT 'select',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_options" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attribute_values" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "attribute_id" UUID NOT NULL,
    "option_id" UUID,
    "value_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "product_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_tag_links" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_tag_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tax_id" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address_json" JSONB,
    "payment_terms" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "credit_limit" DECIMAL(19,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customer_type" "CustomerType" NOT NULL DEFAULT 'retail',
    "tax_id" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "billing_address_json" JSONB,
    "shipping_address_json" JSONB,
    "price_list_id" UUID,
    "credit_limit" DECIMAL(19,4),
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(9,6) NOT NULL,
    "tax_type" "TaxType" NOT NULL DEFAULT 'vat',
    "is_compound" BOOLEAN NOT NULL DEFAULT false,
    "is_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_sequences_tenant_type_idx" ON "document_sequences"("tenant_id", "document_type");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_scope_unique" ON "document_sequences"("tenant_id", "document_type", "scope", "period_key");

-- CreateIndex
CREATE INDEX "brands_tenant_active_idx" ON "brands"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "brands_tenant_code_unique" ON "brands"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "product_categories_tenant_parent_idx" ON "product_categories"("tenant_id", "parent_id");

-- CreateIndex
CREATE INDEX "product_categories_tenant_active_idx" ON "product_categories"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_tenant_code_unique" ON "product_categories"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "units_of_measure_tenant_active_idx" ON "units_of_measure"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_tenant_code_unique" ON "units_of_measure"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "uom_conversions_tenant_product_idx" ON "uom_conversions"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "uom_conversions_grain_unique" ON "uom_conversions"("tenant_id", "product_id", "from_uom_id", "to_uom_id");

-- CreateIndex
CREATE INDEX "products_tenant_status_idx" ON "products"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "products_tenant_category_idx" ON "products"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "products_tenant_brand_idx" ON "products"("tenant_id", "brand_id");

-- CreateIndex
CREATE INDEX "products_tenant_type_idx" ON "products"("tenant_id", "product_type");

-- CreateIndex
CREATE INDEX "products_tenant_barcode_idx" ON "products"("tenant_id", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_sku_unique" ON "products"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "product_variants_tenant_product_idx" ON "product_variants"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_tenant_sku_unique" ON "product_variants"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "product_barcodes_tenant_product_idx" ON "product_barcodes"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_barcodes_tenant_barcode_unique" ON "product_barcodes"("tenant_id", "barcode");

-- CreateIndex
CREATE INDEX "product_images_tenant_product_idx" ON "product_images"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "product_suppliers_tenant_supplier_idx" ON "product_suppliers"("tenant_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_suppliers_grain_unique" ON "product_suppliers"("tenant_id", "product_id", "supplier_id");

-- CreateIndex
CREATE INDEX "price_lists_tenant_type_idx" ON "price_lists"("tenant_id", "type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_tenant_code_unique" ON "price_lists"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "product_prices_tenant_product_idx" ON "product_prices"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_prices_grain_unique" ON "product_prices"("tenant_id", "price_list_id", "product_id", "variant_id", "uom_id", "min_qty");

-- CreateIndex
CREATE INDEX "bundle_components_tenant_bundle_idx" ON "bundle_components"("tenant_id", "bundle_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_components_grain_unique" ON "bundle_components"("tenant_id", "bundle_product_id", "component_product_id", "component_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "attributes_tenant_code_unique" ON "attributes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "attribute_options_tenant_attribute_idx" ON "attribute_options"("tenant_id", "attribute_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_options_grain_unique" ON "attribute_options"("tenant_id", "attribute_id", "code");

-- CreateIndex
CREATE INDEX "product_attribute_values_tenant_product_idx" ON "product_attribute_values"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "product_attribute_values_tenant_attribute_idx" ON "product_attribute_values"("tenant_id", "attribute_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_tags_tenant_code_unique" ON "product_tags"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "product_tag_links_tenant_tag_idx" ON "product_tag_links"("tenant_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_tag_links_grain_unique" ON "product_tag_links"("tenant_id", "product_id", "tag_id");

-- CreateIndex
CREATE INDEX "suppliers_tenant_active_idx" ON "suppliers"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenant_code_unique" ON "suppliers"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "customers_tenant_active_idx" ON "customers"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "customers_tenant_phone_idx" ON "customers"("tenant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_code_unique" ON "customers"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "tax_rates_tenant_active_idx" ON "tax_rates"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_tenant_code_unique" ON "tax_rates"("tenant_id", "code");

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uom_conversions" ADD CONSTRAINT "uom_conversions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_bundle_product_id_fkey" FOREIGN KEY ("bundle_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_options" ADD CONSTRAINT "attribute_options_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_options" ADD CONSTRAINT "attribute_options_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tag_links" ADD CONSTRAINT "product_tag_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tag_links" ADD CONSTRAINT "product_tag_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tag_links" ADD CONSTRAINT "product_tag_links_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "product_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
