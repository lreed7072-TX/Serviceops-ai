import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/organization
 * Get organization details
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const organization = await prisma.org.findUnique({
      where: { id: auth.orgId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: organization });
  } catch (error) {
    console.error("Get organization error:", error);
    return NextResponse.json(
      { error: "Failed to load organization" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organization
 * Update organization settings
 */
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleCheck = requireRole(auth, ["ADMIN"]);
    if (roleCheck) return roleCheck;

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    // Company info
    if (body.name !== undefined) updateData.name = body.name;
    if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail;
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.state !== undefined) updateData.state = body.state;
    if (body.zipCode !== undefined) updateData.zipCode = body.zipCode;
    if (body.country !== undefined) updateData.country = body.country;
    if (body.website !== undefined) updateData.website = body.website;
    if (body.taxId !== undefined) updateData.taxId = body.taxId;

    // Preferences
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;

    // Email settings
    if (body.emailFromName !== undefined) updateData.emailFromName = body.emailFromName;
    if (body.emailFromAddress !== undefined) updateData.emailFromAddress = body.emailFromAddress;
    if (body.emailReplyTo !== undefined) updateData.emailReplyTo = body.emailReplyTo;

    const updated = await prisma.org.update({
      where: { id: auth.orgId },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Update organization error:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}
