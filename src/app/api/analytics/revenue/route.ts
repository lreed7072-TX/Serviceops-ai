import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// GET /api/analytics/revenue - Revenue analytics and trends
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Default to last 30 days if not specified
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Calculate previous period for comparison
    const periodLength = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodLength);
    const previousEnd = new Date(start);

    // Get invoices for current period
    const currentInvoices = await prisma.invoice.findMany({
      where: {
        orgId: auth.orgId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        total: true,
        subtotal: true,
        tax: true,
        status: true,
        createdAt: true,
        paidAt: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        lineItems: {
          select: {
            itemType: true,
            totalPrice: true,
          },
        },
      },
    });

    // Get invoices for previous period
    const previousInvoices = await prisma.invoice.findMany({
      where: {
        orgId: auth.orgId,
        createdAt: {
          gte: previousStart,
          lt: previousEnd,
        },
      },
      select: {
        total: true,
        status: true,
      },
    });

    // Calculate current period metrics
    const currentTotal = currentInvoices.reduce((sum, inv) => sum + inv.total.toNumber(), 0);
    const currentPaid = currentInvoices
      .filter((inv) => inv.status === "PAID")
      .reduce((sum, inv) => sum + inv.total.toNumber(), 0);
    const currentOutstanding = currentInvoices
      .filter((inv) => inv.status === "SENT" || inv.status === "OVERDUE")
      .reduce((sum, inv) => sum + inv.total.toNumber(), 0);

    // Calculate previous period metrics
    const previousTotal = previousInvoices.reduce((sum, inv) => sum + inv.total.toNumber(), 0);
    const previousPaid = previousInvoices
      .filter((inv) => inv.status === "PAID")
      .reduce((sum, inv) => sum + inv.total.toNumber(), 0);

    // Calculate percentage changes
    const totalChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
    const paidChange = previousPaid > 0 ? ((currentPaid - previousPaid) / previousPaid) * 100 : 0;

    // Revenue by customer
    const revenueByCustomer = currentInvoices.reduce((acc: any[], invoice) => {
      const existing = acc.find((item) => item.customerId === invoice.customer.id);
      const amount = invoice.total.toNumber();
      
      if (existing) {
        existing.revenue += amount;
        existing.invoiceCount += 1;
      } else {
        acc.push({
          customerId: invoice.customer.id,
          customerName: invoice.customer.name,
          revenue: amount,
          invoiceCount: 1,
        });
      }
      return acc;
    }, []);

    // Sort by revenue descending
    revenueByCustomer.sort((a, b) => b.revenue - a.revenue);

    // Labor vs Material breakdown
    let laborRevenue = 0;
    let materialRevenue = 0;
    let otherRevenue = 0;

    currentInvoices.forEach((invoice) => {
      invoice.lineItems.forEach((item) => {
        const amount = item.totalPrice.toNumber();
        if (item.itemType === "LABOR") {
          laborRevenue += amount;
        } else if (item.itemType === "MATERIAL" || item.itemType === "PART") {
          materialRevenue += amount;
        } else {
          otherRevenue += amount;
        }
      });
    });

    // Monthly revenue trend (group by month)
    const monthlyRevenue = currentInvoices.reduce((acc: any[], invoice) => {
      const month = new Date(invoice.createdAt).toISOString().slice(0, 7); // YYYY-MM
      const existing = acc.find((item) => item.month === month);
      const amount = invoice.total.toNumber();
      
      if (existing) {
        existing.revenue += amount;
        existing.invoiceCount += 1;
      } else {
        acc.push({
          month,
          revenue: amount,
          invoiceCount: 1,
        });
      }
      return acc;
    }, []);

    monthlyRevenue.sort((a, b) => a.month.localeCompare(b.month));

    // Collection metrics
    const averageDaysToPayment = currentInvoices
      .filter((inv) => inv.paidAt)
      .reduce((sum, inv) => {
        const daysToPay = Math.floor(
          (new Date(inv.paidAt!).getTime() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        return sum + daysToPay;
      }, 0);

    const paidInvoiceCount = currentInvoices.filter((inv) => inv.paidAt).length;
    const avgDaysToPayment = paidInvoiceCount > 0 ? Math.round(averageDaysToPayment / paidInvoiceCount) : 0;

    return jsonResponse({
      data: {
        summary: {
          totalRevenue: currentTotal,
          paidRevenue: currentPaid,
          outstandingRevenue: currentOutstanding,
          invoiceCount: currentInvoices.length,
          totalChange,
          paidChange,
        },
        breakdown: {
          laborRevenue,
          materialRevenue,
          otherRevenue,
          laborPercentage: currentTotal > 0 ? (laborRevenue / currentTotal) * 100 : 0,
          materialPercentage: currentTotal > 0 ? (materialRevenue / currentTotal) * 100 : 0,
        },
        topCustomers: revenueByCustomer.slice(0, 10),
        monthlyTrend: monthlyRevenue,
        collections: {
          averageDaysToPayment: avgDaysToPayment,
          paidInvoices: paidInvoiceCount,
          unpaidInvoices: currentInvoices.length - paidInvoiceCount,
        },
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/analytics/revenue error:", error);
    return jsonError("Failed to fetch revenue analytics", 500);
  }
}
