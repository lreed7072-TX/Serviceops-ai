import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { queryEntities } from "@/lib/qbo/qbo-client";
import type { QboAccount } from "@/lib/qbo/qbo-types";

// GET /api/integrations/qbo/accounts
// Fetches active accounts from QBO for the connected org.
// Used by the account mapping UI to populate dropdowns.
export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;

  // Get active QBO connection
  const connection = await prisma.qboConnection.findFirst({
    where: { orgId, isActive: true },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "No active QBO connection" },
      { status: 400 }
    );
  }

  try {
    // Fetch all active accounts from QBO (Income, Expense, COGS)
    // Typical company has <300 accounts, so no pagination needed
    const accounts = await queryEntities<QboAccount>(
      connection,
      "SELECT * FROM Account WHERE Active = true MAXRESULTS 1000",
      "Account"
    );

    return NextResponse.json({ data: accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
