import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const querySchema = z.object({
  fileId: z.string().uuid(),
});

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ fileId: url.searchParams.get("fileId") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "fileId is required." }, { status: 400 });
  }

  const file = await prisma.file.findFirst({
    where: { id: parsed.data.fileId, orgId: auth.orgId },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const bucket = process.env.SUPABASE_FILES_BUCKET ?? "org-files";
  const supabase = createSupabaseAdminClient();

  // 10 minutes
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(file.storageKey, 600);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Failed to create download URL." }, { status: 500 });
  }

  return NextResponse.json({ data: { url: data.signedUrl } });
}
