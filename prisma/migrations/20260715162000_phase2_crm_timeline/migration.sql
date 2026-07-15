-- CreateTable
CREATE TABLE "crm_timeline_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "entry_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary_json" JSONB,
    "ref_type" TEXT,
    "ref_id" UUID,
    "source_event_id" UUID,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_by_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_timeline_entries_source_event_unique" ON "crm_timeline_entries"("source_event_id");

-- CreateIndex
CREATE INDEX "crm_timeline_tenant_customer_time_idx" ON "crm_timeline_entries"("tenant_id", "customer_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "crm_timeline_entries" ADD CONSTRAINT "crm_timeline_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
