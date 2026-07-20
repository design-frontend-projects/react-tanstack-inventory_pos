-- CreateEnum
CREATE TYPE "ResReservationStatus" AS ENUM ('requested', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled');

-- CreateEnum
CREATE TYPE "ResReservationSource" AS ENUM ('phone', 'walk_in', 'qr', 'online');

-- CreateEnum
CREATE TYPE "ResWaitlistPriority" AS ENUM ('normal', 'family', 'vip');

-- CreateEnum
CREATE TYPE "ResWaitlistStatus" AS ENUM ('waiting', 'notified', 'seated', 'left');

-- CreateEnum
CREATE TYPE "ResQrCampaignTarget" AS ENUM ('table', 'menu', 'campaign');

-- CreateEnum
CREATE TYPE "ResDriverStatus" AS ENUM ('offline', 'available', 'on_delivery');

-- CreateEnum
CREATE TYPE "ResDeliveryStatus" AS ENUM ('pending', 'assigned', 'picked_up', 'en_route', 'delivered', 'failed');

-- AlterTable
ALTER TABLE "res_tables" ADD COLUMN     "height" DECIMAL(6,5),
ADD COLUMN     "pos_x" DECIMAL(6,5),
ADD COLUMN     "pos_y" DECIMAL(6,5),
ADD COLUMN     "width" DECIMAL(6,5);

-- CreateTable
CREATE TABLE "res_reservations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" UUID,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT,
    "party_size" INTEGER NOT NULL DEFAULT 2,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 90,
    "status" "ResReservationStatus" NOT NULL DEFAULT 'requested',
    "source" "ResReservationSource" NOT NULL DEFAULT 'phone',
    "deposit_amount" DECIMAL(19,4),
    "deposit_paid_at" TIMESTAMP(3),
    "order_id" UUID,
    "notes" TEXT,
    "seated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_reservation_tables" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_reservation_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_waitlist_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT,
    "party_size" INTEGER NOT NULL DEFAULT 2,
    "priority" "ResWaitlistPriority" NOT NULL DEFAULT 'normal',
    "status" "ResWaitlistStatus" NOT NULL DEFAULT 'waiting',
    "quoted_minutes" INTEGER NOT NULL DEFAULT 15,
    "notes" TEXT,
    "notified_at" TIMESTAMP(3),
    "seated_at" TIMESTAMP(3),
    "reservation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_pickups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "promised_at" TIMESTAMP(3) NOT NULL,
    "verification_code" TEXT NOT NULL,
    "counter" TEXT,
    "packed_at" TIMESTAMP(3),
    "notified_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_pickups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_qr_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "target" "ResQrCampaignTarget" NOT NULL DEFAULT 'menu',
    "table_id" UUID,
    "menu_id" UUID,
    "target_url" TEXT,
    "scan_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_qr_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_drivers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "profile_id" UUID,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "vehicle" TEXT,
    "status" "ResDriverStatus" NOT NULL DEFAULT 'offline',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_delivery_zones" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "fee_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "eta_minutes" INTEGER NOT NULL DEFAULT 45,
    "polygon" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "driver_id" UUID,
    "zone_id" UUID,
    "status" "ResDeliveryStatus" NOT NULL DEFAULT 'pending',
    "address_line" TEXT NOT NULL,
    "address_notes" TEXT,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "assigned_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "proof_url" TEXT,
    "fail_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "res_reservations_tenant_branch_time_idx" ON "res_reservations"("tenant_id", "branch_id", "requested_at");

-- CreateIndex
CREATE INDEX "res_reservations_tenant_branch_status_idx" ON "res_reservations"("tenant_id", "branch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "res_reservations_tenant_branch_code_unique" ON "res_reservations"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE INDEX "res_reservation_tables_tenant_table_idx" ON "res_reservation_tables"("tenant_id", "table_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_reservation_tables_unique" ON "res_reservation_tables"("reservation_id", "table_id");

-- CreateIndex
CREATE INDEX "res_waitlist_tenant_branch_status_idx" ON "res_waitlist_entries"("tenant_id", "branch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "res_pickups_order_id_key" ON "res_pickups"("order_id");

-- CreateIndex
CREATE INDEX "res_pickups_tenant_branch_time_idx" ON "res_pickups"("tenant_id", "branch_id", "promised_at");

-- CreateIndex
CREATE INDEX "res_qr_campaigns_tenant_branch_idx" ON "res_qr_campaigns"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_qr_campaigns_tenant_slug_unique" ON "res_qr_campaigns"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "res_drivers_tenant_branch_status_idx" ON "res_drivers"("tenant_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "res_delivery_zones_tenant_branch_idx" ON "res_delivery_zones"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_deliveries_order_id_key" ON "res_deliveries"("order_id");

-- CreateIndex
CREATE INDEX "res_deliveries_tenant_branch_status_idx" ON "res_deliveries"("tenant_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "res_deliveries_tenant_driver_idx" ON "res_deliveries"("tenant_id", "driver_id");

-- AddForeignKey
ALTER TABLE "res_reservations" ADD CONSTRAINT "res_reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_reservation_tables" ADD CONSTRAINT "res_reservation_tables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_reservation_tables" ADD CONSTRAINT "res_reservation_tables_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "res_reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_waitlist_entries" ADD CONSTRAINT "res_waitlist_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_pickups" ADD CONSTRAINT "res_pickups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_qr_campaigns" ADD CONSTRAINT "res_qr_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_drivers" ADD CONSTRAINT "res_drivers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_delivery_zones" ADD CONSTRAINT "res_delivery_zones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_deliveries" ADD CONSTRAINT "res_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
