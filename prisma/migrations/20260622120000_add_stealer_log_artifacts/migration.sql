-- AlterEnum
ALTER TYPE "BreachSource" ADD VALUE 'STEALER_LOG';

-- AlterEnum
ALTER TYPE "ApiProvider" ADD VALUE 'HIBP_STEALER';

-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('PASSWORD', 'COOKIE', 'TOKEN', 'AUTOFILL');

-- AlterTable
ALTER TABLE "BreachRecord" ADD COLUMN "artifacts" "ArtifactKind"[] NOT NULL DEFAULT ARRAY[]::"ArtifactKind"[],
ADD COLUMN "machineId" TEXT,
ADD COLUMN "malwareFamily" TEXT,
ADD COLUMN "capturedAt" TIMESTAMP(3);

ALTER TABLE "BreachRecord" ALTER COLUMN "artifacts" DROP DEFAULT;
