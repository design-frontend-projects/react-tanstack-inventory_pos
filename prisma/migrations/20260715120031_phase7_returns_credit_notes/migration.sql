-- CreateEnum
CREATE TYPE "SalesReturnStatus" AS ENUM ('draft', 'requested', 'approved', 'in_transit', 'received', 'credited', 'closed', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "SalesReturnReason" AS ENUM ('damaged', 'defective', 'wrong_item', 'not_as_described', 'expired', 'customer_changed_mind', 'other');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('draft', 'issued', 'applied', 'closed', 'cancelled');

-- AlterTable
ALTER TABLE "pos_sale_lines" ADD COLUMN     "refunded_qty" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "customer_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "origin_type" "SourceDocType",
    "sales_order_id" UUID,
    "pos_sale_id" UUID,
    "status" "SalesReturnStatus" NOT NULL DEFAULT 'draft',
    "reason" "SalesReturnReason" NOT NULL DEFAULT 'other',
    "return_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "restock_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "refund_method" "PaymentMethod",
    "notes" TEXT,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "posted_by_profile_id" UUID,
    "created_by_profile_id" UUID,
    "correlation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sales_return_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "discount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(19,4) NOT NULL,
    "cost_at_return" DECIMAL(19,6),
    "restock" BOOLEAN NOT NULL DEFAULT true,
    "origin_line_id" UUID,
    "lot_id" UUID,
    "serial_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "note_type" "NoteType" NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'draft',
    "customer_id" UUID,
    "supplier_id" UUID,
    "sales_return_id" UUID,
    "purchase_return_id" UUID,
    "sales_invoice_id" UUID,
    "reason" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "applied_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "note_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_at" TIMESTAMP(3),
    "created_by_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_returns_tenant_status_idx" ON "sales_returns"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "sales_returns_tenant_customer_idx" ON "sales_returns"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "sales_returns_tenant_pos_sale_idx" ON "sales_returns"("tenant_id", "pos_sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_tenant_number_unique" ON "sales_returns"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "sales_return_lines_return_idx" ON "sales_return_lines"("tenant_id", "sales_return_id");

-- CreateIndex
CREATE INDEX "sales_return_lines_product_idx" ON "sales_return_lines"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "financial_notes_tenant_type_status_idx" ON "financial_notes"("tenant_id", "note_type", "status");

-- CreateIndex
CREATE INDEX "financial_notes_tenant_customer_idx" ON "financial_notes"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "financial_notes_tenant_supplier_idx" ON "financial_notes"("tenant_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_notes_tenant_number_unique" ON "financial_notes"("tenant_id", "document_number");

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_notes" ADD CONSTRAINT "financial_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
