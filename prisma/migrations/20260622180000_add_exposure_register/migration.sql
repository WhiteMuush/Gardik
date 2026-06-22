-- CreateEnum
CREATE TYPE "RegisterStatus" AS ENUM ('ASSESSING', 'NOTIFIED', 'NOT_REQUIRED');

-- CreateTable
CREATE TABLE "ExposureRegisterEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "status" "RegisterStatus" NOT NULL DEFAULT 'ASSESSING',
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "dataCategories" TEXT[],
    "assessment" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExposureRegisterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExposureRegisterEntry_companyId_idx" ON "ExposureRegisterEntry"("companyId");

-- AddForeignKey
ALTER TABLE "ExposureRegisterEntry" ADD CONSTRAINT "ExposureRegisterEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
