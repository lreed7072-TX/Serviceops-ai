import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

/**
 * GET /api/knowledge-base
 * List KB files with optional search and category filter.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";

    const where: Record<string, unknown> = {
      orgId: auth.orgId,
      status: "ACTIVE",
    };

    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    if (category) {
      where.category = category;
    }

    const files = await prisma.kbFile.findMany({
      where,
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
        _count: {
          select: { chunks: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: files });
  } catch (error) {
    console.error("GET /api/knowledge-base error:", error);
    return NextResponse.json(
      { error: "Failed to load knowledge base." },
      { status: 500 }
    );
  }
}
