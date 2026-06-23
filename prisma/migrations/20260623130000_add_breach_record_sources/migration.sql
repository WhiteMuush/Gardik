-- AlterTable
ALTER TABLE "BreachRecord" ADD COLUMN "sources" "ApiProvider"[] NOT NULL DEFAULT ARRAY[]::"ApiProvider"[];

ALTER TABLE "BreachRecord" ALTER COLUMN "sources" DROP DEFAULT;
