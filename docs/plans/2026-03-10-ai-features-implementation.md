# AI Features Full Suite — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete AI engine for ServiceOpsIQ with predictive maintenance, smart scheduling, anomaly detection, AI copilot, and intelligent reporting — all powered by Claude API with event-driven architecture.

**Architecture:** Event-driven AI pipeline using a durable queue (mirrors proven QboSyncJob pattern). Data mutations fire AI analysis jobs → cron processes batch → Claude generates insights → stored and surfaced inline throughout existing UI. AI Copilot uses Claude tool-calling to query org data on-demand.

**Tech Stack:** Next.js 16.1 API routes, Prisma 6.16, Anthropic Claude SDK (@anthropic-ai/sdk), Vitest, CSS custom properties (no Tailwind)

---

## Phase 1: AI Engine Core Infrastructure

### Task 1: Prisma Schema — AI Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add AI enums and models to schema**

Add after the QBO models section (after `QboLocationMap`), before the Customer Portal section:

```prisma
// ============================================
// AI ENGINE — Insight Pipeline
// ============================================

enum AiInsightType {
  FAILURE_PREDICTION
  ANOMALY_DETECTED
  SCHEDULING_RECOMMENDATION
  MAINTENANCE_FORECAST
  QUOTE_SUGGESTION
  PERFORMANCE_TREND
  INVENTORY_ALERT
  REPORT_DRAFT
  WORKLOAD_ALERT
}

enum AiInsightSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model AiInsightJob {
  id           String   @id @default(uuid()) @db.Uuid
  orgId        String   @db.Uuid
  triggerEvent String   // e.g. "work_order.completed", "measurement.recorded"
  entityType   String   // e.g. "WorkOrder", "Asset", "Quote"
  entityId     String   @db.Uuid
  priority     Int      @default(5) // 1=critical, 5=normal, 9=background
  status       String   @default("pending") // pending, claimed, completed, failed, dead_letter
  payload      Json?
  result       Json?
  lockedAt     DateTime?
  lockedBy     String?
  claimedAt    DateTime?
  completedAt  DateTime?
  failedAt     DateTime?
  attempts     Int      @default(0)
  maxAttempts  Int      @default(3)
  errorMessage String?  @db.Text
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  org Org @relation(fields: [orgId], references: [id])

  @@index([status, priority, createdAt])
  @@index([orgId])
  @@index([entityType, entityId])
}

model AiInsight {
  id                   String            @id @default(uuid()) @db.Uuid
  orgId                String            @db.Uuid
  insightType          AiInsightType
  entityType           String
  entityId             String            @db.Uuid
  severity             AiInsightSeverity @default(MEDIUM)
  title                String
  summary              String            @db.Text
  details              Json?
  confidence           Float             @default(0.5)
  actionRecommended    String?           @db.Text
  actionTaken          String?           @db.Text
  acknowledgedAt       DateTime?
  acknowledgedByUserId String?           @db.Uuid
  expiresAt            DateTime?
  isActive             Boolean           @default(true)
  llmModel             String?
  tokensUsed           Int?
  durationMs           Int?
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt

  org            Org   @relation(fields: [orgId], references: [id])
  acknowledgedBy User? @relation("AiInsightAcknowledgedBy", fields: [acknowledgedByUserId], references: [id])

  @@index([orgId, entityType, entityId])
  @@index([orgId, insightType])
  @@index([orgId, severity])
  @@index([orgId, isActive])
  @@index([expiresAt])
}

model AiAnalysisContext {
  id              String   @id @default(uuid()) @db.Uuid
  orgId           String   @db.Uuid
  entityType      String
  entityId        String   @db.Uuid
  contextSnapshot Json?
  lastAnalyzedAt  DateTime?
  lastInsightAt   DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  org Org @relation(fields: [orgId], references: [id])

  @@unique([orgId, entityType, entityId])
  @@index([orgId])
}

// ============================================
// AI COPILOT — Conversational Interface
// ============================================

model AiConversation {
  id           String   @id @default(uuid()) @db.Uuid
  orgId        String   @db.Uuid
  userId       String   @db.Uuid
  title        String?
  lastMessageAt DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  org      Org         @relation(fields: [orgId], references: [id])
  user     User        @relation("AiConversationUser", fields: [userId], references: [id])
  messages AiMessage[]

  @@index([orgId, userId])
}

model AiMessage {
  id             String   @id @default(uuid()) @db.Uuid
  conversationId String   @db.Uuid
  role           String   // "user", "assistant", "system"
  content        String   @db.Text
  toolCalls      Json?
  tokensUsed     Int?
  durationMs     Int?
  createdAt      DateTime @default(now())

  conversation AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
}
```

Also add relations to the `Org` and `User` models:
- On `Org`: `aiInsightJobs AiInsightJob[]`, `aiInsights AiInsight[]`, `aiAnalysisContexts AiAnalysisContext[]`, `aiConversations AiConversation[]`
- On `User`: `acknowledgedInsights AiInsight[] @relation("AiInsightAcknowledgedBy")`, `aiConversations AiConversation[] @relation("AiConversationUser")`

**Step 2: Run migration**

```bash
cd Serviceops-ai && npx prisma migrate dev --name add-ai-engine-models
```

**Step 3: Verify Prisma client generates**

```bash
npx prisma generate
```

**Step 4: Commit**

```bash
git add prisma/ && git commit -m "feat(ai): add AI engine schema — AiInsightJob, AiInsight, AiAnalysisContext, AiConversation, AiMessage"
```

---

### Task 2: AI Queue Module

