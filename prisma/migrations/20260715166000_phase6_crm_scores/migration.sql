-- CreateTable
CREATE TABLE "crm_customer_scores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "score_type" TEXT NOT NULL,
    "score" DECIMAL(9,6),
    "payload_json" JSONB,
    "model_name" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "features_json" JSONB,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customer_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_customer_scores_tenant_type_score_idx" ON "crm_customer_scores"("tenant_id", "score_type", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "crm_customer_scores_tenant_customer_type_unique" ON "crm_customer_scores"("tenant_id", "customer_id", "score_type");

-- AddForeignKey
ALTER TABLE "crm_customer_scores" ADD CONSTRAINT "crm_customer_scores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
