-- CreateEnum
CREATE TYPE "PermissionKind" AS ENUM ('screen', 'menu', 'action', 'api', 'data', 'admin');

-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "actor_email" TEXT,
ADD COLUMN     "correlation_id" UUID,
ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "user_agent" TEXT;

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "action_id" UUID,
ADD COLUMN     "api_path" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "http_method" "HttpMethod",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kind" "PermissionKind" NOT NULL DEFAULT 'action',
ADD COLUMN     "module_id" UUID,
ADD COLUMN     "screen_id" UUID,
ADD COLUMN     "tenant_id" UUID,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
-- NOTE: only the two additive columns are applied here. The live `roles` table
-- uses gen_random_uuid()/timestamptz defaults that differ from the migration
-- history; those pre-existing columns are intentionally left untouched to avoid
-- a timestamptz -> timestamp conversion and a default drop on live data.
ALTER TABLE "roles" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "parent_module_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_modules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER,
    "is_visible" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screens" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "tenant_id" UUID,
    "parent_screen_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "route_id" TEXT,
    "path" TEXT,
    "component_key" TEXT,
    "icon" TEXT,
    "title_key" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "show_in_menu" BOOLEAN NOT NULL DEFAULT true,
    "show_breadcrumb" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "default_permission_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "screens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screen_actions" (
    "id" UUID NOT NULL,
    "screen_id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "screen_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modules_parent_idx" ON "modules"("parent_module_id");

-- CreateIndex
CREATE INDEX "modules_tenant_active_idx" ON "modules"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "modules_tenant_code_unique" ON "modules"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "tenant_modules_module_idx" ON "tenant_modules"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_modules_tenant_module_unique" ON "tenant_modules"("tenant_id", "module_id");

-- CreateIndex
CREATE INDEX "screens_tenant_active_idx" ON "screens"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "screens_parent_idx" ON "screens"("parent_screen_id");

-- CreateIndex
CREATE INDEX "screens_default_permission_idx" ON "screens"("default_permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "screens_module_code_unique" ON "screens"("module_id", "code");

-- CreateIndex
CREATE INDEX "screen_actions_tenant_active_idx" ON "screen_actions"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "screen_actions_screen_code_unique" ON "screen_actions"("screen_id", "code");

-- CreateIndex
CREATE INDEX "audit_logs_correlation_idx" ON "audit_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "permissions_kind_idx" ON "permissions"("kind");

-- CreateIndex
CREATE INDEX "permissions_module_id_idx" ON "permissions"("module_id");

-- CreateIndex
CREATE INDEX "permissions_screen_id_idx" ON "permissions"("screen_id");

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_screen_id_fkey" FOREIGN KEY ("screen_id") REFERENCES "screens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "screen_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_parent_module_id_fkey" FOREIGN KEY ("parent_module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screens" ADD CONSTRAINT "screens_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screens" ADD CONSTRAINT "screens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screens" ADD CONSTRAINT "screens_parent_screen_id_fkey" FOREIGN KEY ("parent_screen_id") REFERENCES "screens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screens" ADD CONSTRAINT "screens_default_permission_id_fkey" FOREIGN KEY ("default_permission_id") REFERENCES "permissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_actions" ADD CONSTRAINT "screen_actions_screen_id_fkey" FOREIGN KEY ("screen_id") REFERENCES "screens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_actions" ADD CONSTRAINT "screen_actions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Make audit_logs an append-only ledger. Blocks DELETE and any edit to the
-- immutable content columns, while still allowing ON DELETE SET NULL cascades
-- (tenant_id / actor_profile_id) so deleting a tenant or profile keeps working.
CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'audit_logs is append-only (delete blocked)';
  END IF;

  IF (NEW.action_key IS DISTINCT FROM OLD.action_key
      OR NEW.entity_type IS DISTINCT FROM OLD.entity_type
      OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
      OR NEW.old_values IS DISTINCT FROM OLD.old_values
      OR NEW.new_values IS DISTINCT FROM OLD.new_values
      OR NEW.actor_email IS DISTINCT FROM OLD.actor_email
      OR NEW.ip_address IS DISTINCT FROM OLD.ip_address
      OR NEW.user_agent IS DISTINCT FROM OLD.user_agent
      OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'audit_logs is append-only (content immutable)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_mutation ON "audit_logs";
CREATE TRIGGER audit_logs_no_mutation
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();
