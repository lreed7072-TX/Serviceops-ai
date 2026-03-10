import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { enqueue } from "@/lib/qbo/qbo-queue";

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;
  const search = url.searchParams.get("search") || "";

  const where: Record<string, unknown> = { orgId, isActive: true };
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.vendor.count({ where }),
  ]);

  return NextResponse.json({ data: vendors, total });
}

export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;

  const body = await request.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
  }

  const vendor = await prisma.vendor.create({
    data: {
      orgId,
      name: body.name.trim(),
      companyName: body.companyName || null,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      city: body.city || null,
      state: body.state || null,
      postalCode: body.postalCode || null,
      vendorType: body.vendorType || "SUPPLIER",
      tax1099: body.tax1099 || false,
      notes: body.notes || null,
    },
  });

  // Auto-link materials with matching manufacturer name
  await prisma.material.updateMany({
    where: {
      orgId,
      manufacturer: { equals: vendor.name, mode: "insensitive" },
      vendorId: null,
    },
    data: { vendorId: vendor.id },
  });

  // Enqueue QBO sync if connected
  const connection = await prisma.qboConnection.findFirst({
    where: { orgId, isActive: true },
  });
  if (connection) {
    await enqueue(orgId, connection.id, "vendor", vendor.id, "push", 5);
  }

  return NextResponse.json(vendor, { status: 201 });
}
