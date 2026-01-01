import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ linkId: string }> };

export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const { linkId } = await params;

  const link = await prisma.fileLink.findFirst({
    where: { id: linkId, orgId: auth.orgId },
    include: { file: true },
  });

  if (!link) {
    return NextResponse.json({ error: "File link not found." }, { status: 404 });
  }

  // 1) Remove the link
  await prisma.fileLink.delete({ where: { id: link.id } });

  // 2) If no other links reference this file, delete the file record + storage object
  const remaining = await prisma.fileLink.count({
    where: { orgId: auth.orgId, fileId: link.fileId },
  });

  if (remaining === 0) {
    const bucket = process.env.SUPABASE_FILES_BUCKET ?? "org-files";
    const storageKey = link.file.storageKey;

    // Best-effort: delete object from storage
    try {
      const supabase = createSupabaseAdminClient();
      await supabase.storage.from(bucket).remove([storageKey]);
    } catch (err) {
      console.error("DELETE /api/files/[linkId] storage remove failed:", err);
      // continue; still delete DB row
    }

    await prisma.file.delete({ where: { id: link.fileId } }).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
