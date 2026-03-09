import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

const VALID_CATEGORIES = [
  "labor_income",
  "materials_income",
  "service_income",
  "job_cost_expense",
  "subcontractor_expense",
] as const;

// GET /api/integrations/qbo/account-mapping
// Returns all saved account mappings for the org.
export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;

  const mappings = await prisma.qboAccountMap.findMany({
    where: { orgId },
    select: {
      category: true,
      qboAccountId: true,
      qboAccountName: true,
      qboAccountType: true,
    },
  });

  // Return as a record keyed by category for easy lookup
  const mappingMap: Record<string, {
    qboAccountId: string;
    qboAccountName: string;
    qboAccountType: string;
  }> = {};

  for (const m of mappings) {
    mappingMap[m.category] = {
      qboAccountId: m.qboAccountId,
      qboAccountName: m.qboAccountName,
      qboAccountType: m.qboAccountType,
    };
  }

  return NextResponse.json({ data: mappingMap });
}

// PUT /api/integrations/qbo/account-mapping
// Upsert a single account mapping for a category.
// Body: { category, qboAccountId, qboAccountName, qboAccountType }
export async function PUT(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId, role } = authResult.auth;

  // Only ADMINs can configure account mapping
  if (role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can configure account mapping" },
      { status: 403 }
    );
  }

  let body: {
    category: string;
    qboAccountId: string;
    qboAccountName: string;
    qboAccountType: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { category, qboAccountId, qboAccountName, qboAccountType } = body;

  // Validate category
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json(
      { error: `Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!qboAccountId || !qboAccountName || !qboAccountType) {
    return NextResponse.json(
      { error: "qboAccountId, qboAccountName, and qboAccountType are required" },
      { status: 400 }
    );
  }

  // Upsert using the @@unique([orgId, category]) constraint
  const mapping = await prisma.qboAccountMap.upsert({
    where: {
      orgId_category: { orgId, category },
    },
    create: {
      orgId,
      category,
      qboAccountId,
      qboAccountName,
      qboAccountType,
    },
    update: {
      qboAccountId,
      qboAccountName,
      qboAccountType,
    },
  });

  return NextResponse.json({
    data: {
      category: mapping.category,
      qboAccountId: mapping.qboAccountId,
      qboAccountName: mapping.qboAccountName,
      qboAccountType: mapping.qboAccountType,
    },
  });
}
