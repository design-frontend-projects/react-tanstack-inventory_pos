-- CreateTable
CREATE TABLE "crm_customer_metrics" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "first_purchase_at" TIMESTAMP(3),
    "last_purchase_at" TIMESTAMP(3),
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "total_spend" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "avg_order_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "returns_count" INTEGER NOT NULL DEFAULT 0,
    "returns_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "visit_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_product_id" UUID,
    "favorite_category_id" UUID,
    "favorite_warehouse_id" UUID,
    "favorite_payment_method" TEXT,
    "favorites_json" JSONB,
    "rfm_recency" INTEGER,
    "rfm_frequency" INTEGER,
    "rfm_monetary" INTEGER,
    "rfm_segment" TEXT,
    "churn_score" DECIMAL(9,6),
    "clv_estimate" DECIMAL(19,4),
    "last_event_sequence" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customer_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_metrics_monthly" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "period_key" TEXT NOT NULL,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "points_earned" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customer_metrics_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_customer_metrics_tenant_spend_idx" ON "crm_customer_metrics"("tenant_id", "total_spend" DESC);

-- CreateIndex
CREATE INDEX "crm_customer_metrics_tenant_recency_idx" ON "crm_customer_metrics"("tenant_id", "last_purchase_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_customer_metrics_tenant_customer_unique" ON "crm_customer_metrics"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "crm_metrics_monthly_tenant_period_idx" ON "crm_customer_metrics_monthly"("tenant_id", "period_key");

-- CreateIndex
CREATE UNIQUE INDEX "crm_metrics_monthly_tenant_customer_period_unique" ON "crm_customer_metrics_monthly"("tenant_id", "customer_id", "period_key");

-- AddForeignKey
ALTER TABLE "crm_customer_metrics" ADD CONSTRAINT "crm_customer_metrics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_metrics_monthly" ADD CONSTRAINT "crm_customer_metrics_monthly_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
