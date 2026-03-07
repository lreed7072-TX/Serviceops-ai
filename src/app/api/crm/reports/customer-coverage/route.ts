import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

// GET /api/crm/reports/customer-coverage — customer coverage report
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
  if (roleError) return roleError;

  const { searchParams } = new URL(request.url);
  const now = new Date();

  // Default to current month if not provided
  const startDate = searchParams.get("startDate")
    ? new Date(searchParams.get("startDate")!)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = searchParams.get("endDate")
    ? new Date(searchParams.get("endDate")!)
    : now;
  const userIdParam = searchParams.get("userId");

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return jsonError("Invalid date format. Use ISO date strings.");
  }

  // SALES sees own only; ADMIN can filter by userId
  const isSales = auth.role === Role.SALES;
  const effectiveUserId = isSales ? auth.userId : userIdParam ?? undefined;

  // Build call log filter
  const callWhere: any = {
    orgId: auth.orgId,
    callTimestamp: { gte: startDate, lte: endDate },
  };
  if (effectiveUserId) callWhere.userId = effectiveUserId;

  // Total customers in org
  const totalCustomers = await prisma.customer.count({
    where: { orgId: auth.orgId },
  });

  // Get call logs in range to compute contacted customers
  const callLogs = await prisma.callLog.findMany({
    where: callWhere,
    select: { customerId: true },
  });

  const contactedCustomerIds = new Set(callLogs.map((c) => c.customerId));
  const contactedCustomers = contactedCustomerIds.size;
  const totalCalls = callLogs.length;

  const coveragePercent =
    totalCustomers > 0
      ? Math.round((contactedCustomers / totalCustomers) * 1000) / 10
      : 0;

  const avgCallsPerCustomer =
    contactedCustomers > 0
      ? Math.round((totalCalls / contactedCustomers) * 10) / 10
      : 0;

  // By-tier breakdown: get all customers with tier, cross-reference with contacted set
  const customers = await prisma.customer.findMany({
    where: { orgId: auth.orgId },
    select: { id: true, tier: true },
  });

  const tierMap = new Map<string, { total: number; contacted: number }>();
  for (const cust of customers) {
    const tier = cust.tier ?? "UNASSIGNED";
    if (!tierMap.has(tier)) tierMap.set(tier, { total: 0, contacted: 0 });
    const entry = tierMap.get(tier)!;
    entry.total += 1;
    if (contactedCustomerIds.has(cust.id)) entry.contacted += 1;
  }

  const byTier = Array.from(tierMap.entries())
    .map(([tier, data]) => ({
      tier,
      total: data.total,
      contacted: data.contacted,
      coveragePercent:
        data.total > 0
          ? Math.round((data.contacted / data.total) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => {
      // Sort: A, B, C, then UNASSIGNED
      const order: Record<string, number> = { A: 0, B: 1, C: 2, UNASSIGNED: 3 };
      return (order[a.tier] ?? 99) - (order[b.tier] ?? 99);
    });

  return NextResponse.json({
    data: {
      totalCustomers,
      contactedCustomers,
      coveragePercent,
      avgCallsPerCustomer,
      totalCalls,
      byTier,
    },
  });
}
