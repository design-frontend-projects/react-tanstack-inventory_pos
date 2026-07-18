-- CreateEnum
CREATE TYPE "ResFloorStaffRole" AS ENUM ('floor_manager', 'waiter');

-- CreateTable
CREATE TABLE "res_floor_staff_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "dining_area_id" UUID NOT NULL,
    "section_id" UUID,
    "table_id" UUID,
    "profile_id" UUID NOT NULL,
    "role" "ResFloorStaffRole" NOT NULL DEFAULT 'waiter',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "res_floor_staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "res_floor_staff_assignments_tenant_branch_idx" ON "res_floor_staff_assignments"("tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "res_floor_staff_assignments_tenant_area_idx" ON "res_floor_staff_assignments"("tenant_id", "dining_area_id");

-- CreateIndex
CREATE INDEX "res_floor_staff_assignments_tenant_profile_idx" ON "res_floor_staff_assignments"("tenant_id", "profile_id");

-- AddForeignKey
ALTER TABLE "res_floor_staff_assignments" ADD CONSTRAINT "res_floor_staff_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
