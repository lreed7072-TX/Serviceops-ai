import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, AITaskPlanStatus } from "@prisma/client";
import { generateTasksWithClaude, DEFAULT_MODEL, type AITaskGenerationRequest } from "@/lib/ai/anthropic";

// POST /api/work-orders/[id]/ai-generate - Generate AI task plan for work order
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId, userId } = auth;

  // Only admins and dispatchers can generate AI plans
  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  try {
    // Fetch work order with related data
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, orgId },
      include: {
        customer: { select: { name: true } },
        site: { select: { name: true } },
        asset: {
          select: {
            name: true,
            assetCategory: true,
            assetFamily: true,
            assetSubFamily: true,
            manufacturer: true,
            model: true,
          },
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json({ error: "Work order not found" }, { status: 404 });
    }

    // Parse request body for additional context
    const body = await req.json();
    const { userInstructions, procedureTemplateId } = body;

    // Fetch procedure template if provided
    let procedureContext = undefined;
    if (procedureTemplateId) {
      const template = await prisma.procedureTemplate.findFirst({
        where: { id: procedureTemplateId, orgId },
        include: {
          standardsPack: { select: { name: true } },
        },
      });
      if (template) {
        procedureContext = {
          templateName: template.name,
          templateDescription: template.description || undefined,
          standardsPackName: template.standardsPack?.name,
        };
      }
    }

    // Build AI generation request
    const aiRequest: AITaskGenerationRequest = {
      workOrderContext: {
        title: workOrder.title,
        description: workOrder.description || undefined,
        orderType: workOrder.orderType,
        assetInfo: workOrder.asset
          ? {
              name: workOrder.asset.name,
              category: workOrder.asset.assetCategory || undefined,
              family: workOrder.asset.assetFamily || undefined,
              subFamily: workOrder.asset.assetSubFamily || undefined,
              manufacturer: workOrder.asset.manufacturer || undefined,
              model: workOrder.asset.model || undefined,
            }
          : undefined,
        customerInfo: {
          name: workOrder.customer.name,
          siteName: workOrder.site?.name,
        },
      },
      procedureContext,
      userInstructions,
    };

    // Create AITaskPlan record with GENERATING status
    const aiTaskPlan = await prisma.aITaskPlan.create({
      data: {
        orgId,
        workOrderId,
        procedureTemplateId: procedureTemplateId || null,
        status: AITaskPlanStatus.GENERATING,
        llmModel: DEFAULT_MODEL,
        llmProvider: "anthropic",
        promptPayloadJson: aiRequest as any,
      },
    });

    // Generate tasks with Claude (async)
    try {
      const result = await generateTasksWithClaude(aiRequest);

      // Update AITaskPlan with results
      const updatedPlan = await prisma.aITaskPlan.update({
        where: { id: aiTaskPlan.id },
        data: {
          status: AITaskPlanStatus.GENERATED,
          llmRawResponseJson: {
            summary: result.summary,
            tasks: result.tasks,
          } as any,
          parsedTasksSnapshotJson: result.tasks as any,
          tokensUsed: result.tokensUsed,
          durationMs: result.durationMs,
        },
      });

      return NextResponse.json({
        data: {
          aiTaskPlan: updatedPlan,
          tasks: result.tasks,
          summary: result.summary,
          estimatedTotalDuration: result.estimatedTotalDuration,
        },
      });
    } catch (error: any) {
      // Update AITaskPlan with error
      await prisma.aITaskPlan.update({
        where: { id: aiTaskPlan.id },
        data: {
          status: AITaskPlanStatus.ERROR,
          errorMessage: error.message || "Failed to generate tasks",
        },
      });

      throw error;
    }
  } catch (error: any) {
    console.error("AI task generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate AI task plan" },
      { status: 500 }
    );
  }
}

// GET /api/work-orders/[id]/ai-generate - Get AI task plans for work order
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId } = auth;

  try {
    const aiTaskPlans = await prisma.aITaskPlan.findMany({
      where: { workOrderId, orgId },
      orderBy: { createdAt: "desc" },
      include: {
        approvedBy: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({ data: aiTaskPlans });
  } catch (error: any) {
    console.error("Fetch AI task plans error:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI task plans" },
      { status: 500 }
    );
  }
}
