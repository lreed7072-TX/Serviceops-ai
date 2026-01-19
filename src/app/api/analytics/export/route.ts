import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// GET /api/analytics/export - Export analytics data as CSV
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // revenue, work-orders, materials, quotes
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!type) {
      return jsonError("Export type required (revenue, work-orders, materials, quotes)");
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let csvContent = "";
    let filename = "";

    switch (type) {
      case "revenue": {
        const invoices = await prisma.invoice.findMany({
          where: {
            orgId: auth.orgId,
            createdAt: { gte: start, lte: end },
          },
          select: {
            invoiceNumber: true,
            createdAt: true,
            status: true,
            customer: { select: { name: true } },
            subtotal: true,
            tax: true,
            total: true,
            paidAt: true,
          },
          orderBy: { createdAt: "desc" },
        });

        csvContent = "Invoice Number,Date,Customer,Status,Subtotal,Tax,Total,Paid Date\n";
        invoices.forEach((inv) => {
          csvContent += `"${inv.invoiceNumber}","${inv.createdAt.toISOString().split("T")[0]}","${inv.customer.name}","${inv.status}",${inv.subtotal},${inv.tax},${inv.total},"${inv.paidAt?.toISOString().split("T")[0] || ""}"\n`;
        });
        filename = `revenue-export-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.csv`;
        break;
      }

      case "work-orders": {
        const workOrders = await prisma.workOrder.findMany({
          where: {
            orgId: auth.orgId,
            createdAt: { gte: start, lte: end },
          },
          select: {
            workOrderNumber: true,
            createdAt: true,
            status: true,
            orderType: true,
            customer: { select: { name: true } },
            site: { select: { name: true } },
            title: true,
          },
          orderBy: { createdAt: "desc" },
        });

        csvContent = "WO Number,Date,Customer,Site,Title,Status,Type\n";
        workOrders.forEach((wo) => {
          csvContent += `"${wo.workOrderNumber || ""}","${wo.createdAt.toISOString().split("T")[0]}","${wo.customer.name}","${wo.site.name}","${wo.title}","${wo.status}","${wo.orderType}"\n`;
        });
        filename = `work-orders-export-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.csv`;
        break;
      }

      case "materials": {
        const usages = await prisma.taskMaterialUsage.findMany({
          where: {
            orgId: auth.orgId,
            createdAt: { gte: start, lte: end },
          },
          select: {
            createdAt: true,
            name: true,
            partNumber: true,
            quantity: true,
            unitCost: true,
            totalCost: true,
            material: { select: { category: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        csvContent = "Date,Material,Part Number,Category,Quantity,Unit Cost,Total Cost\n";
        usages.forEach((usage) => {
          csvContent += `"${usage.createdAt.toISOString().split("T")[0]}","${usage.name}","${usage.partNumber || ""}","${usage.material?.category || "OTHER"}",${usage.quantity},${usage.unitCost || 0},${usage.totalCost || 0}\n`;
        });
        filename = `materials-export-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.csv`;
        break;
      }

      case "quotes": {
        const quotes = await prisma.quote.findMany({
          where: {
            orgId: auth.orgId,
            createdAt: { gte: start, lte: end },
          },
          select: {
            quoteNumber: true,
            createdAt: true,
            status: true,
            customer: { select: { name: true } },
            total: true,
            expiresAt: true,
            sentAt: true,
            approvedAt: true,
          },
          orderBy: { createdAt: "desc" },
        });

        csvContent = "Quote Number,Date,Customer,Status,Total,Sent Date,Approved Date,Expires\n";
        quotes.forEach((quote) => {
          csvContent += `"${quote.quoteNumber}","${quote.createdAt.toISOString().split("T")[0]}","${quote.customer.name}","${quote.status}",${quote.total},"${quote.sentAt?.toISOString().split("T")[0] || ""}","${quote.approvedAt?.toISOString().split("T")[0] || ""}","${quote.expiresAt?.toISOString().split("T")[0] || ""}"\n`;
        });
        filename = `quotes-export-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.csv`;
        break;
      }

      default:
        return jsonError("Invalid export type");
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/analytics/export error:", error);
    return jsonError("Failed to export analytics", 500);
  }
}
