-- CreateEnum
CREATE TYPE "ResEventKind" AS ENUM ('birthday', 'corporate', 'wedding', 'family', 'graduation', 'vip', 'holiday', 'private');

-- CreateEnum
CREATE TYPE "ResEventStatus" AS ENUM ('inquiry', 'quoted', 'confirmed', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ResEventTaskStatus" AS ENUM ('todo', 'doing', 'done');

-- CreateEnum
CREATE TYPE "ResEventPaymentKind" AS ENUM ('deposit', 'installment', 'final', 'refund');

-- CreateEnum
CREATE TYPE "ResCateringKind" AS ENUM ('corporate', 'delivery', 'outside');

-- CreateEnum
CREATE TYPE "ResCateringStatus" AS ENUM ('draft', 'confirmed', 'prepping', 'dispatched', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "res_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "ResEventKind" NOT NULL DEFAULT 'private',
    "status" "ResEventStatus" NOT NULL DEFAULT 'inquiry',
    "name" TEXT NOT NULL,
    "customer_id" UUID,
    "hall_id" UUID,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "guest_count" INTEGER NOT NULL DEFAULT 20,
    "package_json" JSONB NOT NULL DEFAULT '{}',
    "quote_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_event_tasks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ResEventTaskStatus" NOT NULL DEFAULT 'todo',
    "due_at" TIMESTAMP(3),
    "assignee_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_event_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_event_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "kind" "ResEventPaymentKind" NOT NULL DEFAULT 'deposit',
    "amount" DECIMAL(19,4) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "reference" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "res_event_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_party_bookings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "theme" TEXT,
    "decorations_json" JSONB,
    "seating_json" JSONB,
    "vendor_json" JSONB,
    "cost_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "revenue_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_party_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "res_catering_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "ResCateringKind" NOT NULL DEFAULT 'corporate',
    "status" "ResCateringStatus" NOT NULL DEFAULT 'draft',
    "name" TEXT NOT NULL,
    "customer_id" UUID,
    "event_date" TIMESTAMP(3) NOT NULL,
    "address_line" TEXT,
    "guest_count" INTEGER NOT NULL DEFAULT 20,
    "menu_json" JSONB NOT NULL DEFAULT '{}',
    "equipment_json" JSONB,
    "vehicle_json" JSONB,
    "staff_json" JSONB,
    "cost_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "quote_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "res_catering_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "res_events_tenant_branch_time_idx" ON "res_events"("tenant_id", "branch_id", "starts_at");

-- CreateIndex
CREATE INDEX "res_events_tenant_branch_status_idx" ON "res_events"("tenant_id", "branch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "res_events_tenant_branch_code_unique" ON "res_events"("tenant_id", "branch_id", "code");

-- CreateIndex
CREATE INDEX "res_event_tasks_tenant_event_idx" ON "res_event_tasks"("tenant_id", "event_id");

-- CreateIndex
CREATE INDEX "res_event_payments_tenant_event_idx" ON "res_event_payments"("tenant_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "res_party_bookings_event_id_key" ON "res_party_bookings"("event_id");

-- CreateIndex
CREATE INDEX "res_catering_jobs_tenant_branch_date_idx" ON "res_catering_jobs"("tenant_id", "branch_id", "event_date");

-- CreateIndex
CREATE UNIQUE INDEX "res_catering_jobs_tenant_branch_code_unique" ON "res_catering_jobs"("tenant_id", "branch_id", "code");

-- AddForeignKey
ALTER TABLE "res_events" ADD CONSTRAINT "res_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_event_tasks" ADD CONSTRAINT "res_event_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_event_tasks" ADD CONSTRAINT "res_event_tasks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "res_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_event_payments" ADD CONSTRAINT "res_event_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_event_payments" ADD CONSTRAINT "res_event_payments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "res_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_party_bookings" ADD CONSTRAINT "res_party_bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_party_bookings" ADD CONSTRAINT "res_party_bookings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "res_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "res_catering_jobs" ADD CONSTRAINT "res_catering_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
