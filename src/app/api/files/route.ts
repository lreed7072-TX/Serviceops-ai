import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";

const querySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
});

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  try {
    const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    entityType: url.searchParams.get("entityType") ?? "",
    entityId: url.searchParams.get("entityId") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "entityType and entityId are required." }, { status: 400 });
  }

  const { entityType, entityId } = parsed.data;

  const links = await prisma.fileLink.findMany({
    where: { orgId: auth.orgId, entityType, entityId },
    include: { file: true },
    orderBy: { createdAt: "desc" },
  });

  const data = links.map((l) => ({
    id: l.id,
    label: l.label,
    createdAt: l.createdAt,
    file: {
      id: l.file.id,
      filename: l.file.filename,
      mimeType: l.file.mimeType,
      storageKey: l.file.storageKey,
      sizeBytes: l.file.sizeBytes,
      createdAt: l.file.createdAt,
    },
  }));

  return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/files failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      process.env.NODE_ENV === "production"
        ? { error: "Internal server error." }
        : { error: "Internal server error.", detail },
      { status: 500 }
    );
  }
}