**Files:**
- Create: `src/lib/ai/ai-queue.ts`
- Test: `src/__tests__/lib/ai/ai-queue.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/__tests__/lib/ai/ai-queue.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  aiInsightJob: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  $queryRaw: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  enqueueAiAnalysis,
  claimAiBatch,
  completeAiJob,
  failAiJob,
  resetStaleAiLocks,
} from "@/lib/ai/ai-queue";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ai-queue", () => {
  describe("enqueueAiAnalysis", () => {
    it("creates an AiInsightJob with status=pending", async () => {
      mockPrisma.aiInsightJob.create.mockResolvedValue({ id: "job-1", status: "pending" });

      const result = await enqueueAiAnalysis("org-1", "work_order.completed", "WorkOrder", "wo-1", 5);

      expect(mockPrisma.aiInsightJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: "org-1",
          triggerEvent: "work_order.completed",
          entityType: "WorkOrder",
          entityId: "wo-1",
          priority: 5,
          status: "pending",
          attempts: 0,
          maxAttempts: 3,
        }),
      });
      expect(result.status).toBe("pending");
    });

    it("accepts optional payload", async () => {
      mockPrisma.aiInsightJob.create.mockResolvedValue({ id: "job-1" });

      await enqueueAiAnalysis("org-1", "measurement.recorded", "Asset", "asset-1", 5, { value: 12.5 });

      expect(mockPrisma.aiInsightJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: { value: 12.5 },
        }),
      });
    });
  });

  describe("claimAiBatch", () => {
    it("claims pending jobs ordered by priority then FIFO", async () => {
      const jobs = [{ id: "j1", priority: 1 }, { id: "j2", priority: 5 }];
      mockPrisma.$queryRaw.mockResolvedValue(jobs);

      const result = await claimAiBatch(20);

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(jobs);
    });
  });

  describe("completeAiJob", () => {
    it("sets status=completed and stores result", async () => {
      mockPrisma.aiInsightJob.update.mockResolvedValue({ id: "j1", status: "completed" });

      await completeAiJob("j1", { insights: [] });

      expect(mockPrisma.aiInsightJob.update).toHaveBeenCalledWith({
        where: { id: "j1" },
        data: expect.objectContaining({
          status: "completed",
          result: { insights: [] },
        }),
      });
    });
  });

  describe("failAiJob", () => {
    it("retries when attempts < maxAttempts", async () => {
      mockPrisma.aiInsightJob.findUniqueOrThrow.mockResolvedValue({ id: "j1", attempts: 1, maxAttempts: 3 });
      mockPrisma.aiInsightJob.update.mockResolvedValue({});

      await failAiJob("j1", "Claude API timeout");

      expect(mockPrisma.aiInsightJob.update).toHaveBeenCalledWith({
        where: { id: "j1" },
        data: expect.objectContaining({
          status: "pending",
          attempts: 2,
          errorMessage: "Claude API timeout",
        }),
      });
    });

    it("moves to dead_letter when attempts >= maxAttempts", async () => {
      mockPrisma.aiInsightJob.findUniqueOrThrow.mockResolvedValue({ id: "j1", attempts: 2, maxAttempts: 3 });
      mockPrisma.aiInsightJob.update.mockResolvedValue({});

      await failAiJob("j1", "Persistent failure");

      expect(mockPrisma.aiInsightJob.update).toHaveBeenCalledWith({
        where: { id: "j1" },
        data: expect.objectContaining({ status: "dead_letter", attempts: 3 }),
      });
    });
  });

  describe("resetStaleAiLocks", () => {
    it("resets claimed jobs older than threshold", async () => {
      mockPrisma.aiInsightJob.updateMany.mockResolvedValue({ count: 2 });

      const count = await resetStaleAiLocks(120);

      expect(count).toBe(2);
      expect(mockPrisma.aiInsightJob.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ status: "claimed" }),
        data: expect.objectContaining({ status: "pending" }),
      });
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/lib/ai/ai-queue.test.ts
```
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/lib/ai/ai-queue.ts
import { prisma } from "@/lib/prisma";
import { Prisma, AiInsightJob } from "@prisma/client";

export const AI_STALE_LOCK_SECONDS = 120;
export const AI_DEFAULT_MAX_ATTEMPTS = 3;
export const AI_DEFAULT_BATCH_SIZE = 20;

function generateLockerId(): string {
  const region = process.env.VERCEL_REGION ?? "local";
  const random = Math.random().toString(36).slice(2, 8);
  return `${region}-${Date.now()}-${random}`;
}

export async function enqueueAiAnalysis(
  orgId: string,
  triggerEvent: string,
  entityType: string,
  entityId: string,
  priority: number = 5,
  payload?: Record<string, unknown>
): Promise<AiInsightJob> {
  return prisma.aiInsightJob.create({
    data: {
      orgId,
      triggerEvent,
      entityType,
      entityId,
      priority,
      status: "pending",
      payload: payload ? (payload as Prisma.InputJsonValue) : Prisma.JsonNull,
      attempts: 0,
      maxAttempts: AI_DEFAULT_MAX_ATTEMPTS,
    },
  });
}

export async function claimAiBatch(
  limit: number = AI_DEFAULT_BATCH_SIZE
): Promise<AiInsightJob[]> {
  const lockerId = generateLockerId();
  const now = new Date();

  return prisma.$queryRaw<AiInsightJob[]>(
    Prisma.sql`
      UPDATE "AiInsightJob"
      SET
        status = 'claimed',
        "lockedAt" = ${now},
        "lockedBy" = ${lockerId},
        "claimedAt" = ${now},
        "updatedAt" = ${now}
      WHERE id IN (
        SELECT id FROM "AiInsightJob"
        WHERE status = 'pending'
        ORDER BY priority ASC, "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `
  );
}

export async function completeAiJob(
  jobId: string,
  result?: Record<string, unknown>
): Promise<void> {
  await prisma.aiInsightJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      ...(result ? { result: result as Prisma.InputJsonValue } : {}),
    },
  });
}

export async function failAiJob(
  jobId: string,
  errorMessage: string
): Promise<void> {
  const job = await prisma.aiInsightJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  const newAttempts = job.attempts + 1;
  const isDead = newAttempts >= job.maxAttempts;

  await prisma.aiInsightJob.update({
    where: { id: jobId },
    data: {
      status: isDead ? "dead_letter" : "pending",
      attempts: newAttempts,
      lockedAt: null,
      lockedBy: null,
      errorMessage,
      ...(isDead ? { failedAt: new Date() } : {}),
    },
  });
}

export async function resetStaleAiLocks(
  maxAgeSeconds: number = AI_STALE_LOCK_SECONDS
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeSeconds * 1000);

  const result = await prisma.aiInsightJob.updateMany({
    where: {
      status: "claimed",
      lockedAt: { lt: cutoff },
    },
    data: {
      status: "pending",
      lockedAt: null,
      lockedBy: null,
    },
  });

  return result.count;
}

