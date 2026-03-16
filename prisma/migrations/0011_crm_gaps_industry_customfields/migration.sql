-- CRM Gap Fill: Industry lookup, CustomField system, Contact.siteId, Customer enrichment
-- Fills gaps identified during CRM reconciliation audit (2026-03-16)

-- CreateEnum
CREATE TYPE "CustomFieldEntityType" AS ENUM ('CUSTOMER', 'SITE');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN');

-- AlterTable: Add siteId to Contact for site-level contact support
ALTER TABLE "Contact" ADD COLUMN "siteId" UUID;

-- AlterTable: Add industryId and archivedAt to Customer
ALTER TABLE "Customer" ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "industryId" UUID;

-- CreateTable: Industry lookup (per-org configurable)
CREATE TABLE "Industry" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomFieldDefinition (per entity type, optionally per industry)
CREATE TABLE "CustomFieldDefinition" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "entityType" "CustomFieldEntityType" NOT NULL,
    "industryId" UUID,
    "fieldName" TEXT NOT NULL,
    "fieldType" "CustomFieldType" NOT NULL DEFAULT 'TEXT',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomFieldValue (polymorphic entity reference)
CREATE TABLE "CustomFieldValue" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "fieldDefinitionId" UUID NOT NULL,
    "entityType" "CustomFieldEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Industry_orgId_idx" ON "Industry"("orgId");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_orgId_idx" ON "CustomFieldDefinition"("orgId");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_orgId_entityType_idx" ON "CustomFieldDefinition"("orgId", "entityType");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_orgId_entityType_industryId_idx" ON "CustomFieldDefinition"("orgId", "entityType", "industryId");

-- CreateIndex
CREATE INDEX "CustomFieldValue_orgId_idx" ON "CustomFieldValue"("orgId");

-- CreateIndex
CREATE INDEX "CustomFieldValue_entityType_entityId_idx" ON "CustomFieldValue"("entityType", "entityId");

-- CreateIndex (unique constraint: one value per field per entity)
CREATE UNIQUE INDEX "CustomFieldValue_fieldDefinitionId_entityType_entityId_key" ON "CustomFieldValue"("fieldDefinitionId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "Contact_siteId_idx" ON "Contact"("siteId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
