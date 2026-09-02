-- Better Auth 1.7 keys account lookups on (issuer, accountId) instead of
-- (providerId, accountId). Existing rows predate the column, so it is added
-- nullable, backfilled from what each row already says about itself, and only
-- then made NOT NULL.
ALTER TABLE "Account" ADD COLUMN "issuer" TEXT;

-- Password accounts: the library's synthetic issuer for a local method, from
-- createLocalAccountIssuer("credential").
UPDATE "Account" SET "issuer" = 'local:credential' WHERE "providerId" = 'credential';

-- SSO accounts: the issuer the identity provider advertises, which the
-- provider row already stores.
UPDATE "Account" AS a
SET "issuer" = p."issuer"
FROM "SsoProvider" AS p
WHERE a."providerId" = p."providerId" AND a."issuer" IS NULL;

-- Anything else is a local method whose provider has no issuer of its own.
UPDATE "Account" SET "issuer" = 'local:' || "providerId" WHERE "issuer" IS NULL;

ALTER TABLE "Account" ALTER COLUMN "issuer" SET NOT NULL;

CREATE INDEX "Account_issuer_accountId_idx" ON "Account"("issuer", "accountId");
