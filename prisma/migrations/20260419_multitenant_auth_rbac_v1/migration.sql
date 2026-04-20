-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AppLocale" AS ENUM ('en', 'ar');

-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('light', 'dark', 'system');

-- CreateEnum
CREATE TYPE "TenantAccountStatus" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "ProfileGlobalStatus" AS ENUM ('active', 'suspended', 'disabled');

-- CreateEnum
CREATE TYPE "TenantUserStatus" AS ENUM ('invited', 'active', 'suspended', 'disabled', 'rejected');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'expired', 'revoked', 'failed');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "avatar_url" TEXT,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "global_status" "ProfileGlobalStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_accounts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantAccountStatus" NOT NULL DEFAULT 'active',
    "owner_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "employee_code" TEXT,
    "job_title" TEXT,
    "status" "TenantUserStatus" NOT NULL DEFAULT 'invited',
    "joined_at" TIMESTAMP(3),
    "invited_by_profile_id" UUID,
    "last_role_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rank" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_user_roles" (
    "id" UUID NOT NULL,
    "tenant_user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by_profile_id" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tenant_user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_invitations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "job_title" TEXT,
    "role_id" UUID NOT NULL,
    "invitation_token" TEXT,
    "auth_user_id" UUID,
    "invited_by_profile_id" UUID NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_profile_id" UUID,
    "action_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preference_profiles" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "locale" "AppLocale" NOT NULL DEFAULT 'en',
    "theme_mode" "ThemeMode" NOT NULL DEFAULT 'system',
    "default_tenant_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preference_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_auth_user_id_key" ON "profiles"("auth_user_id");

-- CreateIndex
CREATE INDEX "profiles_email_idx" ON "profiles"("email");
CREATE INDEX "profiles_email_lower_idx" ON "profiles"(LOWER("email"));

-- CreateIndex
CREATE UNIQUE INDEX "tenant_accounts_slug_key" ON "tenant_accounts"("slug");

-- CreateIndex
CREATE INDEX "tenant_users_tenant_status_idx" ON "tenant_users"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tenant_users_profile_status_idx" ON "tenant_users"("profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_tenant_profile_unique" ON "tenant_users"("tenant_id", "profile_id");

-- CreateIndex
CREATE INDEX "roles_code_idx" ON "roles"("code");

-- CreateIndex
CREATE INDEX "roles_system_active_idx" ON "roles"("is_system", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_code_unique" ON "roles"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module_key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_module_action_unique" ON "permissions"("module_key", "action_key");

-- CreateIndex
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permission_unique" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "tenant_user_roles_role_idx" ON "tenant_user_roles"("role_id");

-- CreateIndex
CREATE INDEX "tenant_user_roles_primary_idx" ON "tenant_user_roles"("tenant_user_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_user_roles_tenant_user_role_unique" ON "tenant_user_roles"("tenant_user_id", "role_id");

-- CreateIndex
CREATE INDEX "user_invitations_tenant_status_idx" ON "user_invitations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "user_invitations_email_idx" ON "user_invitations"("email");
CREATE INDEX "user_invitations_email_lower_idx" ON "user_invitations"(LOWER("email"));
CREATE UNIQUE INDEX "user_invitations_pending_tenant_email_unique"
  ON "user_invitations"("tenant_id", LOWER("email"))
  WHERE "status" = 'pending';

-- CreateIndex
CREATE INDEX "user_invitations_role_idx" ON "user_invitations"("role_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_created_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_created_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "preference_profiles_profile_id_key" ON "preference_profiles"("profile_id");

-- CreateIndex
CREATE INDEX "preference_profiles_default_tenant_idx" ON "preference_profiles"("default_tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_accounts" ADD CONSTRAINT "tenant_accounts_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_invited_by_profile_id_fkey" FOREIGN KEY ("invited_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_assigned_by_profile_id_fkey" FOREIGN KEY ("assigned_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_profile_id_fkey" FOREIGN KEY ("invited_by_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_profiles" ADD CONSTRAINT "preference_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_profiles" ADD CONSTRAINT "preference_profiles_default_tenant_id_fkey" FOREIGN KEY ("default_tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

