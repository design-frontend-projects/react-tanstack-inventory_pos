-- CreateEnum
CREATE TYPE "TenantRegistrationStatus" AS ENUM ('pending', 'completed', 'expired', 'cancelled');

-- AlterTable
ALTER TABLE "profiles"
  ADD COLUMN "profile_completed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "tenant_accounts"
  ADD COLUMN "activity" TEXT,
  ADD COLUMN "timezone" TEXT;

ALTER TABLE "tenant_users"
  ADD COLUMN "is_owner" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "roles"
  ADD COLUMN "activity_scope" TEXT;

ALTER TABLE "user_invitations"
  ADD COLUMN "revoked_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tenant_user_permissions" (
  "id" UUID NOT NULL,
  "tenant_user_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "is_allowed" BOOLEAN NOT NULL,
  "assigned_by_profile_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_user_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_registration_requests" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "phone" TEXT,
  "activity" TEXT NOT NULL,
  "is_owner" BOOLEAN NOT NULL DEFAULT true,
  "default_role_code" TEXT NOT NULL,
  "auth_user_id" UUID,
  "linked_profile_id" UUID,
  "status" "TenantRegistrationStatus" NOT NULL DEFAULT 'pending',
  "sent_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_user_permissions_tenant_user_permission_unique"
  ON "tenant_user_permissions"("tenant_user_id", "permission_id");

CREATE INDEX "tenant_user_permissions_permission_idx"
  ON "tenant_user_permissions"("permission_id");

CREATE INDEX "tenant_registration_requests_email_idx"
  ON "tenant_registration_requests"("email");

CREATE INDEX "tenant_registration_requests_email_lower_idx"
  ON "tenant_registration_requests"(LOWER("email"));

CREATE INDEX "tenant_registration_requests_status_expiry_idx"
  ON "tenant_registration_requests"("status", "expires_at");

CREATE UNIQUE INDEX "tenant_registration_requests_pending_email_unique"
  ON "tenant_registration_requests"(LOWER("email"))
  WHERE "status" = 'pending';

-- AddForeignKey
ALTER TABLE "tenant_user_permissions"
  ADD CONSTRAINT "tenant_user_permissions_tenant_user_id_fkey"
  FOREIGN KEY ("tenant_user_id")
  REFERENCES "tenant_users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "tenant_user_permissions"
  ADD CONSTRAINT "tenant_user_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id")
  REFERENCES "permissions"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "tenant_user_permissions"
  ADD CONSTRAINT "tenant_user_permissions_assigned_by_profile_id_fkey"
  FOREIGN KEY ("assigned_by_profile_id")
  REFERENCES "profiles"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "tenant_registration_requests"
  ADD CONSTRAINT "tenant_registration_requests_linked_profile_id_fkey"
  FOREIGN KEY ("linked_profile_id")
  REFERENCES "profiles"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
