-- Spec 005 Phase 7 — in-app notification inbox.
-- Rows are written transactionally alongside the triggering business action
-- (approval routing, postings) and read by the recipient's notification panel.

CREATE TABLE "pod_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "recipient_profile_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entity_type" TEXT,
    "entity_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_notifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "pod_notifications"
  ADD CONSTRAINT "pod_notifications_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "pod_notifications_inbox_idx"
  ON "pod_notifications"("tenant_id", "recipient_profile_id", "is_read", "created_at" DESC);
CREATE INDEX "pod_notifications_entity_idx"
  ON "pod_notifications"("tenant_id", "entity_type", "entity_id");

-- Same defense-in-depth RLS posture as the other pod_ tables (ENABLE, not
-- FORCE — the owner/Prisma role bypasses; non-owner roles are constrained to
-- the tenant set via pod_set_tenant_context()).
ALTER TABLE "pod_notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pod_notifications_tenant_isolation" ON "pod_notifications"
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
