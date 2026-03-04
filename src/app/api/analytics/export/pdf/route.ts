import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import {
  generateAnalyticsReportPdf,
  type AnalyticsData,
} from "@/lib/pdf/pdf-generator";

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// POST /api/analytics/export/pdf
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;
    const { orgId } = auth;

    const body = await request.json();
    const { reportType, dateRange } = body as {
      reportType: "revenue" | "work-orders" | "materials" | "quotes";
      dateRange: { from: string; to: string };
    };

    if (!reportType || !dateRange?.from || !dateRange?.to) {
      return jsonError(
        "reportType and dateRange (from, to) are required"
      );
    }

    const validTypes = ["revenue", "work-orders", "materials", "quotes"];
    if (!validTypes.includes(reportType)) {
      return jsonError(
        "Invalid reportType. Must be: revenue, work-orders, materials, or quotes"
      );
    }

    const start = new Date(dateRange.from);
    const end = new Date(dateRange.to);

    // Fetch org name
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    const analyticsData: AnalyticsData = {
      reportType,
      dateRange: { from: dateRange.from, to: dateRange.to },
      orgName: org?.name || "Company",
    };

    switch (reportType) {
      case "revenue": {
        const invoices = await prisma.invoice.findMany({
          where: {
            orgId,
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

        const totalRevenue = invoices.reduce(
          (sum, inv) => sum + Number(inv.total),
          0
        );
        const totalPaid = invoices
          .filter((inv) => inv.status === "PAID")
          .reduce((sum, inv) => sum + Number(inv.total), 0);

        analyticsData.revenue = {
          rows: invoices.map((inv) => ({
            invoiceNumber: inv.invoiceNumber,
            date: inv.createdAt.toISOString(),
            customer: inv.customer?.name || "N/A",
            status: inv.status,
            subtotal: Number(inv.subtotal),
            tax: Number(inv.tax),
            total: Number(inv.total),
            paidDate: inv.paidAt?.toISOString() || null,
          })),
          totalRevenue,
          totalPaid,
          totalOutstanding: totalRevenue - totalPaid,
          invoiceCount: invoices.length,
        };
        break;
      }

      case "work-orders": {
        const workOrders = await prisma.workOrder.findMany({
          where: {
            orgId,
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

        analyticsData.workOrders = {
          rows: workOrders.map((wo) => ({
            workOrderNumber: wo.workOrderNumber || "",
            date: wo.createdAt.toISOString(),
            customer: wo.customer?.name || "N/A",
            site: wo.site?.name || "N/A",
            title: wo.title,
            status: wo.status,
            orderType: wo.orderType,
          })),
          totalCount: workOrders.length,
          completedCount: workOrders.filter((wo) => wo.status === "COMPLETED")
            .length,
          openCount: workOrders.filter(
            (wo) => wo.status === "OPEN" || wo.status === "IN_PROGRESS"
          ).length,
        };
        break;
      }

      case "materials": {
        const usages = await prisma.taskMaterialUsage.findMany({
          where: {
            orgId,
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

        analyticsData.materials = {
          rows: usages.map((usage) => ({
            date: usage.createdAt.toISOString(),
            name: usage.name,
            partNumber: usage.partNumber || "",
            category: usage.material?.category || "OTHER",
            quantity: Number(usage.quantity),
            unitCost: Number(usage.unitCost || 0),
            totalCost: Number(usage.totalCost || 0),
          })),
          totalCost: usages.reduce(
            (sum, u) => sum + Number(u.totalCost || 0),
            0
          ),
          totalItems: usages.length,
        };
        break;
      }

      case "quotes": {
        const quotes = await prisma.quote.findMany({
          where: {
            orgId,
            createdAt: { gte: start, lte: end },
          },
          select: {
            quoteNumber: true,
            createdAt: true,
            status: true,
            customer: { select: { name: true } },
            total: true,
            validUntil: true,
            sentAt: true,
            approvedAt: true,
          },
          orderBy: { createdAt: "desc" },
        });

        const approvedCount = quotes.filter(
          (q) => q.status === "APPROVED" || q.status === "CONVERTED"
        ).length;

        analyticsData.quotes = {
          rows: quotes.map((q) => ({
            quoteNumber: q.quoteNumber,
            date: q.createdAt.toISOString(),
            customer: q.customer?.name || "N/A",
            status: q.status,
            total: Number(q.total),
            sentDate: q.sentAt?.toISOString() || null,
            approvedDate: q.approvedAt?.toISOString() || null,
            validUntil: q.validUntil?.toISOString() || null,
          })),
          totalValue: quotes.reduce((sum, q) => sum + Number(q.total), 0),
          approvedCount,
          pendingCount: quotes.filter(
            (q) => q.status === "SENT" || q.status === "DRAFT"
          ).length,
          conversionRate:
            quotes.length > 0 ? (approvedCount / quotes.length) * 100 : 0,
        };
        break;
      }
    }

    const pdfBuffer = await generateAnalyticsReportPdf(analyticsData);

    const reportNames: Record<string, string> = {
      revenue: "Revenue",
      "work-orders": "WorkOrders",
      materials: "Materials",
      quotes: "Quotes",
    };

    const filename = `${reportNames[reportType]}-Report-${dateRange.from}-to-${dateRange.to}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer) as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("POST /api/analytics/export/pdf error:", error);
    return jsonError("Failed to generate analytics PDF", 500);
  }
}
