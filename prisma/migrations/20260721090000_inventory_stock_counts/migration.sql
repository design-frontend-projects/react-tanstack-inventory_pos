-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('draft', 'counting', 'review', 'posted', 'cancelled');

-- CreateTable
CREATE TABLE "stock_count_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "status" "StockCountStatus" NOT NULL DEFAULT 'draft',
    "is_cycle_count" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "started_at" TIMESTAMP(3),
    "counted_at" TIMESTAMP(3),
    "posted_at" TIMESTAMP(3),
    "posted_adjustment_id" UUID,
    "created_by_profile_id" UUID,
    "approved_by_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_count_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "lot_id" UUID,
    "serial_id" UUID,
    "uom_id" UUID NOT NULL,
    "system_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "counted_qty" DECIMAL(18,4),
    "unit_cost" DECIMAL(19,6),
    "notes" TEXT,
    "counted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_sessions_document_number_key" ON "stock_count_sessions"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "stock_count_sessions_status_idx" ON "stock_count_sessions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "stock_count_sessions_warehouse_idx" ON "stock_count_sessions"("tenant_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "stock_count_lines_session_idx" ON "stock_count_lines"("tenant_id", "session_id");

-- AddForeignKey
ALTER TABLE "stock_count_sessions" ADD CONSTRAINT "stock_count_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "stock_count_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
