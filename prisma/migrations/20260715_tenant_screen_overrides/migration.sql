-- CreateTable
CREATE TABLE "tenant_screens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "screen_id" UUID NOT NULL,
    "show_in_menu" BOOLEAN,
    "display_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_screens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_screens_screen_idx" ON "tenant_screens"("screen_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_screens_tenant_screen_unique" ON "tenant_screens"("tenant_id", "screen_id");

-- AddForeignKey
ALTER TABLE "tenant_screens" ADD CONSTRAINT "tenant_screens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_screens" ADD CONSTRAINT "tenant_screens_screen_id_fkey" FOREIGN KEY ("screen_id") REFERENCES "screens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
