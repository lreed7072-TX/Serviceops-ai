import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/search?q=query&types=workOrders,customers,assets,sites
 * Global search across multiple entities
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const query = req.nextUrl.searchParams.get("q") || "";
    const types = req.nextUrl.searchParams.get("types")?.split(",") || [
      "workOrders",
      "customers",
      "assets",
      "sites",
    ];

    if (!query || query.length < 2) {
      return NextResponse.json({
        data: { workOrders: [], customers: [], assets: [], sites: [] },
      });
    }

    const results: Record<string, unknown[]> = {};

    // Search Work Orders
    if (types.includes("workOrders")) {
      const workOrders = await prisma.workOrder.findMany({
        where: {
          orgId: auth.orgId,
          OR: [
            { workOrderNumber: { contains: query, mode: "insensitive" } },
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          workOrderNumber: true,
          title: true,
          status: true,
          priority: true,
          orderType: true,
          customer: { select: { name: true } },
          site: { select: { name: true } },
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      });

      results.workOrders = workOrders.map((wo) => ({
        id: wo.id,
        type: "work-order",
        title: `${wo.workOrderNumber} - ${wo.title}`,
        subtitle: `${wo.customer?.name || "No Customer"} • ${wo.site?.name || "No Site"}`,
        status: wo.status,
        priority: wo.priority,
        url: `/work-orders/${wo.id}`,
        badge: wo.orderType,
      }));
    }

    // Search Customers
    if (types.includes("customers")) {
      const customers = await prisma.customer.findMany({
        where: {
          orgId: auth.orgId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { primaryEmail: { contains: query, mode: "insensitive" } },
            { primaryPhone: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          primaryEmail: true,
          primaryPhone: true,
          _count: { select: { sites: true, workOrders: true } },
        },
        take: 10,
        orderBy: { name: "asc" },
      });

      results.customers = customers.map((c) => ({
        id: c.id,
        type: "customer",
        title: c.name,
        subtitle: `${c._count.sites} sites • ${c._count.workOrders} work orders`,
        contact: c.primaryEmail || c.primaryPhone || "",
        url: `/customers/${c.id}`,
      }));
    }

    // Search Assets
    if (types.includes("assets")) {
      const assets = await prisma.asset.findMany({
        where: {
          orgId: auth.orgId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { serialNumber: { contains: query, mode: "insensitive" } },
            { assetTag: { contains: query, mode: "insensitive" } },
            { manufacturer: { contains: query, mode: "insensitive" } },
            { model: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          serialNumber: true,
          assetCategory: true,
          manufacturer: true,
          model: true,
          site: { select: { name: true } },
          customer: { select: { name: true } },
        },
        take: 10,
        orderBy: { name: "asc" },
      });

      results.assets = assets.map((a) => ({
        id: a.id,
        type: "asset",
        title: a.name,
        subtitle: `${a.manufacturer || ""} ${a.model || ""}`.trim() || "Equipment",
        location: a.site?.name || "",
        serialNumber: a.serialNumber || "",
        url: `/assets/${a.id}`,
        badge: a.assetCategory,
      }));
    }

    // Search Sites
    if (types.includes("sites")) {
      const sites = await prisma.site.findMany({
        where: {
          orgId: auth.orgId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { address: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          state: true,
          customer: { select: { name: true } },
          _count: { select: { assets: true, workOrders: true } },
        },
        take: 10,
        orderBy: { name: "asc" },
      });

      results.sites = sites.map((s) => ({
        id: s.id,
        type: "site",
        title: s.name,
        subtitle: [s.city, s.state].filter(Boolean).join(", "),
        customer: s.customer?.name || "",
        counts: `${s._count.assets} assets • ${s._count.workOrders} work orders`,
        url: `/sites/${s.id}`,
      }));
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
