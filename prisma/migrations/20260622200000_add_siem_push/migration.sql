-- AlterTable
ALTER TABLE "Company" ADD COLUMN "siemPushUrlEnc" TEXT,
ADD COLUMN "siemPushHint" TEXT,
ADD COLUMN "siemPushFormat" TEXT,
ADD COLUMN "siemPushSince" TIMESTAMP(3);
