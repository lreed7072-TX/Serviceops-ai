import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail } from "@/lib/qbo/qbo-client";
import { getActiveConnection } from "@/lib/qbo/qbo-sync";

export async function POST(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;

  const body = await req.json();
  const { invoiceId, sendTo } = body;

  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, orgId },
    include: { customer: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (!invoice.qboInvoiceId) {
    return NextResponse.json(
      { error: "Invoice must be synced to QBO before sending via QBO email. Sync the invoice first." },
      { status: 400 }
    );
  }

  const connection = await getActiveConnection(orgId);
  if (!connection) {
    return NextResponse.json({ error: "No active QBO connection" }, { status: 400 });
  }

  try {
    const emailTo = sendTo || invoice.customer.primaryEmail || undefined;
    const result = await sendInvoiceEmail(connection, invoice.qboInvoiceId, emailTo);

    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "invoice",
        entityId: invoiceId,
        qboEntityId: invoice.qboInvoiceId,
        action: "email",
        status: "success",
        metadata: { sentTo: emailTo, emailStatus: result.EmailStatus },
      },
    });

    return NextResponse.json({
      data: {
        success: true,
        message: `Invoice ${invoice.invoiceNumber} sent via QBO${emailTo ? ` to ${emailTo}` : ""}`,
        emailStatus: result.EmailStatus,
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to send invoice via QBO: ${errorMessage}` }, { status: 500 });
  }
}
