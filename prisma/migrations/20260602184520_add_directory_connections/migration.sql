-- CreateEnum
CREATE TYPE "DirectoryType" AS ENUM ('AZURE_AD', 'GOOGLE_WORKSPACE', 'LDAP');

-- CreateEnum
CREATE TYPE "ConnectStatus" AS ENUM ('ACTIVE', 'ERROR', 'PENDING');

-- CreateTable
CREATE TABLE "DirectoryConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "DirectoryType" NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedConfig" TEXT NOT NULL,
    "status" "ConnectStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncCount" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectoryConnection_companyId_idx" ON "DirectoryConnection"("companyId");

-- AddForeignKey
ALTER TABLE "DirectoryConnection" ADD CONSTRAINT "DirectoryConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
