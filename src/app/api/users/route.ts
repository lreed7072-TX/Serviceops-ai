import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // Best-effort: ensure the current signed-in user exists in our app User table.
  // This avoids "empty tech dropdown" in dev/prod without manual SQL.
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();

    const email = data?.user?.email ?? null;
    const meta = (data?.user?.user_metadata ?? {}) as any;
    const name = (meta.full_name ?? meta.name ?? null) as string | null;

    if (email) {
      await prisma.user.upsert({
        where: { orgId_email: { orgId: auth.orgId, email } },
        update: {
          name: name ?? undefined,
          role: auth.role,
        },
        create: {
          id: auth.userId,
          orgId: auth.orgId,
          email,
          name: name ?? null,
          role: auth.role,
        },
      });
    }
  } catch (err) {
    console.error("GET /api/users sync failed:", err);
    // continue; still return whatever users exist
  }

  const users = await prisma.user.findMany({
    where: { orgId: auth.orgId },
    select: { id: true, email: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
  });

  return NextResponse.json({ data: users });
}
