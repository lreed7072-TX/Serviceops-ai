import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/qbo/qbo-queue";

export async function POST(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId, role } = authResult.auth;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { entityType } = body; // "customers" | "invoices" | "items" | "estimates"

  if (!entityType || !["customers", "invoices", "items", "estimates"].includes(entityType)) {
    return NextResponse.json(
      { error: "entityType must be one of: customers, invoices, items, estimates" },
      { status: 400 }
    );
  }

  const connection = await prisma.qboConnection.findFirst({
    where: { orgId, isActive: true },
    select: { id: true },
  });
  if (!connection) {
    return NextResponse.json({ error: "No active QBO connection" }, { status: 400 });
  }

  let enqueued = 0;

  if (entityType === "customers") {
    const customers = await prisma.customer.findMany({
      where: { orgId, qboCustomerId: null },
      select: { id: true },
    });
    for (const c of customers) {
      await enqueue(orgId, connection.id, "customer", c.id, "push", 1);
      enqueued++;
    }
  } else if (entityType === "invoices") {
    const invoices = await prisma.invoice.findMany({
      where: { orgId, qboInvoiceId: null, status: { in: ["SENT", "PAID"] } },
      select: { id: true },
    });
    for (const inv of invoices) {
      await enqueue(orgId, connection.id, "invoice", inv.id, "push", 1);
      enqueued++;
    }
  } else if (entityType === "items") {
    const materials = await prisma.material.findMany({
      where: { orgId, qboItemId: null, isActive: true },
      select: { id: true },
    });
    for (const m of materials) {
      await enqueue(orgId, connection.id, "item", m.id, "push", 1, { sourceType: "material" });
      enqueued++;
    }
    const laborRates = await prisma.laborRate.findMany({
      where: { orgId, qboItemId: null },
      select: { id: true },
    });
    for (const lr of laborRates) {
      await enqueue(orgId, connection.id, "item", lr.id, "push", 1, { sourceType: "laborRate" });
      enqueued++;
    }
  } else if (entityType === "estimates") {
    const quotes = await prisma.quote.findMany({
      where: { orgId, qboEstimateId: null, status: { in: ["SENT", "APPROVED"] } },
      select: { id: true },
    });
    for (const q of quotes) {
      await enqueue(orgId, connection.id, "estimate", q.id, "push", 1);
      enqueued++;
    }
  }

  return NextResponse.json({ data: { entityType, enqueued } });
}
