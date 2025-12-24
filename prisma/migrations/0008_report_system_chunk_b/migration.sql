-- CreateEnum
CREATE TYPE "ReportBlockType" AS ENUM ('HEADING', 'RICH_TEXT', 'TABLE', 'IMAGE');

-- CreateTable
CREATE TABLE "ReportBlock" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "reportTemplateId" UUID NOT NULL,
    "type" "ReportBlockType" NOT NULL,
    "title" TEXT,
    "props" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportBlock_orgId_idx" ON "ReportBlock"("orgId");

-- CreateIndex
CREATE INDEX "ReportBlock_orgId_reportTemplateId_idx" ON "ReportBlock"("orgId", "reportTemplateId");

-- CreateIndex
CREATE INDEX "ReportBlock_orgId_reportTemplateId_sortOrder_idx" ON "ReportBlock"("orgId", "reportTemplateId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ReportBlock" ADD CONSTRAINT "ReportBlock_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportBlock" ADD CONSTRAINT "ReportBlock_reportTemplateId_fkey" FOREIGN KEY ("reportTemplateId") REFERENCES "ReportTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
