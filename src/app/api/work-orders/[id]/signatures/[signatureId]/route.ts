import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

// DELETE /api/work-orders/[id]/signatures/[signatureId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; signatureId: string }> }
) {
  const { id: workOrderId, signatureId } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, orgId: auth.orgId },
  });
  if (!workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  const signature = await prisma.signature.findFirst({
    where: { id: signatureId, workOrderId },
  });
  if (!signature) {
    return NextResponse.json({ error: "Signature not found" }, { status: 404 });
  }

  await prisma.signature.delete({ where: { id: signatureId } });

  return NextResponse.json({ success: true });
}
