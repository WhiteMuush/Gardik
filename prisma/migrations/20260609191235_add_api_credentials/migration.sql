-- CreateEnum
CREATE TYPE "ApiProvider" AS ENUM ('HIBP', 'DEHASHED', 'LEAKCHECK', 'INTELX', 'SNUSBASE');

-- CreateTable
CREATE TABLE "ApiCredential" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "ApiProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "status" "ConnectStatus" NOT NULL DEFAULT 'PENDING',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiCredential_companyId_idx" ON "ApiCredential"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCredential_companyId_provider_key" ON "ApiCredential"("companyId", "provider");

-- AddForeignKey
ALTER TABLE "ApiCredential" ADD CONSTRAINT "ApiCredential_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
