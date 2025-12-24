-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "AssetCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Asset"
  RENAME COLUMN "serial" TO "serialNumber";

ALTER TABLE "Asset"
  DROP COLUMN "description",
  ADD COLUMN     "manufacturer" TEXT,
  ADD COLUMN     "model" TEXT,
  ADD COLUMN     "assetTag" TEXT,
  ADD COLUMN     "location" TEXT,
  ADD COLUMN     "notes" TEXT,
  ADD COLUMN     "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN     "criticality" "AssetCriticality",
  ADD COLUMN     "nameplateSchemaVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN     "nameplate" JSONB;
