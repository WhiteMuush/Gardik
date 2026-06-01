/*
  Warnings:

  - You are about to drop the column `isDefault` on the `DashboardPreset` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `DashboardPreset` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PresetScope" AS ENUM ('PERSONAL', 'COMPANY');

-- AlterTable
ALTER TABLE "DashboardPreset" DROP COLUMN "isDefault",
ADD COLUMN     "scope" "PresetScope" NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "layout" SET DEFAULT '[]',
ALTER COLUMN "widgets" SET DEFAULT '[]';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activePresetId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activePresetId_fkey" FOREIGN KEY ("activePresetId") REFERENCES "DashboardPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
