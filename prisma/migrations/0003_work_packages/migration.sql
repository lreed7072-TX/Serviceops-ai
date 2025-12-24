-- CreateEnum
CREATE TYPE "WorkPackageType" AS ENUM ('MECH_ELEC_UNIFIED', 'MECHANICAL', 'ELECTRICAL', 'CONTROLS', 'INSTRUMENTATION');

-- CreateTable
CREATE TABLE "WorkPackage" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "packageType" "WorkPackageType" NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "leadTechId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkPackage_orgId_idx" ON "WorkPackage"("orgId");

-- CreateIndex
CREATE INDEX "WorkPackage_orgId_workOrderId_idx" ON "WorkPackage"("orgId", "workOrderId");

-- AddForeignKey
ALTER TABLE "WorkPackage" ADD CONSTRAINT "WorkPackage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPackage" ADD CONSTRAINT "WorkPackage_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPackage" ADD CONSTRAINT "WorkPackage_leadTechId_fkey" FOREIGN KEY ("leadTechId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
