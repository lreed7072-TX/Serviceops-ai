import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const VALID_CATEGORIES = ["MANUAL", "SOP", "PRODUCT_DOC", "TRAINING", "OTHER"];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function buildStorageKey(
  orgId: string,
  kbFileId: string,
  fileId: string,
  filename: string
) {
  const safeName = filename.replace(/[^\w.\-() ]+/g, "_");
  return `org/${orgId}/kb/${kbFileId}/${fileId}/${safeName}`;
}

/**
 * POST /api/knowledge-base/upload
 * Two-step upload: creates KbFile + File records, returns signed upload URL.
 * Client then PUTs the file binary directly to the signed URL.
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { filename, mimeType, sizeBytes, title, category, tags } = json as {
      filename?: string;
      mimeType?: string;
      sizeBytes?: number;
      title?: string;
      category?: string;
      tags?: string;
    };

    if (!filename || !mimeType || !sizeBytes || !title) {
      return NextResponse.json(
        { error: "filename, mimeType, sizeBytes, and title are required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload PDF, Word, or images." },
        { status: 400 }
      );
    }

    if (sizeBytes > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category." },
        { status: 400 }
      );
    }

    // 1) Create KbFile record
    const kbFile = await prisma.kbFile.create({
      data: {
        orgId: auth.orgId,
        title,
        category: category || "OTHER",
        tags: tags || null,
        status: "ACTIVE",
      },
    });

    // 2) Create File record with PENDING storageKey
    const fileRow = await prisma.file.create({
      data: {
        orgId: auth.orgId,
        kbFileId: kbFile.id,
        filename,
        mimeType,
        storageKey: "PENDING",
        sizeBytes,
      },
    });

    // 3) Build storage key and update
    const storageKey = buildStorageKey(auth.orgId, kbFile.id, fileRow.id, filename);
    await prisma.file.update({
      where: { id: fileRow.id },
      data: { storageKey },
    });

    // 4) Get signed upload URL from Supabase Storage
    const bucket = process.env.SUPABASE_FILES_BUCKET ?? "org-files";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

    if (!supabaseUrl || !serviceKey) {
      // Cleanup on env failure
      await prisma.file.delete({ where: { id: fileRow.id } }).catch(() => null);
      await prisma.kbFile.delete({ where: { id: kbFile.id } }).catch(() => null);
      return NextResponse.json(
        { error: "Missing Supabase env vars." },
        { status: 500 }
      );
    }

    const signRes = await fetch(
      `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${storageKey}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 600 }),
      }
    );

    const signJson: Record<string, unknown> = await signRes.json().catch(() => ({}));
    if (!signRes.ok || !signJson?.url) {
      await prisma.file.delete({ where: { id: fileRow.id } }).catch(() => null);
      await prisma.kbFile.delete({ where: { id: kbFile.id } }).catch(() => null);
      return NextResponse.json(
        { error: "Failed to create upload URL." },
        { status: 500 }
      );
    }

    const signedUrl = `${supabaseUrl}/storage/v1${signJson.url}`;

    // 5) Update KbFile sourceUrl with the storage path for reference
    await prisma.kbFile.update({
      where: { id: kbFile.id },
      data: { sourceUrl: storageKey },
    });

    return NextResponse.json({
      data: {
        kbFileId: kbFile.id,
        fileId: fileRow.id,
        signedUrl,
        storageKey,
        bucket,
      },
    });
  } catch (err) {
    console.error("POST /api/knowledge-base/upload failed:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
