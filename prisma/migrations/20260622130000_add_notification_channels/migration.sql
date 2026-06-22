-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WEBHOOK', 'SLACK', 'TEAMS', 'EMAIL');

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN "channel" "NotificationChannel" NOT NULL DEFAULT 'WEBHOOK';
