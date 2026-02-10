import { NextRequest, NextResponse } from "next/server";
import { getAuthContextFromSupabase } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// POST - Upload free camera photo to tech library
export async function POST(request: NextRequest) {
  const auth = await getAuthContextFromSupabase();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const photoType = formData.get("photoType") as string;
    const caption = formData.get("caption") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Get GPS coordinates if available
    let gpsLatitude: number | null = null;
    let gpsLongitude: number | null = null;
    
    const latStr = formData.get("gpsLatitude") as string;
    const lngStr = formData.get("gpsLongitude") as string;
    
    if (latStr) gpsLatitude = parseFloat(latStr);
    if (lngStr) gpsLongitude = parseFloat(lngStr);

    // Upload to Supabase Storage
    const supabase = await createSupabaseServerClient();
    const fileExt = file.name.split('.').pop();
    const fileName = `tech-photos/${auth.userId}/${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('work-order-photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('work-order-photos')
      .getPublicUrl(fileName);

    // Save to database
    const photo = await prisma.techPhoto.create({
      data: {
        orgId: auth.orgId,
        userId: auth.userId,
        photoType: photoType as any,
        caption: caption || null,
        fileName: file.name,
        fileUrl: publicUrl,
        fileSize: file.size,
        mimeType: file.type,
        gpsLatitude,
        gpsLongitude,
      },
    });

    return NextResponse.json({ photo });
  } catch (error) {
    console.error("Free camera upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 }
    );
  }
}

// GET - List tech's free camera photos
export async function GET(request: NextRequest) {
  const auth = await getAuthContextFromSupabase();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const photoType = searchParams.get("photoType");
  const unattachedOnly = searchParams.get("unattached") === "true";

  try {
    const where: any = {
      orgId: auth.orgId,
      userId: auth.userId,
    };

    if (photoType) where.photoType = photoType;
    if (unattachedOnly) where.workOrderId = null;

    const photos = await prisma.techPhoto.findMany({
      where,
      orderBy: {
        capturedAt: "desc",
      },
      take: 100,
    });

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Failed to fetch tech photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
