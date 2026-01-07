import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSession } from "@/lib/auth";

// GET /api/work-orders/[id]/signatures - List signatures for work order
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workOrderId } = await params;
  const auth = await requireAuthSession();
  if ("status" in auth) return auth;
  const { orgId } = auth;

  const signatures = await prisma.signature.findMany({
    where: { orgId, workOrderId },
    include: { capturedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { signedAt: "desc" },
  });

  return NextResponse.json({ data: signatures });
}

// POST /api/work-orders/[id]/signatures - Add signature
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workOrderId } = await params;
  const auth = await requireAuthSession();
  if ("status" in auth) return auth;
  const { orgId, userId } = auth;

  const body = await req.json();
  const { signatureType, signerName, signerTitle, signatureData } = body;

  if (!signatureType || !signerName || !signatureData) {
    return NextResponse.json({ error: "signatureType, signerName, and signatureData are required" }, { status: 400 });
  }

  if (!["CUSTOMER", "TECH", "WITNESS"].includes(signatureType)) {
    return NextResponse.json({ error: "Invalid signatureType" }, { status: 400 });
  }

  // Verify work order exists and belongs to org
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, orgId },
  });
  if (!workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  const signature = await prisma.signature.create({
    data: {
      orgId,
      workOrderId,
      signatureType,
      signerName,
      signerTitle: signerTitle || null,
      signatureData,
      capturedByUserId: userId,
    },
    include: { capturedBy: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ data: signature }, { status: 201 });
}
