-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "accent" TEXT NOT NULL DEFAULT 'violet',
    "textSize" TEXT NOT NULL DEFAULT 'default',
    "motion" TEXT NOT NULL DEFAULT 'system',
    "colorblind" BOOLEAN NOT NULL DEFAULT false,
    "readableFont" BOOLEAN NOT NULL DEFAULT false,
    "timeZone" TEXT,
    "homePage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
