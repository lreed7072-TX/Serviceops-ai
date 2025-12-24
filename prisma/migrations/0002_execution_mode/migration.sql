-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('UNIFIED', 'MULTI_LANE');

-- AlterTable
ALTER TABLE "WorkOrder"
ADD COLUMN     "executionMode" "ExecutionMode" NOT NULL DEFAULT 'UNIFIED';
