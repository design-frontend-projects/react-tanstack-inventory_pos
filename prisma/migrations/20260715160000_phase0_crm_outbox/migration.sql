-- CreateTable
CREATE TABLE "domain_events" (
    "id" BIGSERIAL NOT NULL,
    "event_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "customer_id" UUID,
    "payload_json" JSONB NOT NULL,
    "correlation_id" UUID,
    "actor_profile_id" UUID,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_projection_cursors" (
    "id" UUID NOT NULL,
    "consumer_name" TEXT NOT NULL,
    "last_sequence" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_projection_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domain_events_event_id_unique" ON "domain_events"("event_id");

-- CreateIndex
CREATE INDEX "domain_events_tenant_customer_idx" ON "domain_events"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "domain_events_type_idx" ON "domain_events"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "crm_projection_cursors_consumer_unique" ON "crm_projection_cursors"("consumer_name");

-- AddForeignKey
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
