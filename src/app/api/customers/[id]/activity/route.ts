import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

// GET /api/customers/[id]/activity - Get aggregated activity timeline
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { id } = await params;

  try {
    // Verify customer belongs to org
    const customer = await prisma.customer.findFirst({
      where: { id, orgId: auth.orgId },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Fetch quotes, work orders, invoices in parallel
    const [quotes, workOrders, invoices] = await Promise.all([
      prisma.quote.findMany({
        where: { customerId: id, orgId: auth.orgId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          quoteNumber: true,
          title: true,
          status: true,
          total: true,
          sentAt: true,
          approvedAt: true,
          createdAt: true,
        },
      }),
      prisma.workOrder.findMany({
        where: { customerId: id, orgId: auth.orgId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          workOrderNumber: true,
          title: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.invoice.findMany({
        where: { customerId: id, orgId: auth.orgId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          invoiceNumber: true,
          title: true,
          status: true,
          total: true,
          paidAt: true,
          createdAt: true,
        },
      }),
    ]);

    // Convert to unified timeline activities
    const activities = [
      ...quotes.map((q) => ({
        id: `quote-${q.id}`,
        entityId: q.id,
        type: "quote" as const,
        title: `Quote ${q.quoteNumber} - ${q.status}`,
        description: q.title,
        amount: Number(q.total),
        date: (q.sentAt || q.createdAt).toISOString(),
        link: `/quotes/${q.id}`,
        status: q.status,
      })),
      ...workOrders.map((wo) => ({
        id: `wo-${wo.id}`,
        entityId: wo.id,
        type: "work_order" as const,
        title: `Work Order ${wo.workOrderNumber || wo.id.slice(0, 8)} - ${wo.status.replace("_", " ")}`,
        description: wo.title,
        amount: null as number | null,
        date: wo.createdAt.toISOString(),
        link: `/work-orders/${wo.id}`,
        status: wo.status,
      })),
      ...invoices.map((inv) => ({
        id: `invoice-${inv.id}`,
        entityId: inv.id,
        type: "invoice" as const,
        title: `Invoice ${inv.invoiceNumber} - ${inv.status}`,
        description: inv.title,
        amount: Number(inv.total),
        date: (inv.paidAt || inv.createdAt).toISOString(),
        link: `/invoices/${inv.id}`,
        status: inv.status,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ data: activities });
  } catch (error) {
    console.error("Error fetching customer activity:", error);
    return NextResponse.json(
      { error: "Failed to load activity" },
      { status: 500 }
    );
  }
}
