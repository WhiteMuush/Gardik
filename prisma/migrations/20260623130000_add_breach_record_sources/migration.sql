-- AlterTable
ALTER TABLE "BreachRecord" ADD COLUMN "sources" "ApiProvider"[] DEFAULT ARRAY[]::"ApiProvider"[];
