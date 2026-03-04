import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { parseJson } from "@/lib/api-server";
import { syncCustomerToQbo, syncInvoiceToQbo } from "@/lib/qbo/qbo-sync";

type SyncRequest = {
  entityType: "customers" | "invoices";
  entityId?: string;
};

// POST /api/integrations/qbo/sync
// Manual sync trigger for customers or invoices
export async function POST(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;

  const body = await parseJson<SyncRequest>(req);
  if (!body?.entityType) {
    return NextResponse.json(
      { error: "entityType is required (customers or invoices)" },
      { status: 400 }
    );
  }

  // Verify org has active QBO connection
  const connection = await prisma.qboConnection.findFirst({
    where: { orgId, isActive: true },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "No active QBO connection. Connect to QuickBooks first." },
      { status: 400 }
    );
  }

  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  if (body.entityType === "customers") {
    if (body.entityId) {
      // Sync a single customer
      const result = await syncCustomerToQbo(orgId, body.entityId);
      results.push({
        id: body.entityId,
        success: result.success,
        error: result.error,
      });
    } else {
      // Sync all customers that haven't been synced yet
      const customers = await prisma.customer.findMany({
        where: { orgId, qboCustomerId: null },
        select: { id: true },
      });

      for (const customer of customers) {
        const result = await syncCustomerToQbo(orgId, customer.id);
        results.push({
          id: customer.id,
          success: result.success,
          error: result.error,
        });
      }
    }
  } else if (body.entityType === "invoices") {
    if (body.entityId) {
      // Sync a single invoice
      const result = await syncInvoiceToQbo(orgId, body.entityId);
      results.push({
        id: body.entityId,
        success: result.success,
        error: result.error,
      });
    } else {
      // Sync all SENT invoices that haven't been synced
      const invoices = await prisma.invoice.findMany({
        where: { orgId, qboInvoiceId: null, status: "SENT" },
        select: { id: true },
      });

      for (const invoice of invoices) {
        const result = await syncInvoiceToQbo(orgId, invoice.id);
        results.push({
          id: invoice.id,
          success: result.success,
          error: result.error,
        });
      }
    }
  } else {
    return NextResponse.json(
      { error: "entityType must be 'customers' or 'invoices'" },
      { status: 400 }
    );
  }

  // Update last sync time
  await prisma.qboConnection.update({
    where: { id: connection.id },
    data: { lastSyncAt: new Date() },
  });

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return NextResponse.json({
    data: {
      synced: successCount,
      failed: failCount,
      total: results.length,
      results,
    },
  });
}
