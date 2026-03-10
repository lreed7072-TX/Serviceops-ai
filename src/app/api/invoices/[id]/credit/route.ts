import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { enqueue } from "@/lib/qbo/qbo-queue";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { orgId, role } = authResult.auth;
  const { id } = await params;

  // Role check — ADMIN or DISPATCHER only
  if (role !== "ADMIN" && role !== "DISPATCHER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id, orgId },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!invoice.qboInvoiceId) {
    return NextResponse.json({ error: "Invoice must be synced to QBO before issuing credit memo" }, { status: 400 });
  }

  if (invoice.qboCreditMemoId) {
    return NextResponse.json({ error: "Credit memo already issued for this invoice" }, { status: 400 });
  }

  if (invoice.status !== "PAID" && invoice.status !== "SENT") {
    return NextResponse.json({ error: "Cannot issue credit for draft or canceled invoices" }, { status: 400 });
  }

  const connection = await prisma.qboConnection.findFirst({
    where: { orgId, isActive: true },
  });

  if (!connection) {
    return NextResponse.json({ error: "No active QBO connection" }, { status: 400 });
  }

  await enqueue(orgId, connection.id, "creditMemo", invoice.id, "push", 1);

  return NextResponse.json({
    success: true,
    message: "Credit memo queued for sync to QuickBooks",
  });
}
