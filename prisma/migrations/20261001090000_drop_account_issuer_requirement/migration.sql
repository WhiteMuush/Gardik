-- Better Auth 1.7.5 reverted the issuer-keyed account lookup introduced in
-- 1.7.0 and resolves accounts by (providerId, accountId) again. It no longer
-- writes "issuer", so the column must accept NULL or sign-ups and account
-- linking fail. The column and its backfilled values are kept so an image
-- rolled back to 1.7.2 still authenticates existing accounts.
ALTER TABLE "Account" ALTER COLUMN "issuer" DROP NOT NULL;

DROP INDEX "Account_issuer_accountId_idx";

CREATE INDEX "Account_providerId_accountId_idx" ON "Account"("providerId", "accountId");
