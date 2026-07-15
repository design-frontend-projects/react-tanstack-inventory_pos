-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('draft', 'confirmed', 'shipped', 'in_transit', 'partially_received', 'received', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('draft', 'submitted', 'approved', 'converted', 'closed', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'confirmed', 'partially_received', 'received', 'closed', 'cancelled', 'rejected');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('draft', 'received', 'quality_check', 'put_away', 'completed', 'rejected');

-- CreateEnum
CREATE TYPE "PurchaseReturnStatus" AS ENUM ('draft', 'requested', 'approved', 'shipped', 'received', 'refunded', 'closed', 'rejected', 'cancelled');


-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "from_warehouse_id" UUID NOT NULL,
    "to_warehouse_id" UUID NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "ship_date" TIMESTAMP(3),
    "receive_date" TIMESTAMP(3),
    "shipped_by_profile_id" UUID,
    "received_by_profile_id" UUID,
    "created_by_profile_id" UUID,
    "correlation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "from_location_id" UUID NOT NULL,
    "to_location_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "requested_qty" DECIMAL(18,4) NOT NULL,
    "shipped_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "received_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lot_id" UUID,
    "serial_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "warehouse_id" UUID,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "requested_by_profile_id" UUID,
    "approved_by_profile_id" UUID,
    "converted_to_po_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisition_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "uom_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_requisition_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "supplier_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'draft',
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_date" TIMESTAMP(3),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "payment_terms" TEXT,
    "approved_by_profile_id" UUID,
    "requisition_id" UUID,
    "created_by_profile_id" UUID,
    "correlation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "uom_id" UUID NOT NULL,
    "ordered_qty" DECIMAL(18,4) NOT NULL,
    "received_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(19,6) NOT NULL,
    "tax_rate_id" UUID,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(19,4) NOT NULL,
    "expected_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "purchase_order_id" UUID,
    "supplier_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'draft',
    "receipt_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier_delivery_note" TEXT,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "posted_by_profile_id" UUID,
    "created_by_profile_id" UUID,
    "correlation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "goods_receipt_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "purchase_order_line_id" UUID,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "to_location_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "received_qty" DECIMAL(18,4) NOT NULL,
    "accepted_qty" DECIMAL(18,4) NOT NULL,
    "rejected_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(19,6) NOT NULL,
    "lot_number" TEXT,
    "expiry_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "supplier_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "purchase_order_id" UUID,
    "status" "PurchaseReturnStatus" NOT NULL DEFAULT 'draft',
    "reason" TEXT,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "posted_by_profile_id" UUID,
    "created_by_profile_id" UUID,
    "correlation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_return_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "purchase_return_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "from_location_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(19,6),
    "lot_id" UUID,
    "serial_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_transfers_tenant_status_idx" ON "stock_transfers"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_tenant_number_unique" ON "stock_transfers"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "stock_transfer_lines_transfer_idx" ON "stock_transfer_lines"("tenant_id", "transfer_id");

-- CreateIndex
CREATE INDEX "purchase_requisitions_tenant_status_idx" ON "purchase_requisitions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_tenant_number_unique" ON "purchase_requisitions"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "purchase_requisition_lines_req_idx" ON "purchase_requisition_lines"("tenant_id", "requisition_id");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_status_idx" ON "purchase_orders"("tenant_id", "status", "order_date");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_supplier_idx" ON "purchase_orders"("tenant_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenant_number_unique" ON "purchase_orders"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "purchase_order_lines_po_idx" ON "purchase_order_lines"("tenant_id", "purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_lines_product_idx" ON "purchase_order_lines"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "goods_receipts_tenant_status_idx" ON "goods_receipts"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "goods_receipts_po_idx" ON "goods_receipts"("tenant_id", "purchase_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_tenant_number_unique" ON "goods_receipts"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_receipt_idx" ON "goods_receipt_lines"("tenant_id", "goods_receipt_id");

-- CreateIndex
CREATE INDEX "purchase_returns_tenant_status_idx" ON "purchase_returns"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_returns_tenant_number_unique" ON "purchase_returns"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "purchase_return_lines_return_idx" ON "purchase_return_lines"("tenant_id", "purchase_return_id");

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_purchase_return_id_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

