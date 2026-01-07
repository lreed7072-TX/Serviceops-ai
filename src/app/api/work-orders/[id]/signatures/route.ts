import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

// GET /api/work-orders/[id]/signatures - List signatures for work order
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, orgId: auth.orgId },
  });
  if (!workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  const signatures = await prisma.signature.findMany({
    where: { workOrderId },
    include: { capturedBy: { select: { id: true, name: true } } },
    orderBy: { signedAt: "desc" },
  });

  return NextResponse.json({ data: signatures });
}

// POST /api/work-orders/[id]/signatures - Add signature
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, orgId: auth.orgId },
  });
  if (!workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  const body = await req.json();
  const { signatureType, signerName, signerTitle, signatureData } = body;

  if (!signatureType || !signerName || !signatureData) {
    return NextResponse.json(
      { error: "signatureType, signerName, and signatureData are required" },
      { status: 400 }
    );
  }

  const signature = await prisma.signature.create({
    data: {
      orgId: auth.orgId,
      workOrderId,
      signatureType,
      signerName,
      signerTitle: signerTitle || null,
      signatureData,
      capturedByUserId: auth.userId,
    },
  });

  return NextResponse.json({ data: signature }, { status: 201 });
}
