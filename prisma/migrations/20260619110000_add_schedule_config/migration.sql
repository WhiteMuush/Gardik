-- AlterTable
ALTER TABLE "Company" ADD COLUMN "scanIntervalMinutes" INTEGER,
ADD COLUMN "lastScanAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DirectoryConnection" ADD COLUMN "autoSyncIntervalMinutes" INTEGER;
