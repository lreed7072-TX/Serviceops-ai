import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// GET /api/analytics/quotes - Quote conversion and pipeline analytics
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get all quotes for period
    const quotes = await prisma.quote.findMany({
      where: {
        orgId: auth.orgId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        sentAt: true,
        approvedAt: true,
        rejectedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Status distribution
    const statusCounts = quotes.reduce((acc: any, quote) => {
      acc[quote.status] = (acc[quote.status] || 0) + 1;
      return acc;
    }, {});

    // Conversion metrics
    const sentQuotes = quotes.filter((q) => q.sentAt);
    const approvedQuotes = quotes.filter((q) => q.status === "APPROVED" || q.status === "CONVERTED");
    const rejectedQuotes = quotes.filter((q) => q.status === "REJECTED");
    
    const conversionRate = sentQuotes.length > 0 ? (approvedQuotes.length / sentQuotes.length) * 100 : 0;
    const rejectionRate = sentQuotes.length > 0 ? (rejectedQuotes.length / sentQuotes.length) * 100 : 0;

    // Average quote value
    const totalValue = quotes.reduce((sum, quote) => sum + quote.total.toNumber(), 0);
    const avgQuoteValue = quotes.length > 0 ? totalValue / quotes.length : 0;

    // Average time to decision (sent to approved/rejected)
    const decisionTimes = [...approvedQuotes, ...rejectedQuotes]
      .filter((q) => q.sentAt && (q.approvedAt || q.rejectedAt))
      .map((q) => {
        const decisionDate = q.approvedAt || q.rejectedAt;
        if (!decisionDate || !q.sentAt) return 0;
        return (new Date(decisionDate).getTime() - new Date(q.sentAt).getTime()) / (1000 * 60 * 60 * 24);
      });

    const avgTimeToDecision =
      decisionTimes.length > 0
        ? decisionTimes.reduce((sum, time) => sum + time, 0) / decisionTimes.length
        : 0;

    // Quote value by customer
    const customerQuoteValues = quotes.reduce((acc: any[], quote) => {
      const existing = acc.find((item) => item.customerId === quote.customer.id);
      const value = quote.total.toNumber();
      
      if (existing) {
        existing.totalValue += value;
        existing.count += 1;
        if (quote.status === "APPROVED" || quote.status === "CONVERTED") {
          existing.approvedValue += value;
          existing.approvedCount += 1;
        }
      } else {
        acc.push({
          customerId: quote.customer.id,
          customerName: quote.customer.name,
          totalValue: value,
          count: 1,
          approvedValue: quote.status === "APPROVED" || quote.status === "CONVERTED" ? value : 0,
          approvedCount: quote.status === "APPROVED" || quote.status === "CONVERTED" ? 1 : 0,
        });
      }
      return acc;
    }, []);

    customerQuoteValues.forEach((customer) => {
      customer.conversionRate = customer.count > 0 ? (customer.approvedCount / customer.count) * 100 : 0;
    });

    customerQuoteValues.sort((a, b) => b.totalValue - a.totalValue);

    // Monthly trend
    const monthlyQuotes = quotes.reduce((acc: any[], quote) => {
      const month = new Date(quote.createdAt).toISOString().slice(0, 7);
      const existing = acc.find((item) => item.month === month);
      const value = quote.total.toNumber();
      
      if (existing) {
        existing.count += 1;
        existing.totalValue += value;
        if (quote.status === "APPROVED" || quote.status === "CONVERTED") {
          existing.approvedCount += 1;
          existing.approvedValue += value;
        }
      } else {
        acc.push({
          month,
          count: 1,
          totalValue: value,
          approvedCount: quote.status === "APPROVED" || quote.status === "CONVERTED" ? 1 : 0,
          approvedValue: quote.status === "APPROVED" || quote.status === "CONVERTED" ? value : 0,
        });
      }
      return acc;
    }, []);

    monthlyQuotes.forEach((month) => {
      month.conversionRate = month.count > 0 ? (month.approvedCount / month.count) * 100 : 0;
    });

    monthlyQuotes.sort((a, b) => a.month.localeCompare(b.month));

    // Pipeline value (active quotes)
    const activeQuotes = quotes.filter((q) => q.status === "DRAFT" || q.status === "SENT");
    const pipelineValue = activeQuotes.reduce((sum, quote) => sum + quote.total.toNumber(), 0);

    return jsonResponse({
      data: {
        summary: {
          totalQuotes: quotes.length,
          sentQuotes: sentQuotes.length,
          approvedQuotes: approvedQuotes.length,
          rejectedQuotes: rejectedQuotes.length,
          conversionRate,
          rejectionRate,
          avgQuoteValue,
          avgTimeToDecisionDays: Math.round(avgTimeToDecision * 10) / 10,
          pipelineValue,
          activeQuotesCount: activeQuotes.length,
        },
        statusDistribution: statusCounts,
        topCustomers: customerQuoteValues.slice(0, 10),
        monthlyTrend: monthlyQuotes,
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/analytics/quotes error:", error);
    return jsonError("Failed to fetch quote analytics", 500);
  }
}
