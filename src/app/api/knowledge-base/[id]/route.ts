import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/knowledge-base/[id]
 * Get a single KB file with details.
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;
    const { id } = await params;

    const kbFile = await prisma.kbFile.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        files: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            storageKey: true,
          },
        },
        chunks: {
          select: {
            id: true,
            content: true,
            tokenCount: true,
          },
        },
      },
    });

    if (!kbFile) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    return NextResponse.json({ data: kbFile });
  } catch (error) {
    console.error("GET /api/knowledge-base/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to load document." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/knowledge-base/[id]
 * Delete a KB file, its chunks, associated File records, and storage objects.
 */
export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;
    const { id } = await params;

    const kbFile = await prisma.kbFile.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        files: {
          select: { id: true, storageKey: true },
        },
      },
    });

    if (!kbFile) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    // 1) Delete all chunks
    await prisma.kbChunk.deleteMany({
      where: { kbFileId: id },
    });

    // 2) Delete from Supabase Storage (best-effort)
    const bucket = process.env.SUPABASE_FILES_BUCKET ?? "org-files";
    try {
      const supabase = createSupabaseAdminClient();
      const storageKeys = kbFile.files
        .map((f) => f.storageKey)
        .filter((k) => k && k !== "PENDING");

      if (storageKeys.length > 0) {
        await supabase.storage.from(bucket).remove(storageKeys);
      }
    } catch (storageErr) {
      console.warn("Failed to delete from storage:", storageErr);
    }

    // 3) Delete File records
    await prisma.file.deleteMany({
      where: { kbFileId: id },
    });

    // 4) Delete KbFile
    await prisma.kbFile.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Document deleted successfully." });
  } catch (error) {
    console.error("DELETE /api/knowledge-base/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete document." },
      { status: 500 }
    );
  }
}
