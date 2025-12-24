-- CreateEnum
CREATE TYPE "TaskEvidenceType" AS ENUM ('NOTE', 'PHOTO', 'FILE');

-- AlterTable
ALTER TABLE "TaskInstance"
  ADD COLUMN "requiresEvidence" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TaskEvidence" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "taskInstanceId" UUID NOT NULL,
    "type" "TaskEvidenceType" NOT NULL,
    "noteText" TEXT,
    "url" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskEvidence_orgId_idx" ON "TaskEvidence"("orgId");

-- CreateIndex
CREATE INDEX "TaskEvidence_orgId_taskInstanceId_idx" ON "TaskEvidence"("orgId", "taskInstanceId");

-- CreateIndex
CREATE INDEX "TaskEvidence_orgId_createdByUserId_idx" ON "TaskEvidence"("orgId", "createdByUserId");

-- AddForeignKey
ALTER TABLE "TaskEvidence" ADD CONSTRAINT "TaskEvidence_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvidence" ADD CONSTRAINT "TaskEvidence_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES "TaskInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvidence" ADD CONSTRAINT "TaskEvidence_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
