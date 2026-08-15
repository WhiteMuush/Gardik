-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "ssoMandatory" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ssoExempt" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SsoProvider" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "oidcConfig" TEXT,
    "samlConfig" TEXT,
    "userId" TEXT,
    "providerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "domain" TEXT NOT NULL,
    "domainVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SsoProvider_providerId_key" ON "SsoProvider"("providerId");

-- CreateIndex
CREATE INDEX "SsoProvider_organizationId_idx" ON "SsoProvider"("organizationId");

-- AddForeignKey
ALTER TABLE "SsoProvider" ADD CONSTRAINT "SsoProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoProvider" ADD CONSTRAINT "SsoProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
