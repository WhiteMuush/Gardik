-- CreateEnum
CREATE TYPE "ScanCheckStatus" AS ENUM ('CHECKED', 'FAILED');

-- AlterTable
ALTER TABLE "ApiCredential" ADD COLUMN     "rateLimitPerMinute" INTEGER;

-- CreateTable
CREATE TABLE "ScanCheck" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "provider" "ApiProvider" NOT NULL,
    "status" "ScanCheckStatus" NOT NULL,
    "failureReason" TEXT,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "ScanCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanCheck_provider_status_idx" ON "ScanCheck"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScanCheck_employeeId_provider_key" ON "ScanCheck"("employeeId", "provider");

-- AddForeignKey
ALTER TABLE "ScanCheck" ADD CONSTRAINT "ScanCheck_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
