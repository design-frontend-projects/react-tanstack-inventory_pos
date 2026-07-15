-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('draft', 'confirmed', 'reserved', 'partially_fulfilled', 'fulfilled', 'invoiced', 'closed', 'cancelled', 'on_hold', 'backordered');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "PosSaleStatus" AS ENUM ('open', 'parked', 'completed', 'refunded', 'partially_refunded', 'voided');

-- CreateEnum
CREATE TYPE "PosSessionStatus" AS ENUM ('open', 'closed', 'reconciled');

-- CreateEnum
CREATE TYPE "PosOrderType" AS ENUM ('counter', 'dine_in', 'takeaway', 'delivery');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card', 'bank_transfer', 'wallet', 'credit', 'cheque');

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "customer_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'draft',
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requested_delivery_date" TIMESTAMP(3),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "price_list_id" UUID,
    "sales_rep_profile_id" UUID,
    "created_by_profile_id" UUID,
    "correlation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "ordered_qty" DECIMAL(18,4) NOT NULL,
    "reserved_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "fulfilled_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "invoiced_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "discount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(19,4) NOT NULL,
    "cost_at_sale" DECIMAL(19,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "sales_order_id" UUID,
    "customer_id" UUID,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "invoice_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sales_invoice_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "uom_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "discount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(19,4) NOT NULL,
    "description_snapshot" TEXT,
    "sku_snapshot" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "register_id" TEXT NOT NULL,
    "cashier_profile_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "opening_float" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "closing_cash" DECIMAL(19,4),
    "expected_cash" DECIMAL(19,4),
    "variance" DECIMAL(19,4),
    "status" "PosSessionStatus" NOT NULL DEFAULT 'open',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sales" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "pos_session_id" UUID,
    "customer_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "cashier_profile_id" UUID NOT NULL,
    "order_type" "PosOrderType" NOT NULL DEFAULT 'counter',
    "status" "PosSaleStatus" NOT NULL DEFAULT 'open',
    "sale_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "change_due" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_by_profile_id" UUID,
    "correlation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sale_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pos_sale_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "uom_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "discount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(19,4) NOT NULL,
    "cost_at_sale" DECIMAL(19,6),
    "item_name_snapshot" TEXT,
    "sku_snapshot" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_sale_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pos_sale_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reference" TEXT,
    "card_last4" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_orders_tenant_status_idx" ON "sales_orders"("tenant_id", "status", "order_date");

-- CreateIndex
CREATE INDEX "sales_orders_tenant_customer_idx" ON "sales_orders"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_tenant_number_unique" ON "sales_orders"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "sales_order_lines_order_idx" ON "sales_order_lines"("tenant_id", "sales_order_id");

-- CreateIndex
CREATE INDEX "sales_order_lines_product_idx" ON "sales_order_lines"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "sales_invoices_tenant_status_idx" ON "sales_invoices"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "sales_invoices_tenant_customer_idx" ON "sales_invoices"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_tenant_number_unique" ON "sales_invoices"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "sales_invoice_lines_invoice_idx" ON "sales_invoice_lines"("tenant_id", "sales_invoice_id");

-- CreateIndex
CREATE INDEX "pos_sessions_tenant_status_idx" ON "pos_sessions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "pos_sessions_tenant_cashier_idx" ON "pos_sessions"("tenant_id", "cashier_profile_id");

-- CreateIndex
CREATE INDEX "pos_sales_tenant_status_idx" ON "pos_sales"("tenant_id", "status", "sale_date");

-- CreateIndex
CREATE INDEX "pos_sales_tenant_session_idx" ON "pos_sales"("tenant_id", "pos_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_sales_tenant_number_unique" ON "pos_sales"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "pos_sale_lines_sale_idx" ON "pos_sale_lines"("tenant_id", "pos_sale_id");

-- CreateIndex
CREATE INDEX "pos_sale_lines_product_idx" ON "pos_sale_lines"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "pos_payments_sale_idx" ON "pos_payments"("tenant_id", "pos_sale_id");

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_pos_session_id_fkey" FOREIGN KEY ("pos_session_id") REFERENCES "pos_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sale_lines" ADD CONSTRAINT "pos_sale_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sale_lines" ADD CONSTRAINT "pos_sale_lines_pos_sale_id_fkey" FOREIGN KEY ("pos_sale_id") REFERENCES "pos_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_pos_sale_id_fkey" FOREIGN KEY ("pos_sale_id") REFERENCES "pos_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
