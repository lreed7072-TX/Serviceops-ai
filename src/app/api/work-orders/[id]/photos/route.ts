import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

const PHOTO_TYPES = [
  "BEFORE_WORK", "AFTER_WORK", "NAMEPLATE", "DAMAGE", "SAFETY_HAZARD",
  "MEASUREMENT", "PARTS", "INSTALLATION", "WIRING", "CORROSION",
  "LEAK", "ALIGNMENT", "GENERAL",
] as const;

const postSchema = z.object({
  fileId: z.string().uuid(),
  storageKey: z.string().min(1),
  photoType: z.enum(PHOTO_TYPES).default("GENERAL"),
  caption: z.string().max(500).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  isCustomerVisible: z.boolean().optional().default(false),
});

/**
 * GET /api/work-orders/[id]/photos
 * List all photos for a work order, with download URLs.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const photos = await prisma.workOrderPhoto.findMany({
    where: { orgId: auth.orgId, workOrderId },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { name: true, email: true } },
    },
  });

  // Generate download URLs for each photo
  const bucket = process.env.SUPABASE_FILES_BUCKET ?? "org-files";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      let url: string | null = null;
      if (supabaseUrl && serviceKey) {
        try {
          const signRes = await fetch(
            `${supabaseUrl}/storage/v1/object/sign/${bucket}/${photo.storageKey}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                apikey: serviceKey,
                "content-type": "application/json",
              },
              body: JSON.stringify({ expiresIn: 3600 }),
            }
          );
          const signJson: any = await signRes.json().catch(() => ({}));
          if (signRes.ok && signJson?.signedURL) {
            url = `${supabaseUrl}/storage/v1${signJson.signedURL}`;
          }
        } catch {
          // URL generation failed, leave null
        }
      }
      return {
        id: photo.id,
        photoType: photo.photoType,
        fileId: photo.fileId,
        caption: photo.caption,
        latitude: photo.latitude,
        longitude: photo.longitude,
        isCustomerVisible: photo.isCustomerVisible,
        uploadedBy: photo.uploadedBy,
        createdAt: photo.createdAt.toISOString(),
        url,
      };
    })
  );

  return NextResponse.json({ data: photosWithUrls });
}

/**
 * POST /api/work-orders/[id]/photos
 * Create a photo record (after file has been uploaded via /api/files/upload).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const json = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify work order belongs to org
  const wo = await prisma.workOrder.findFirst({
    where: { id: workOrderId, orgId: auth.orgId },
    select: { id: true },
  });
  if (!wo) {
    return NextResponse.json({ error: "Work order not found." }, { status: 404 });
  }

  const photo = await prisma.workOrderPhoto.create({
    data: {
      orgId: auth.orgId,
      workOrderId,
      photoType: parsed.data.photoType as any,
      fileId: parsed.data.fileId,
      storageKey: parsed.data.storageKey,
      caption: parsed.data.caption ?? null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      isCustomerVisible: parsed.data.isCustomerVisible,
      uploadedByUserId: auth.userId,
    },
  });

  return NextResponse.json({ data: photo }, { status: 201 });
}
