import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { enqueue } from "@/lib/qbo/qbo-queue";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;
  const { id } = await params;

  const vendor = await prisma.vendor.findFirst({
    where: { id, orgId },
    include: { materials: { select: { id: true, name: true, partNumber: true } } },
  });

  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  return NextResponse.json(vendor);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;
  const { id } = await params;

  const body = await request.json();

  const existing = await prisma.vendor.findFirst({
    where: { id, orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const vendor = await prisma.vendor.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.companyName !== undefined ? { companyName: body.companyName } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.city !== undefined ? { city: body.city } : {}),
      ...(body.state !== undefined ? { state: body.state } : {}),
      ...(body.postalCode !== undefined ? { postalCode: body.postalCode } : {}),
      ...(body.vendorType !== undefined ? { vendorType: body.vendorType } : {}),
      ...(body.tax1099 !== undefined ? { tax1099: body.tax1099 } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });

  // Enqueue QBO sync if connected
  const connection = await prisma.qboConnection.findFirst({
    where: { orgId, isActive: true },
  });
  if (connection) {
    await enqueue(orgId, connection.id, "vendor", vendor.id, "push", 5);
  }

  return NextResponse.json(vendor);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;
  const { id } = await params;

  const existing = await prisma.vendor.findFirst({
    where: { id, orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  // Soft delete
  await prisma.vendor.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
