-- CreateEnum
CREATE TYPE "RemediationType" AS ENUM ('REVOKE_SESSIONS', 'FORCE_PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "RemediationStatus" AS ENUM ('SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "remediationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RemediationAction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "alertId" TEXT,
    "action" "RemediationType" NOT NULL,
    "status" "RemediationStatus" NOT NULL,
    "target" TEXT NOT NULL,
    "detail" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemediationAction_companyId_idx" ON "RemediationAction"("companyId");

-- AddForeignKey
ALTER TABLE "RemediationAction" ADD CONSTRAINT "RemediationAction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
