import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { VisitStatus } from "@prisma/client";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const visit = await prisma.visit.findFirst({
    where: { id, orgId: authResult.auth.orgId },
    include: {
      findings: true,
      measures: true,
    },
  });

  if (!visit) {
    return jsonError("Visit not found.", 404);
  }

  const missingFields: string[] = [];

  if (visit.status !== VisitStatus.COMPLETED) {
    missingFields.push("status");
  }
  if (!visit.completedAt) {
    missingFields.push("completedAt");
  }
  if (!visit.summary || visit.summary.trim().length === 0) {
    missingFields.push("summary");
  }
  if (!visit.outcome || visit.outcome.trim().length === 0) {
    missingFields.push("outcome");
  }
  if (visit.findings.length === 0) {
    missingFields.push("findings");
  }
  if (visit.measures.length === 0) {
    missingFields.push("measurements");
  }

  return NextResponse.json({
    data: {
      visitId: visit.id,
      missingFields,
    },
  });
}