export async function getAiQueueStats(orgId: string) {
  const counts = await prisma.aiInsightJob.groupBy({
    by: ["status"],
    where: { orgId },
    _count: true,
  });
  return Object.fromEntries(counts.map((c) => [c.status, c._count]));
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/lib/ai/ai-queue.test.ts
```
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/ai/ai-queue.ts src/__tests__/lib/ai/ai-queue.test.ts && git commit -m "feat(ai): add AI insight queue with enqueue/claim/complete/fail/stale-lock"
```

---

### Task 3: AI Prompts Module

**Files:**
- Create: `src/lib/ai/ai-prompts.ts`

**Step 1: Write the system prompts**

```typescript
// src/lib/ai/ai-prompts.ts

export const AI_INSIGHT_MODEL = "claude-sonnet-4-20250514";
export const AI_COPILOT_MODEL = "claude-sonnet-4-20250514";
export const AI_INSIGHT_MAX_TOKENS = 4096;
export const AI_COPILOT_MAX_TOKENS = 8192;

export const SYSTEM_PROMPT_PREDICTIVE_MAINTENANCE = `You are an expert rotating equipment reliability engineer analyzing field service data for ServiceOpsIQ, a service management platform for pump and motor service companies.

Your role: Analyze equipment data and generate actionable maintenance predictions.

You understand:
- Rotating equipment: pumps (submersible, vertical turbine, split case, end suction), motors (TEFC, explosion-proof), gearboxes
- Failure modes: bearing wear, seal failure, impeller erosion, shaft misalignment, motor winding degradation, VFD faults
- Vibration signatures: imbalance, misalignment, looseness, bearing defects (BPFO, BPFI, BSF, FTF)
- Industry standards: HI, API 610, IEEE, NEMA

Analyze the provided data and return ONLY valid JSON:
{
  "insights": [{
    "type": "FAILURE_PREDICTION" | "ANOMALY_DETECTED" | "MAINTENANCE_FORECAST",
    "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "title": "Short descriptive title",
    "summary": "2-3 sentence explanation for a field technician",
    "confidence": 0.0-1.0,
    "actionRecommended": "Specific action to take",
    "details": {
      "failureMode": "string",
      "estimatedDaysToFailure": number | null,
      "trendDirection": "improving" | "stable" | "degrading",
      "affectedComponents": ["string"],
      "rootCauseHypothesis": "string"
    }
  }]
}

Rules:
- Only generate insights when data supports them — don't fabricate patterns
- Set confidence based on data quality and sample size
- CRITICAL severity only for safety-related or imminent failure
- Always include specific, actionable recommendations
- Reference industry standards when relevant`;

export const SYSTEM_PROMPT_SMART_SCHEDULING = `You are an expert service dispatch optimizer for a rotating equipment service company.

Analyze technician profiles, workload, and job requirements to recommend optimal tech assignments.

Return ONLY valid JSON:
{
  "insights": [{
    "type": "SCHEDULING_RECOMMENDATION" | "WORKLOAD_ALERT",
    "severity": "LOW" | "MEDIUM" | "HIGH",
    "title": "Short title",
    "summary": "2-3 sentence explanation for a dispatcher",
    "confidence": 0.0-1.0,
    "actionRecommended": "Specific recommendation",
    "details": {
      "recommendedTechId": "uuid" | null,
      "recommendedTechName": "string" | null,
      "reasoning": ["string"],
      "alternativeTechs": [{"id": "uuid", "name": "string", "score": 0.0-1.0}],
      "estimatedDuration": number | null,
      "skillMatch": 0.0-1.0,
      "availabilityScore": 0.0-1.0
    }
  }]
}`;

export const SYSTEM_PROMPT_REPORT_GENERATION = `You are a professional technical writer generating field service reports for an industrial pump service company (Global Pump Solutions).

Generate executive summaries from work order data including tasks completed, findings, measurements, and materials used.

Return ONLY valid JSON:
{
  "insights": [{
    "type": "REPORT_DRAFT",
    "severity": "LOW",
    "title": "Report Draft: [WO Number]",
    "summary": "Executive summary paragraph (3-5 sentences, professional tone)",
    "confidence": 1.0,
    "actionRecommended": "Review and send to customer",
    "details": {
      "executiveSummary": "string",
      "keyFindings": ["string"],
      "safetyIssues": ["string"],
      "recommendations": ["string"],
      "materialsHighlight": "string"
    }
  }]
}`;

export const SYSTEM_PROMPT_INTELLIGENT_QUOTING = `You are an expert estimator for a rotating equipment service company.

Analyze historical quotes, labor data, and material costs to suggest quote line items and predict acceptance probability.

Return ONLY valid JSON:
{
  "insights": [{
    "type": "QUOTE_SUGGESTION",
    "severity": "LOW",
    "title": "Quote Intelligence: [context]",
    "summary": "Brief explanation of suggestions",
    "confidence": 0.0-1.0,
    "actionRecommended": "Review suggested line items",
    "details": {
      "suggestedLineItems": [{
        "description": "string",
        "estimatedHours": number,
        "estimatedCost": number,
        "basis": "string"
      }],
      "acceptanceProbability": 0.0-1.0,
      "acceptanceBasis": "string",
      "historicalComparisons": [{
        "quoteNumber": "string",
        "amount": number,
        "wasAccepted": boolean
      }]
    }
  }]
}`;

export const SYSTEM_PROMPT_COPILOT = `You are ServiceOps AI Copilot, an expert assistant for a rotating equipment field service company. You help dispatchers, technicians, and administrators with questions about their service operations data.

You have access to internal tools that let you query the company's database. Use these tools to find accurate information before answering.

Guidelines:
- Always query relevant data before answering — don't guess
- Be concise and actionable — field techs read this on mobile
- Reference specific work orders, assets, and measurements by name/number
- Flag safety concerns prominently
- When suggesting actions, be specific (e.g., "Schedule PM for Pump VT-2847 within 2 weeks")
- You can suggest creating work orders, scheduling PMs, or generating quotes — describe the action and ask for confirmation
- Format numbers consistently (e.g., "12.5 in/s", "$1,250.00", "3.2 hours")`;

/** Map trigger events to the correct system prompt */
export function getSystemPromptForEvent(triggerEvent: string): string {
  if (triggerEvent.startsWith("work_order.completed")) return SYSTEM_PROMPT_REPORT_GENERATION;
  if (triggerEvent.startsWith("measurement.") || triggerEvent.startsWith("finding.") || triggerEvent.startsWith("pm_schedule.")) return SYSTEM_PROMPT_PREDICTIVE_MAINTENANCE;
  if (triggerEvent.startsWith("work_order.created")) return SYSTEM_PROMPT_SMART_SCHEDULING;
  if (triggerEvent.startsWith("quote.")) return SYSTEM_PROMPT_INTELLIGENT_QUOTING;
  return SYSTEM_PROMPT_PREDICTIVE_MAINTENANCE; // default
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/ai-prompts.ts && git commit -m "feat(ai): add domain-specific system prompts for all AI modules"
```

---

### Task 4: AI Engine — Context Builder + Pipeline

**Files:**
- Create: `src/lib/ai/ai-engine.ts`
- Test: `src/__tests__/lib/ai/ai-engine.test.ts`

**Step 1: Write failing tests**

```typescript
// src/__tests__/lib/ai/ai-engine.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  asset: { findFirst: vi.fn() },
  workOrder: { findMany: vi.fn(), findFirst: vi.fn() },
  taskMeasurement: { findMany: vi.fn() },
  taskFinding: { findMany: vi.fn() },
  workflowDefinition: { findMany: vi.fn() },
  taskInstance: { findMany: vi.fn() },
  taskMaterialUsage: { findMany: vi.fn() },
  timeEntry: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  quote: { findMany: vi.fn() },
  quoteLineItem: { findMany: vi.fn() },
  aiInsight: { create: vi.fn(), findMany: vi.fn() },
  aiAnalysisContext: { upsert: vi.fn() },
  notification: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockAnthropic = {
  messages: {
    create: vi.fn(),
  },
};
vi.mock("@/lib/ai/anthropic", () => ({
  getAnthropicClient: () => mockAnthropic,
  DEFAULT_MODEL: "claude-sonnet-4-20250514",
}));

vi.mock("@/lib/notifications", () => ({
  notifyMultipleUsers: vi.fn(),
}));

import {
  buildAssetContext,
  buildWorkOrderContext,
  buildSchedulingContext,
  processAiJob,
} from "@/lib/ai/ai-engine";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ai-engine", () => {
  describe("buildAssetContext", () => {
    it("aggregates asset profile, work history, measurements, and findings", async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({
        id: "a1", name: "Pump VT-2847", assetCategory: "ROTATING_EQUIPMENT",
        assetFamily: "PUMP", assetSubFamily: "VERTICAL_TURBINE",
        manufacturer: "Flowserve", model: "VTP-8",
        criticality: "HIGH", nameplate: { hp: 50, rpm: 1780 },
      });
      mockPrisma.workOrder.findMany.mockResolvedValue([
        { id: "wo1", title: "Bearing replacement", status: "COMPLETED", completedAt: new Date() },
      ]);
      mockPrisma.taskMeasurement.findMany.mockResolvedValue([
        { name: "Vibration", numericValue: 0.22, unit: "in/s", isWithinSpec: true },
      ]);
      mockPrisma.taskFinding.findMany.mockResolvedValue([
        { category: "DEFICIENCY", details: "Bearing wear detected", priority: "MEDIUM" },
      ]);
      mockPrisma.workflowDefinition.findMany.mockResolvedValue([]);

      const ctx = await buildAssetContext("org-1", "a1");

      expect(ctx.asset.name).toBe("Pump VT-2847");
      expect(ctx.workHistory).toHaveLength(1);
      expect(ctx.measurements).toHaveLength(1);
      expect(ctx.findings).toHaveLength(1);
    });
  });

  describe("processAiJob", () => {
    it("calls Claude with context and stores resulting insights", async () => {
      const job = {
        id: "job-1", orgId: "org-1", triggerEvent: "measurement.recorded",
        entityType: "Asset", entityId: "a1", payload: {},
      };

      mockPrisma.asset.findFirst.mockResolvedValue({
        id: "a1", name: "Pump VT-2847", assetCategory: "ROTATING_EQUIPMENT",
        assetFamily: "PUMP", criticality: "HIGH",
      });
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.taskMeasurement.findMany.mockResolvedValue([]);
      mockPrisma.taskFinding.findMany.mockResolvedValue([]);
      mockPrisma.workflowDefinition.findMany.mockResolvedValue([]);
      mockPrisma.aiAnalysisContext.upsert.mockResolvedValue({});

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({
          insights: [{
            type: "MAINTENANCE_FORECAST",
            severity: "LOW",
            title: "PM interval optimal",
            summary: "Current PM schedule is appropriate.",
            confidence: 0.8,
            actionRecommended: "Continue current schedule",
            details: {},
          }],
        })}],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      mockPrisma.aiInsight.create.mockResolvedValue({ id: "ins-1" });

      const result = await processAiJob(job as any);

      expect(mockAnthropic.messages.create).toHaveBeenCalled();
      expect(mockPrisma.aiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: "org-1",
          insightType: "MAINTENANCE_FORECAST",
          entityType: "Asset",
          entityId: "a1",
          title: "PM interval optimal",
        }),
      });
      expect(result.insightsCreated).toBe(1);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/lib/ai/ai-engine.test.ts
```

**Step 3: Write the implementation**

```typescript
// src/lib/ai/ai-engine.ts
import { prisma } from "@/lib/prisma";
import { AiInsightJob, Prisma } from "@prisma/client";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import {
  AI_INSIGHT_MODEL,
  AI_INSIGHT_MAX_TOKENS,
  getSystemPromptForEvent,
} from "@/lib/ai/ai-prompts";
import { notifyMultipleUsers } from "@/lib/notifications";

// ============================================
// CONTEXT BUILDERS
// ============================================

export async function buildAssetContext(orgId: string, assetId: string) {
  const [asset, workHistory, measurements, findings, pmSchedules] = await Promise.all([
    prisma.asset.findFirst({
      where: { id: assetId, orgId },
      select: {
        id: true, name: true, manufacturer: true, model: true,
        serialNumber: true, assetCategory: true, assetFamily: true,
        assetSubFamily: true, criticality: true, status: true,
        nameplate: true, createdAt: true,
      },
    }),
    prisma.workOrder.findMany({
      where: { assetId, orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, title: true, description: true, status: true, priority: true,
        orderType: true, completedAt: true, createdAt: true, estimatedHours: true,
      },
    }),
    prisma.taskMeasurement.findMany({
      where: { taskInstance: { workOrder: { assetId, orgId } } },
      orderBy: { capturedAt: "desc" },
      take: 50,
      select: {
        name: true, numericValue: true, textValue: true, unit: true,
        measurementType: true, minValue: true, maxValue: true,
        isWithinSpec: true, capturedAt: true,
      },
    }),
    prisma.taskFinding.findMany({
      where: { taskInstance: { workOrder: { assetId, orgId } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        category: true, details: true, priority: true, createdAt: true,
      },
    }),
    prisma.workflowDefinition.findMany({
      where: { assetId, orgId },
      select: {
        name: true, frequencyType: true, frequencyValue: true,
        nextScheduledDate: true, executionCount: true, priority: true,
      },
    }),
  ]);

  return { asset, workHistory, measurements, findings, pmSchedules };
}

export async function buildWorkOrderContext(orgId: string, workOrderId: string) {
  const [workOrder, tasks, materials, timeEntries] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id: workOrderId, orgId },
      include: {
        asset: { select: { id: true, name: true, assetFamily: true, manufacturer: true, model: true } },
        customer: { select: { name: true } },
        site: { select: { name: true } },
      },
    }),
    prisma.taskInstance.findMany({
      where: { workOrderId, orgId },
      orderBy: { sequenceNumber: "asc" },
      include: {
        measurements: true,
        findings: true,
      },
    }),
    prisma.taskMaterialUsage.findMany({
      where: { taskInstance: { workOrderId, orgId } },
    }),
    prisma.timeEntry.findMany({
      where: { workOrderId, orgId },
      select: {
        userId: true, accumulatedSeconds: true, status: true,
      },
    }),
  ]);

  return { workOrder, tasks, materials, timeEntries };
}

export async function buildSchedulingContext(orgId: string, workOrderId: string) {
  const [workOrder, techs, recentAssignments] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id: workOrderId, orgId },
      include: {
        asset: { select: { id: true, name: true, assetFamily: true, assetSubFamily: true } },
        site: { select: { name: true, address: true, city: true, state: true } },
      },
    }),
    prisma.user.findMany({
      where: { orgRoles: { some: { orgId } }, role: "TECH" },
      select: {
        id: true, fullName: true, email: true,
      },
    }),
    prisma.workOrder.findMany({
      where: { orgId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: {
        id: true, title: true, status: true, priority: true,
        tasks: { select: { assignedToId: true } },
      },
    }),
  ]);

  return { workOrder, techs, recentAssignments };
}

export async function buildQuoteContext(orgId: string, quoteId: string) {
  const [quote, historicalQuotes] = await Promise.all([
    prisma.quote.findFirst({
      where: { id: quoteId, orgId },
      include: {
        lineItems: true,
        customer: { select: { name: true, tier: true } },
        asset: { select: { name: true, assetFamily: true } },
      },
    }),
    prisma.quote.findMany({
      where: {
        orgId,
        status: { in: ["APPROVED", "REJECTED", "CONVERTED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { lineItems: true },
    }),
  ]);

  return { quote, historicalQuotes };
}

// ============================================
// PIPELINE PROCESSOR
// ============================================

export async function processAiJob(
  job: AiInsightJob
): Promise<{ insightsCreated: number; tokensUsed: number }> {
  const startTime = Date.now();

  // 1. Build context based on trigger event
  let context: Record<string, unknown>;
  if (job.triggerEvent.startsWith("work_order.completed")) {
    context = await buildWorkOrderContext(job.orgId, job.entityId);
  } else if (job.triggerEvent.startsWith("work_order.created")) {
    context = await buildSchedulingContext(job.orgId, job.entityId);
  } else if (job.triggerEvent.startsWith("quote.")) {
    context = await buildQuoteContext(job.orgId, job.entityId);
  } else {
    // Default: asset-based analysis (measurements, findings, PM)
    context = await buildAssetContext(job.orgId, job.entityId);
  }

  // 2. Cache context snapshot
  await prisma.aiAnalysisContext.upsert({
    where: {
      orgId_entityType_entityId: {
        orgId: job.orgId,
        entityType: job.entityType,
        entityId: job.entityId,
      },
    },
    create: {
      orgId: job.orgId,
      entityType: job.entityType,
      entityId: job.entityId,
      contextSnapshot: context as Prisma.InputJsonValue,
      lastAnalyzedAt: new Date(),
    },
    update: {
      contextSnapshot: context as Prisma.InputJsonValue,
      lastAnalyzedAt: new Date(),
    },
  });

  // 3. Call Claude
  const client = getAnthropicClient();
  const systemPrompt = getSystemPromptForEvent(job.triggerEvent);

  const response = await client.messages.create({
    model: AI_INSIGHT_MODEL,
    max_tokens: AI_INSIGHT_MAX_TOKENS,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: `Analyze this data and generate insights:\n\n${JSON.stringify(context, null, 2)}`,
    }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // 4. Parse response
  let parsed: { insights: Array<Record<string, unknown>> };
  try {
    let cleaned = textContent.text.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
    if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
    parsed = JSON.parse(cleaned.trim());
  } catch {
    throw new Error(`Failed to parse Claude response: ${textContent.text.slice(0, 200)}`);
  }

  const durationMs = Date.now() - startTime;
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

  // 5. Store insights
  let insightsCreated = 0;
  for (const insight of parsed.insights || []) {
    const created = await prisma.aiInsight.create({
      data: {
        orgId: job.orgId,
        insightType: insight.type as string,
        entityType: job.entityType,
        entityId: job.entityId,
        severity: (insight.severity as string) || "MEDIUM",
        title: insight.title as string,
        summary: insight.summary as string,
        details: insight.details ? (insight.details as Prisma.InputJsonValue) : undefined,
        confidence: (insight.confidence as number) || 0.5,
        actionRecommended: insight.actionRecommended as string,
        llmModel: AI_INSIGHT_MODEL,
        tokensUsed,
        durationMs,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });
    insightsCreated++;

    // 6. Notify on HIGH/CRITICAL
    if (insight.severity === "HIGH" || insight.severity === "CRITICAL") {
      const admins = await prisma.user.findMany({
        where: { orgRoles: { some: { orgId: job.orgId } }, role: "ADMIN" },
        select: { id: true },
      });
      if (admins.length > 0) {
        await notifyMultipleUsers(
          admins.map((a) => a.id),
          job.orgId,
          "WORK_ORDER_STATUS_CHANGED", // Reuse existing type for now
          `AI Alert: ${insight.title}`,
          insight.summary as string,
          undefined,
          { insightId: created.id, insightType: insight.type }
        );
      }
    }
  }

  // Update analysis context with last insight timestamp
  if (insightsCreated > 0) {
    await prisma.aiAnalysisContext.update({
      where: {
        orgId_entityType_entityId: {
          orgId: job.orgId,
          entityType: job.entityType,
          entityId: job.entityId,
        },
      },
      data: { lastInsightAt: new Date() },
    });
  }

  return { insightsCreated, tokensUsed };
}
```

**Step 4: Run tests**

```bash
npx vitest run src/__tests__/lib/ai/ai-engine.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/ai/ai-engine.ts src/__tests__/lib/ai/ai-engine.test.ts && git commit -m "feat(ai): add AI engine with context builders and pipeline processor"
```

---

### Task 5: AI Triggers Module

**Files:**
- Create: `src/lib/ai/ai-triggers.ts`
- Test: `src/__tests__/lib/ai/ai-triggers.test.ts`

**Step 1: Write failing tests**

```typescript
// src/__tests__/lib/ai/ai-triggers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/ai-queue", () => ({
  enqueueAiAnalysis: vi.fn().mockResolvedValue({ id: "job-1" }),
}));

import { enqueueAiAnalysis } from "@/lib/ai/ai-queue";
import {
  triggerWorkOrderCompleted,
  triggerMeasurementRecorded,
  triggerFindingCreated,
  triggerWorkOrderCreated,
  triggerQuoteCreated,
} from "@/lib/ai/ai-triggers";

beforeEach(() => vi.clearAllMocks());

describe("ai-triggers", () => {
  it("triggerWorkOrderCompleted enqueues report + predictive analysis", async () => {
    await triggerWorkOrderCompleted("org-1", "wo-1", "asset-1");

    expect(enqueueAiAnalysis).toHaveBeenCalledTimes(2);
    expect(enqueueAiAnalysis).toHaveBeenCalledWith(
      "org-1", "work_order.completed", "WorkOrder", "wo-1", 5, undefined
    );
    expect(enqueueAiAnalysis).toHaveBeenCalledWith(
      "org-1", "work_order.completed.asset_analysis", "Asset", "asset-1", 9, undefined
    );
  });

  it("triggerWorkOrderCompleted skips asset analysis when no assetId", async () => {
    await triggerWorkOrderCompleted("org-1", "wo-1", null);

    expect(enqueueAiAnalysis).toHaveBeenCalledTimes(1);
  });

  it("triggerMeasurementRecorded enqueues with priority 5", async () => {
    await triggerMeasurementRecorded("org-1", "asset-1", { name: "Vibration", value: 0.3 });

    expect(enqueueAiAnalysis).toHaveBeenCalledWith(
      "org-1", "measurement.recorded", "Asset", "asset-1", 5,
      { name: "Vibration", value: 0.3 }
    );
  });

  it("triggerFindingCreated enqueues with priority 3", async () => {
    await triggerFindingCreated("org-1", "asset-1", "SAFETY", "Exposed wiring");

    expect(enqueueAiAnalysis).toHaveBeenCalledWith(
      "org-1", "finding.created", "Asset", "asset-1", 3,
      expect.objectContaining({ category: "SAFETY" })
    );
  });

  it("triggerWorkOrderCreated enqueues scheduling recommendation", async () => {
    await triggerWorkOrderCreated("org-1", "wo-1");

    expect(enqueueAiAnalysis).toHaveBeenCalledWith(
      "org-1", "work_order.created", "WorkOrder", "wo-1", 3, undefined
    );
  });

  it("triggerQuoteCreated enqueues quote intelligence", async () => {
    await triggerQuoteCreated("org-1", "q-1");

    expect(enqueueAiAnalysis).toHaveBeenCalledWith(
      "org-1", "quote.created", "Quote", "q-1", 5, undefined
    );
  });
});
```

**Step 2: Run tests — expect fail**

**Step 3: Implement**

```typescript
// src/lib/ai/ai-triggers.ts
import { enqueueAiAnalysis } from "@/lib/ai/ai-queue";

export async function triggerWorkOrderCompleted(
  orgId: string,
  workOrderId: string,
  assetId: string | null
): Promise<void> {
  // Report draft generation
  await enqueueAiAnalysis(orgId, "work_order.completed", "WorkOrder", workOrderId, 5, undefined);

  // Asset predictive analysis (if asset linked)
  if (assetId) {
    await enqueueAiAnalysis(orgId, "work_order.completed.asset_analysis", "Asset", assetId, 9, undefined);
  }
}

export async function triggerMeasurementRecorded(
  orgId: string,
  assetId: string,
  measurement: { name: string; value: number }
): Promise<void> {
  await enqueueAiAnalysis(orgId, "measurement.recorded", "Asset", assetId, 5, measurement);
}

export async function triggerFindingCreated(
  orgId: string,
  assetId: string,
  category: string,
  details: string
): Promise<void> {
  await enqueueAiAnalysis(orgId, "finding.created", "Asset", assetId, 3, { category, details });
}

export async function triggerWorkOrderCreated(
  orgId: string,
  workOrderId: string
): Promise<void> {
  await enqueueAiAnalysis(orgId, "work_order.created", "WorkOrder", workOrderId, 3, undefined);
}

export async function triggerQuoteCreated(
  orgId: string,
  quoteId: string
): Promise<void> {
  await enqueueAiAnalysis(orgId, "quote.created", "Quote", quoteId, 5, undefined);
}

export async function triggerQuoteSent(
  orgId: string,
  quoteId: string
): Promise<void> {
  await enqueueAiAnalysis(orgId, "quote.sent", "Quote", quoteId, 9, undefined);
}

export async function triggerPMExecuted(
  orgId: string,
  assetId: string,
  scheduleId: string
): Promise<void> {
  await enqueueAiAnalysis(orgId, "pm_schedule.executed", "Asset", assetId, 5, { scheduleId });
}
```

**Step 4: Run tests — expect pass**

**Step 5: Commit**

```bash
git add src/lib/ai/ai-triggers.ts src/__tests__/lib/ai/ai-triggers.test.ts && git commit -m "feat(ai): add AI trigger functions for all event types"
```

---

### Task 6: AI Process Cron Route

**Files:**
- Create: `src/app/api/cron/ai-process/route.ts`
- Modify: `vercel.json` — add cron entry

**Step 1: Write the cron route**

```typescript
// src/app/api/cron/ai-process/route.ts
import { NextResponse } from "next/server";
import { claimAiBatch, completeAiJob, failAiJob, resetStaleAiLocks } from "@/lib/ai/ai-queue";
import { processAiJob } from "@/lib/ai/ai-engine";

export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  // Reset stale locks
  const staleReset = await resetStaleAiLocks();

  // Claim batch
  const jobs = await claimAiBatch(20);

  let processed = 0;
  let failed = 0;
  let totalTokens = 0;

  for (const job of jobs) {
    try {
      const result = await processAiJob(job);
      await completeAiJob(job.id, {
        insightsCreated: result.insightsCreated,
        tokensUsed: result.tokensUsed,
      });
      totalTokens += result.tokensUsed;
      processed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await failAiJob(job.id, message);
      failed++;
      console.error(`AI job ${job.id} failed:`, message);
    }

    // Respect Vercel function timeout — stop if approaching limit
    if (Date.now() - startTime > 50000) break;
  }

  return NextResponse.json({
    staleReset,
    claimed: jobs.length,
    processed,
    failed,
    totalTokens,
    durationMs: Date.now() - startTime,
  });
}
```

**Step 2: Add cron entry to vercel.json**

Add to the crons array: `{ "path": "/api/cron/ai-process", "schedule": "*/2 * * * *" }`

**Step 3: Commit**

```bash
git add src/app/api/cron/ai-process/route.ts vercel.json && git commit -m "feat(ai): add AI processing cron route (every 2 min, 20 jobs/batch)"
```

---

### Task 7: AI Insights API Routes

**Files:**
- Create: `src/app/api/ai/insights/route.ts`
- Create: `src/app/api/ai/insights/[id]/acknowledge/route.ts`
- Create: `src/app/api/ai/stats/route.ts`

**Step 1: Write insights list endpoint**

```typescript
// src/app/api/ai/insights/route.ts
import { NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const result = await requireAuthSessionFirst(request);
  if ("error" in result) return result.error;
  const { auth } = result;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const insightType = searchParams.get("insightType");
  const severity = searchParams.get("severity");
  const activeOnly = searchParams.get("activeOnly") !== "false";

  const insights = await prisma.aiInsight.findMany({
    where: {
      orgId: auth.orgId,
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(insightType ? { insightType: insightType as any } : {}),
      ...(severity ? { severity: severity as any } : {}),
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return NextResponse.json({ data: insights });
}
```

**Step 2: Write acknowledge endpoint**

```typescript
// src/app/api/ai/insights/[id]/acknowledge/route.ts
import { NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthSessionFirst(request);
  if ("error" in result) return result.error;
  const { auth } = result;
  const { id } = await params;

  const body = await request.json();

  const insight = await prisma.aiInsight.update({
    where: { id, orgId: auth.orgId },
    data: {
      acknowledgedAt: new Date(),
      acknowledgedByUserId: auth.userId,
      ...(body.actionTaken ? { actionTaken: body.actionTaken } : {}),
    },
  });

  return NextResponse.json({ data: insight });
}
```

**Step 3: Write stats endpoint**

```typescript
// src/app/api/ai/stats/route.ts
import { NextResponse } from "next/server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const result = await requireAuthSessionFirst(request);
  if ("error" in result) return result.error;
  const { auth } = result;
  const roleError = requireRole(auth, ["ADMIN"]);
  if (roleError) return roleError;

  const [insightCounts, jobCounts, recentInsights, tokenUsage] = await Promise.all([
    prisma.aiInsight.groupBy({
      by: ["insightType"],
      where: { orgId: auth.orgId, isActive: true },
      _count: true,
    }),
    prisma.aiInsightJob.groupBy({
      by: ["status"],
      where: { orgId: auth.orgId },
      _count: true,
    }),
    prisma.aiInsight.findMany({
      where: { orgId: auth.orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, insightType: true, severity: true, title: true, createdAt: true },
    }),
    prisma.aiInsight.aggregate({
      where: { orgId: auth.orgId },
      _sum: { tokensUsed: true },
    }),
  ]);

  return NextResponse.json({
    insightsByType: Object.fromEntries(insightCounts.map((c) => [c.insightType, c._count])),
    jobsByStatus: Object.fromEntries(jobCounts.map((c) => [c.status, c._count])),
    recentInsights,
    totalTokensUsed: tokenUsage._sum.tokensUsed || 0,
  });
}
```

**Step 4: Commit**

```bash
git add src/app/api/ai/ && git commit -m "feat(ai): add AI insights API — list, acknowledge, stats endpoints"
```

---

### Task 8: Wire Triggers into Existing API Routes

**Files:**
- Modify: `src/app/api/work-orders/[id]/route.ts` — add trigger on COMPLETED
- Modify: `src/app/api/tasks/[id]/measurements/route.ts` — add trigger on measurement POST
- Modify: `src/app/api/tasks/[id]/findings/route.ts` — add trigger on finding POST
- Modify: `src/app/api/work-orders/route.ts` — add trigger on POST (create)
- Modify: `src/app/api/quotes/route.ts` — add trigger on POST (create)

For each file, add the trigger call after the successful mutation. Example for work order PATCH:

```typescript
// After: if (body.status === "COMPLETED") { ... }
// Add:
import { triggerWorkOrderCompleted } from "@/lib/ai/ai-triggers";
// ...inside the COMPLETED status block:
triggerWorkOrderCompleted(auth.orgId, id, existing.assetId).catch(console.error);
```

Pattern: fire-and-forget with `.catch(console.error)` — never block the main mutation.

**Step 5: Commit**

```bash
git add src/app/api/ && git commit -m "feat(ai): wire AI triggers into WO, measurement, finding, and quote mutations"
```

---

## Phase 2: Predictive Maintenance UI

### Task 9: Asset Risk Badge Component

**Files:**
- Create: `src/components/ai/AiRiskBadge.tsx`
- Create: `src/components/ai/AiRiskBadge.css`

Renders a colored badge (green/yellow/orange/red) based on highest-severity active insight for an entity. Fetches from `GET /api/ai/insights?entityType=Asset&entityId=X`.

**Step 1: Implement component**

The badge shows: severity icon + short label. Colors map to CSS variables. On click, expands to show insight summary.

**Step 2: Commit**

---

### Task 10: Asset Detail — AI Predictions Card

**Files:**
- Create: `src/components/ai/AiInsightsCard.tsx`
- Create: `src/components/ai/AiInsightsCard.css`
- Modify: `src/app/(app)/assets/[id]/page.tsx`

A card showing all active AI insights for an asset: title, severity badge, summary, confidence %, recommended action, and "Acknowledge" button.

---

### Task 11: Dashboard — AI Alerts Widget

**Files:**
- Create: `src/components/ai/AiAlertsWidget.tsx`
- Create: `src/components/ai/AiAlertsWidget.css`
- Modify: `src/app/(app)/dashboard/page.tsx`

Shows HIGH/CRITICAL insights across the org. Links to entity detail pages. Count badge.

---

### Task 12: PM Schedule — AI Recommended Intervals

**Files:**
- Modify: `src/app/(app)/pm-schedules/page.tsx`

Show "AI Suggested" badge when a MAINTENANCE_FORECAST insight exists with a different recommended interval than current.

---

## Phase 3: AI Copilot

### Task 13: Copilot API — Chat with Tool Calling

**Files:**
- Create: `src/lib/ai/ai-copilot.ts`
- Create: `src/lib/ai/copilot-tools.ts`
- Create: `src/app/api/ai/chat/route.ts`
- Test: `src/__tests__/lib/ai/ai-copilot.test.ts`

**Key implementation:** Define Claude tools that map to Prisma queries. The copilot handler manages a multi-turn conversation with tool use loop:

1. User sends message
2. Claude responds (possibly with tool_use blocks)
3. Execute each tool call against Prisma
4. Send tool results back to Claude
5. Repeat until Claude returns a text-only response
6. Store all messages in AiConversation/AiMessage

Tool definitions in `copilot-tools.ts`:
- `search_assets` — text search on name/serial/manufacturer
- `get_work_orders` — filter by asset, customer, status, date
- `get_measurements` — historical measurements for asset
- `get_findings` — field observations
- `get_time_entries` — labor hours
- `get_pm_schedules` — upcoming maintenance
- `get_quotes` — filter by customer, status
- `get_invoices` — filter by customer, status
- `get_ai_insights` — existing predictions for entity
- `get_customer_history` — full customer timeline

Each tool returns max 20 results (prevent token bloat).

---

### Task 14: Copilot Conversations API

**Files:**
- Create: `src/app/api/ai/conversations/route.ts`
- Create: `src/app/api/ai/conversations/[id]/messages/route.ts`
- Create: `src/app/api/ai/conversations/[id]/route.ts`

CRUD for conversations + message history.

---

### Task 15: Copilot Floating UI Component

**Files:**
- Create: `src/components/ai/AiCopilot.tsx`
- Create: `src/components/ai/AiCopilot.css`
- Modify: `src/app/(app)/layout.tsx`

Floating chat bubble (bottom-right). Expands to sidebar. Context-aware (reads current page route to auto-include entity). Streaming responses. Conversation history sidebar.

---

## Phase 4: Smart Scheduling

### Task 16: Scheduling Insight Processing

Already handled by `processAiJob` with `buildSchedulingContext`. Just need UI.

### Task 17: Work Order Assignment — AI Suggested Badge

**Files:**
- Modify: `src/app/(app)/work-orders/[id]/page.tsx`

When a SCHEDULING_RECOMMENDATION insight exists for a WO, show "AI Suggested: [Tech Name]" badge next to the tech assignment dropdown.

---

## Phase 5: AI Reports & Quoting

### Task 18: Work Order Report — AI Draft Summary

**Files:**
- Modify: `src/app/(app)/work-orders/[id]/report/page.tsx` (or relevant report component)

When a REPORT_DRAFT insight exists for a completed WO, pre-populate the report summary field with the AI-generated text. Show "AI Generated" label.

### Task 19: Quote — AI Line Item Suggestions

**Files:**
- Modify: `src/app/(app)/quotes/[id]/page.tsx`

When a QUOTE_SUGGESTION insight exists, show a "AI Suggestions" panel with recommended line items. User can accept/reject each suggestion.

---

## Testing Strategy

Each task includes unit tests for core logic. Additionally:

1. **Integration testing**: After Phase 1, manually test the full pipeline by:
   - Creating a WO with an asset
   - Completing the WO
   - Verifying an AiInsightJob is created (check DB)
   - Running the cron manually: `curl localhost:3000/api/cron/ai-process`
   - Verifying AiInsight records created
   - Checking insights show in `GET /api/ai/insights`

2. **Copilot testing**: After Phase 3:
   - Start a conversation via `POST /api/ai/chat`
   - Ask "What's the failure history on [asset name]?"
   - Verify Claude uses search_assets + get_work_orders tools
   - Verify response references actual data

3. **Build verification**: Run `npx next build` after each phase to ensure no TypeScript errors

---

## Execution Order

```
Phase 1 (Tasks 1-8): AI Engine Core — MUST complete first
Phase 2 (Tasks 9-12): Predictive Maintenance UI — depends on Phase 1
Phase 3 (Tasks 13-15): AI Copilot — independent of Phase 2
Phase 4 (Tasks 16-17): Smart Scheduling UI — depends on Phase 1
Phase 5 (Tasks 18-19): AI Reports & Quoting UI — depends on Phase 1
```

Phases 2-5 can run in parallel after Phase 1 completes.
