import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

// DELETE /api/work-orders/[id]/signatures/[signatureId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; signatureId: string }> }
) {
  const { id: workOrderId, signatureId } = await params;
  const auth = await requireAuthSessionFirst();
  if ("status" in auth) return auth;
  const { orgId } = auth;

  const signature = await prisma.signature.findFirst({
    where: { id: signatureId, workOrderId, orgId },
  });

  if (!signature) {
    return NextResponse.json({ error: "Signature not found" }, { status: 404 });
  }

  await prisma.signature.delete({ where: { id: signatureId } });

  return NextResponse.json({ success: true });
}
