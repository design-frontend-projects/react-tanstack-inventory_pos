/*
  Warnings:

  - Made the column `period_key` on table `document_sequences` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "document_sequences" ALTER COLUMN "period_key" SET NOT NULL,
ALTER COLUMN "period_key" SET DEFAULT 'all';
