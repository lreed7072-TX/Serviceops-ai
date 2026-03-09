-- AlterTable
ALTER TABLE "QboSyncJob" ADD COLUMN "qboEntityId" TEXT,
ADD COLUMN "qboRealmId" TEXT;

-- CreateIndex
CREATE INDEX "QboSyncJob_qboEntityId_entityType_status_idx" ON "QboSyncJob"("qboEntityId", "entityType", "status");
