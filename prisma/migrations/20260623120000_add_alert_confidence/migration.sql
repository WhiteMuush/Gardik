-- CreateEnum
CREATE TYPE "AlertConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "confidence" "AlertConfidence" NOT NULL DEFAULT 'MEDIUM';
