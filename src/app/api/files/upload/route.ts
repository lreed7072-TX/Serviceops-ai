import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  label: z.string().max(120).optional().nullable(),
});

function buildStorageKey(
  orgId: string,
  entityType: string,
  entityId: string,
  fileId: string,
  filename: string
) {
  const safeName = filename.replace(/[^\w.\-() ]+/g, "_");
  return `org/${orgId}/${entityType}/${entityId}/${fileId}/${safeName}`;
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
    }

    const { entityType, entityId, filename, mimeType, sizeBytes, label } = parsed.data;

    // 1) Create File row first
    const fileRow = await prisma.file.create({
      data: {
        orgId: auth.orgId,
        filename,
        mimeType,
        storageKey: "PENDING",
        sizeBytes,
      },
    });

    const storageKey = buildStorageKey(auth.orgId, entityType, entityId, fileRow.id, filename);

    // 2) Update storageKey
    await prisma.file.update({
      where: { id: fileRow.id },
      data: { storageKey },
    });

    // 3) Create FileLink
    const link = await prisma.fileLink.create({
      data: {
        orgId: auth.orgId,
        fileId: fileRow.id,
        entityType,
        entityId,
        label: label ?? null,
      },
    });

    // 4) Create signed upload URL via Storage REST sign endpoint
    const bucket = process.env.SUPABASE_FILES_BUCKET ?? "org-files";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
    const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

    if (!supabaseUrl || !serviceKey || !anonKey) {
      await prisma.fileLink.delete({ where: { id: link.id } }).catch(() => null);
      await prisma.file.delete({ where: { id: fileRow.id } }).catch(() => null);
      return NextResponse.json({ error: "Missing Supabase env vars." }, { status: 500 });
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

    const signJson: any = await signRes.json().catch(() => ({}));
    if (!signRes.ok || !signJson?.url) {
      await prisma.fileLink.delete({ where: { id: link.id } }).catch(() => null);
      await prisma.file.delete({ where: { id: fileRow.id } }).catch(() => null);

      const detail = signJson?.message ?? signJson?.error ?? JSON.stringify(signJson);
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Failed to create upload URL." }
          : { error: "Failed to create upload URL.", detail, bucket, storageKey },
        { status: 500 }
      );
    }

    const signedUrl = `${supabaseUrl}/storage/v1${signJson.url}`;

    return NextResponse.json({
      data: {
        linkId: link.id,
        fileId: fileRow.id,
        bucket,
        storageKey,
        signedUrl,
        token: signJson.token,
      },
    });
  } catch (err) {
    console.error("POST /api/files/upload failed:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
