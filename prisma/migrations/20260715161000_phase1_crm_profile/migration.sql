-- CreateEnum
CREATE TYPE "CrmLifecycleStatus" AS ENUM ('prospect', 'active', 'at_risk', 'inactive', 'blocked');

-- CreateEnum
CREATE TYPE "CrmContactType" AS ENUM ('phone', 'email', 'social', 'other');

-- CreateEnum
CREATE TYPE "CrmAddressType" AS ENUM ('billing', 'shipping', 'delivery', 'other');

-- CreateEnum
CREATE TYPE "CrmRelationType" AS ENUM ('family', 'emergency', 'company_contact', 'referrer', 'other');

-- CreateEnum
CREATE TYPE "ConsentChannel" AS ENUM ('email', 'sms', 'push', 'whatsapp', 'phone');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('marketing', 'transactional', 'survey');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('granted', 'denied', 'withdrawn');

-- CreateEnum
CREATE TYPE "CrmFieldType" AS ENUM ('text', 'number', 'date', 'boolean', 'select', 'multi_select');

-- CreateTable
CREATE TABLE "crm_customer_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "date_of_birth" DATE,
    "anniversary_date" DATE,
    "gender" TEXT,
    "language_code" TEXT,
    "currency_code" TEXT,
    "timezone" TEXT,
    "lifecycle_status" "CrmLifecycleStatus" NOT NULL DEFAULT 'prospect',
    "vip_level" INTEGER NOT NULL DEFAULT 0,
    "classification" TEXT,
    "is_corporate" BOOLEAN NOT NULL DEFAULT false,
    "company_name" TEXT,
    "acquisition_channel" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "contact_type" "CrmContactType" NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_addresses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "address_type" "CrmAddressType" NOT NULL DEFAULT 'other',
    "label" TEXT,
    "address_json" JSONB NOT NULL,
    "delivery_instructions" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_relationships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "related_customer_id" UUID,
    "related_name" TEXT,
    "relation_type" "CrmRelationType" NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customer_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_communication_consents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "channel" "ConsentChannel" NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "source" TEXT,
    "granted_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "evidence_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_communication_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_preferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "pref_key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customer_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_customer_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_groups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_customer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_group_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_customer_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_custom_field_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL DEFAULT 'customer',
    "field_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" "CrmFieldType" NOT NULL,
    "options_json" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_custom_field_values" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "value_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_customer_profiles_lifecycle_idx" ON "crm_customer_profiles"("tenant_id", "lifecycle_status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_customer_profiles_tenant_customer_unique" ON "crm_customer_profiles"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "crm_customer_contacts_tenant_customer_idx" ON "crm_customer_contacts"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "crm_customer_addresses_tenant_customer_idx" ON "crm_customer_addresses"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "crm_customer_relationships_tenant_customer_idx" ON "crm_customer_relationships"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_consents_tenant_customer_channel_purpose_unique" ON "crm_communication_consents"("tenant_id", "customer_id", "channel", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "crm_preferences_tenant_customer_key_unique" ON "crm_customer_preferences"("tenant_id", "customer_id", "pref_key");

-- CreateIndex
CREATE UNIQUE INDEX "crm_tags_tenant_name_unique" ON "crm_tags"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "crm_customer_tags_tenant_tag_idx" ON "crm_customer_tags"("tenant_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_customer_tags_tenant_customer_tag_unique" ON "crm_customer_tags"("tenant_id", "customer_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_customer_groups_tenant_code_unique" ON "crm_customer_groups"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "crm_group_members_tenant_customer_idx" ON "crm_customer_group_members"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_group_members_tenant_group_customer_unique" ON "crm_customer_group_members"("tenant_id", "group_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_custom_fields_tenant_entity_key_unique" ON "crm_custom_field_definitions"("tenant_id", "entity_type", "field_key");

-- CreateIndex
CREATE INDEX "crm_custom_field_values_tenant_customer_idx" ON "crm_custom_field_values"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_custom_field_values_tenant_def_customer_unique" ON "crm_custom_field_values"("tenant_id", "definition_id", "customer_id");

-- AddForeignKey
ALTER TABLE "crm_customer_profiles" ADD CONSTRAINT "crm_customer_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_contacts" ADD CONSTRAINT "crm_customer_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_addresses" ADD CONSTRAINT "crm_customer_addresses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_relationships" ADD CONSTRAINT "crm_customer_relationships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_communication_consents" ADD CONSTRAINT "crm_communication_consents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_preferences" ADD CONSTRAINT "crm_customer_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_tags" ADD CONSTRAINT "crm_customer_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_tags" ADD CONSTRAINT "crm_customer_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "crm_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_groups" ADD CONSTRAINT "crm_customer_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_group_members" ADD CONSTRAINT "crm_customer_group_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_group_members" ADD CONSTRAINT "crm_customer_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "crm_customer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_custom_field_definitions" ADD CONSTRAINT "crm_custom_field_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_custom_field_values" ADD CONSTRAINT "crm_custom_field_values_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_custom_field_values" ADD CONSTRAINT "crm_custom_field_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "crm_custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
