-- CreateTable
CREATE TABLE "crm_segments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rule_json" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "last_rebuilt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_segment_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "segment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_segment_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_segments_tenant_active_idx" ON "crm_segments"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "crm_segments_tenant_code_unique" ON "crm_segments"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "crm_segment_members_tenant_customer_idx" ON "crm_segment_members"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_segment_members_tenant_segment_customer_unique" ON "crm_segment_members"("tenant_id", "segment_id", "customer_id");

-- AddForeignKey
ALTER TABLE "crm_segments" ADD CONSTRAINT "crm_segments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_segment_members" ADD CONSTRAINT "crm_segment_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_segment_members" ADD CONSTRAINT "crm_segment_members_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "crm_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
