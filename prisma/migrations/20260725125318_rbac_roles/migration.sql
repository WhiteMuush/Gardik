-- Add nullable roleId to User (holds the old enum value's replacement)
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

-- Backfill roleId from the old enum before the column/type are dropped.
-- Deterministic IDs so the follow-up INSERTs below (once the Role table
-- exists) can target the exact rows these updates point at.
UPDATE "User" u SET "roleId" = 'role_admin_' || u."companyId" WHERE u."role" = 'ADMIN';
UPDATE "User" u SET "roleId" = 'role_viewer_' || u."companyId" WHERE u."role" = 'VIEWER';

-- Drop the old enum column and type. This must happen before CREATE TABLE
-- "Role" below: Postgres keeps table and type names in the same namespace,
-- so a table named "Role" cannot be created while the enum type "Role" (used
-- by the column just dropped) still exists.
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";

-- Create Role table
CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "permissions" TEXT[],
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isAssignable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the two presets this migration needs (Administrator, Viewer) for every
-- existing company, with the exact ids the backfill above already pointed
-- roleId at. Other presets (Security Manager, SOC Analyst) are seeded by the
-- app on company creation and can be added later; existing users only ever
-- held ADMIN or VIEWER.
INSERT INTO "Role" ("id", "companyId", "name", "description", "permissions", "isSystem", "isAssignable", "createdAt", "updatedAt")
SELECT 'role_admin_' || c."id", c."id", 'Administrator', 'Full access. Built-in, cannot be edited or deleted.',
       ARRAY[]::TEXT[], true, true, now(), now()
FROM "Company" c;

INSERT INTO "Role" ("id", "companyId", "name", "description", "permissions", "isSystem", "isAssignable", "createdAt", "updatedAt")
SELECT 'role_viewer_' || c."id", c."id", 'Viewer', 'Read-only across the workspace.',
       ARRAY[]::TEXT[], false, true, now(), now()
FROM "Company" c;

-- FK for User.roleId, now that every referenced Role row exists.
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
