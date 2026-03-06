# Custom Report/Form System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a custom report/form builder so admins design templates, dispatchers assign them to WOs, techs fill them out on mobile (with offline auto-save), and completed reports export as branded PDFs with cover pages.

**Architecture:** Extend existing ReportTemplate model (JSON `definition` field) + new FormResponse model. Pure additive — no existing models/routes/components modified structurally. JSON-based template definitions for offline-friendly mobile caching. ~36 new files, ~8 surgical edits to existing files.

**Tech Stack:** Next.js 16.1, React 19, TypeScript 5, Prisma 6.16, @react-pdf/renderer, Expo SDK 54, Zustand, expo-sqlite

**IMPORTANT — Project-Specific Overrides:**
- Styling: Custom CSS variables (NOT Tailwind) — see existing `.css` files for patterns
- Auth: `requireAuthSessionFirst(request)` on every API route (from `src/lib/auth.ts`)
- Multi-tenant: ALL queries must include `orgId: auth.orgId`
- Response envelope: `{ data: T }` for success, `{ error: string }` for errors
- Helpers: `parseJson<T>()` and `jsonError()` from `src/lib/api-server.ts`
- Role check: `requireRole(auth, [Role.ADMIN, Role.DISPATCHER])` from `src/lib/auth.ts`

---

## Task 1: Prisma Schema — Add FormResponse Model + Enum Values

**Files:**
- Modify: `prisma/schema.prisma` (lines 171-176 for enum, append after line 1624 for new model, add relation lines to existing models)

**Step 1: Add new ReportBlockType enum values**

In `prisma/schema.prisma`, find the `ReportBlockType` enum at lines 171-176. It currently looks like:

```prisma
enum ReportBlockType {
  HEADING
  RICH_TEXT
  TABLE
  IMAGE
}
```

Replace with:

```prisma
enum ReportBlockType {
  HEADING
  RICH_TEXT
  TABLE
  IMAGE
  TEXT_INPUT
  TEXTAREA
  NUMERIC_INPUT
  YES_NO
  DROPDOWN
  MULTI_SELECT
  DATE_INPUT
  PHOTO_CAPTURE
  SIGNATURE
  GPS_CAPTURE
  SECTION_HEADER
  INSTRUCTIONS
  CALCULATED
}
```

**Step 2: Add FormResponseStatus enum**

After the `ReportBlockType` enum (after line 176), add:

```prisma
enum FormResponseStatus {
  DRAFT
  SUBMITTED
  REVIEWED
  EXPORTED
}
```

**Step 3: Add FormResponse model**

After the last model in the file (after line 1624), append:

```prisma
model FormResponse {
  id                String             @id @default(uuid()) @db.Uuid
  orgId             String             @db.Uuid
  org               Org                @relation(fields: [orgId], references: [id])

  reportTemplateId  String             @db.Uuid
  reportTemplate    ReportTemplate     @relation(fields: [reportTemplateId], references: [id])
  templateSnapshot  Json?

  workOrderId       String?            @db.Uuid
  workOrder         WorkOrder?         @relation(fields: [workOrderId], references: [id])
  siteId            String?            @db.Uuid
  site              Site?              @relation(fields: [siteId], references: [id])
  assetId           String?            @db.Uuid
  asset             Asset?             @relation(fields: [assetId], references: [id])

  data              Json               @default("{}")
  status            FormResponseStatus @default(DRAFT)

  filledByUserId    String             @db.Uuid
  filledBy          User               @relation("FilledFormResponses", fields: [filledByUserId], references: [id])
  submittedAt       DateTime?
  submissionLat     Float?
  submissionLng     Float?
  pdfUrl            String?

  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  @@index([orgId])
  @@index([workOrderId])
  @@index([reportTemplateId])
  @@index([filledByUserId])
}
```

**Step 4: Add relation fields to existing models**

Add `formResponses FormResponse[]` to these existing models:

- **Org model** (lines 178-252): Add `formResponses FormResponse[]` before the closing `}`
- **WorkOrder model** (lines 406-453): Add `formResponses FormResponse[]` before the closing `}`
- **Site model** (lines 345-369): Add `formResponses FormResponse[]` before the closing `}`
- **Asset model** (lines 371-404): Add `formResponses FormResponse[]` before the closing `}`
- **User model** (lines 254-292): Add `filledFormResponses FormResponse[] @relation("FilledFormResponses")` before the closing `}`
- **ReportTemplate model** (lines 652-672): Add `formResponses FormResponse[]` before the closing `}`

**Step 5: Generate and run migration**

```bash
cd Serviceops-ai
npx prisma migrate dev --name add-form-response-system
```

Expected: Migration creates FormResponse table, adds enum values. No existing tables altered (relation fields are Prisma-side only).

**Step 6: Verify**

```bash
npx prisma generate
npx tsc --noEmit
```

Expected: No TypeScript errors. Prisma client regenerated with FormResponse type.

**Step 7: Commit**

```bash
git add prisma/
git commit -m "feat: add FormResponse model and form field block types

Adds FormResponse model for custom report/form data capture.
Extends ReportBlockType enum with 13 form field types.
Adds FormResponseStatus enum (DRAFT, SUBMITTED, REVIEWED, EXPORTED).
Pure additive migration — no existing tables modified."
```

---

## Task 2: Shared TypeScript Types for Template Definitions

**Files:**
- Create: `src/lib/forms/types.ts`
- Create: `src/lib/forms/calculations.ts`

**Step 1: Create the types file**

Create `src/lib/forms/types.ts`:

```typescript
// Template definition types — shared between web builder, API, and PDF generation

export type CalcOperation = 'SUM' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE' | 'AVERAGE' | 'MIN' | 'MAX' | 'COUNT';

export interface FieldProps {
  required?: boolean;
  helpText?: string;
  // NUMERIC_INPUT
  unit?: string;
  minValue?: number;
  maxValue?: number;
  // DROPDOWN, MULTI_SELECT
  options?: string[];
  // CALCULATED
  formula?: CalcOperation;
  inputs?: string[];   // blockId references to other fields
  // PHOTO_CAPTURE
  maxPhotos?: number;
  captionRequired?: boolean;
  // INSTRUCTIONS
  content?: string;    // Read-only text content
}

export interface TemplateField {
  blockId: string;
  type: string;        // ReportBlockType enum value
  title: string;
  props: FieldProps;
  sortOrder: number;
}

export interface CoverPageSettings {
  enabled: boolean;
  showLogo: boolean;
  showCustomerName: boolean;
  subtitle: string;
}

export interface TemplateDefinition {
  version: number;
  settings: {
    requireAllFields: boolean;
    allowPhotoEvidence: boolean;
    coverPage: CoverPageSettings;
  };
  sections: TemplateField[];
}

// Field value types stored in FormResponse.data
export type PhotoValue = {
  url: string;
  caption?: string;
  gps?: { lat: number; lng: number };
}[];

export type SignatureValue = {
  url: string;
  signedBy: string;
  signedAt: string;
};

export type GpsValue = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export type FieldValue =
  | string
  | number
  | boolean
  | string[]         // MULTI_SELECT
  | PhotoValue       // PHOTO_CAPTURE
  | SignatureValue    // SIGNATURE
  | GpsValue         // GPS_CAPTURE
  | null;

export type FormResponseData = Record<string, FieldValue>;

// Input field types (non-layout, non-computed fields that techs fill out)
export const INPUT_FIELD_TYPES = [
  'TEXT_INPUT', 'TEXTAREA', 'NUMERIC_INPUT', 'YES_NO',
  'DROPDOWN', 'MULTI_SELECT', 'DATE_INPUT',
  'PHOTO_CAPTURE', 'SIGNATURE', 'GPS_CAPTURE',
] as const;

export const LAYOUT_FIELD_TYPES = ['SECTION_HEADER', 'INSTRUCTIONS'] as const;

export function isInputField(type: string): boolean {
  return (INPUT_FIELD_TYPES as readonly string[]).includes(type);
}

export function isRequiredField(field: TemplateField, globalRequireAll: boolean): boolean {
  if (!isInputField(field.type)) return false;
  return field.props.required ?? globalRequireAll;
}
```

**Step 2: Create the calculations file**

Create `src/lib/forms/calculations.ts`:

```typescript
import { CalcOperation, TemplateField, FormResponseData } from './types';

export function computeCalculatedField(
  field: TemplateField,
  data: FormResponseData
): number | null {
  const formula = field.props.formula;
  const inputIds = field.props.inputs;

  if (!formula || !inputIds || inputIds.length === 0) return null;

  const values = inputIds
    .map((id) => data[id])
    .filter((v): v is number => typeof v === 'number');

  if (values.length === 0) return null;

  switch (formula) {
    case 'SUM':
      return values.reduce((a, b) => a + b, 0);
    case 'SUBTRACT':
      return values.length >= 2 ? values[0] - values[1] : null;
    case 'MULTIPLY':
      return values.reduce((a, b) => a * b, 1);
    case 'DIVIDE':
      return values.length >= 2 && values[1] !== 0 ? values[0] / values[1] : null;
    case 'AVERAGE':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'MIN':
      return Math.min(...values);
    case 'MAX':
      return Math.max(...values);
    case 'COUNT':
      return values.length;
    default:
      return null;
  }
}

export function computeAllCalculatedFields(
  sections: TemplateField[],
  data: FormResponseData
): FormResponseData {
  const result = { ...data };
  for (const field of sections) {
    if (field.type === 'CALCULATED') {
      const value = computeCalculatedField(field, result);
      if (value !== null) {
        result[field.blockId] = Math.round(value * 100) / 100;
      }
    }
  }
  return result;
}
```

**Step 3: Create the validation file**

Create `src/lib/forms/validation.ts`:

```typescript
import { TemplateDefinition, FormResponseData, isInputField, isRequiredField } from './types';

export interface ValidationError {
  blockId: string;
  field: string;
  message: string;
}

export function validateFormResponse(
  template: TemplateDefinition,
  data: FormResponseData
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of template.sections) {
    if (!isInputField(field.type)) continue;

    const value = data[field.blockId];
    const required = isRequiredField(field, template.settings.requireAllFields);

    // Check required
    if (required && (value === null || value === undefined || value === '')) {
      errors.push({
        blockId: field.blockId,
        field: field.title,
        message: `${field.title} is required`,
      });
      continue;
    }

    // Skip further validation if empty and not required
    if (value === null || value === undefined || value === '') continue;

    // Numeric range check
    if (field.type === 'NUMERIC_INPUT' && typeof value === 'number') {
      if (field.props.minValue !== undefined && value < field.props.minValue) {
        errors.push({
          blockId: field.blockId,
          field: field.title,
          message: `${field.title} is below minimum (${field.props.minValue})`,
        });
      }
      if (field.props.maxValue !== undefined && value > field.props.maxValue) {
        errors.push({
          blockId: field.blockId,
          field: field.title,
          message: `${field.title} is above maximum (${field.props.maxValue})`,
        });
      }
    }
  }

  return errors;
}

export function getCompletionProgress(
  template: TemplateDefinition,
  data: FormResponseData
): { filled: number; total: number } {
  let filled = 0;
  let total = 0;

  for (const field of template.sections) {
    if (!isInputField(field.type)) continue;
    if (isRequiredField(field, template.settings.requireAllFields)) {
      total++;
      const value = data[field.blockId];
      if (value !== null && value !== undefined && value !== '') {
        filled++;
      }
    }
  }

  return { filled, total };
}
```

**Step 4: Create barrel export**

Create `src/lib/forms/index.ts`:

```typescript
export * from './types';
export * from './calculations';
export * from './validation';
```

**Step 5: Verify compilation**

```bash
cd Serviceops-ai && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/lib/forms/
git commit -m "feat: add shared form types, calculations, and validation

TypeScript types for template definitions and form response data.
Calculation engine for SUM, SUBTRACT, MULTIPLY, DIVIDE, AVERAGE, MIN, MAX, COUNT.
Validation with required field checks and numeric range enforcement.
Shared between web builder, API routes, and PDF generation."
```

---

## Task 3: Form Response API Routes (CRUD + Submit + PDF)

**Files:**
- Create: `src/app/api/form-responses/route.ts`
- Create: `src/app/api/form-responses/[id]/route.ts`
- Create: `src/app/api/form-responses/[id]/submit/route.ts`
- Create: `src/app/api/form-responses/[id]/pdf/route.ts`
- Create: `src/app/api/work-orders/[id]/reports/route.ts`
- Create: `src/app/api/form-templates/sync/route.ts`
- Create: `src/app/api/report-templates/[id]/publish/route.ts`

**Step 1: Create `src/app/api/form-responses/route.ts`**

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthSessionFirst } from '@/lib/auth';
import { parseJson, jsonError } from '@/lib/api-server';

// GET /api/form-responses — list responses for org
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ('error' in authResult) return authResult.error;
  const { auth } = authResult;

  const { searchParams } = new URL(request.url);
  const workOrderId = searchParams.get('workOrderId');
  const templateId = searchParams.get('templateId');
  const status = searchParams.get('status');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0'), 0);

  const where: Record<string, unknown> = { orgId: auth.orgId };
  if (workOrderId) where.workOrderId = workOrderId;
  if (templateId) where.reportTemplateId = templateId;
  if (status) where.status = status;

  const [responses, total] = await Promise.all([
    prisma.formResponse.findMany({
      where,
      include: {
        reportTemplate: { select: { id: true, name: true } },
        workOrder: { select: { id: true, workOrderNumber: true, title: true } },
        site: { select: { id: true, name: true } },
        asset: { select: { id: true, name: true } },
        filledBy: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.formResponse.count({ where }),
  ]);

  return NextResponse.json({ data: responses, total, limit, offset });
}

// POST /api/form-responses — create draft from template
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ('error' in authResult) return authResult.error;
  const { auth } = authResult;

  const body = await parseJson<{
    reportTemplateId: string;
    workOrderId?: string;
    siteId?: string;
    assetId?: string;
  }>(request);

  if (!body?.reportTemplateId) {
    return jsonError('reportTemplateId is required.', 400);
  }

  // Verify template exists and is ACTIVE
  const template = await prisma.reportTemplate.findFirst({
    where: { id: body.reportTemplateId, orgId: auth.orgId },
  });
  if (!template) return jsonError('Template not found.', 404);
  if (template.status !== 'ACTIVE') return jsonError('Template is not active.', 400);

  // Verify work order belongs to org if provided
  if (body.workOrderId) {
    const wo = await prisma.workOrder.findFirst({
      where: { id: body.workOrderId, orgId: auth.orgId },
    });
    if (!wo) return jsonError('Work order not found.', 404);
  }

  const response = await prisma.formResponse.create({
    data: {
      orgId: auth.orgId,
      reportTemplateId: body.reportTemplateId,
      workOrderId: body.workOrderId ?? null,
      siteId: body.siteId ?? null,
      assetId: body.assetId ?? null,
      data: {},
      filledByUserId: auth.userId,
    },
    include: {
      reportTemplate: { select: { id: true, name: true, definition: true } },
    },
  });

  return NextResponse.json({ data: response }, { status: 201 });
}
```

**Step 2: Create `src/app/api/form-responses/[id]/route.ts`**

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthSessionFirst } from '@/lib/auth';
import { parseJson, jsonError } from '@/lib/api-server';

// GET /api/form-responses/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ('error' in authResult) return authResult.error;
  const { auth } = authResult;

  const response = await prisma.formResponse.findFirst({
    where: { id, orgId: auth.orgId },
    include: {
      reportTemplate: { select: { id: true, name: true, definition: true, schemaVersion: true } },
      workOrder: { select: { id: true, workOrderNumber: true, title: true } },
      site: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true, serialNumber: true } },
      filledBy: { select: { id: true, name: true } },
    },
  });

  if (!response) return jsonError('Form response not found.', 404);
  return NextResponse.json({ data: response });
}

// PATCH /api/form-responses/[id] — auto-save draft data (merge, not replace)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ('error' in authResult) return authResult.error;
  const { auth } = authResult;

  const existing = await prisma.formResponse.findFirst({
    where: { id, orgId: auth.orgId },
  });
  if (!existing) return jsonError('Form response not found.', 404);
  if (existing.status !== 'DRAFT') return jsonError('Cannot edit a submitted response.', 400);

  const body = await parseJson<{ data?: Record<string, unknown> }>(request);
  if (!body?.data) return jsonError('data field is required.', 400);

  // Merge incoming data with existing (spread, not replace)
  const existingData = (existing.data as Record<string, unknown>) ?? {};
  const mergedData = { ...existingData, ...body.data };

  const updated = await prisma.formResponse.update({
    where: { id },
    data: { data: mergedData },
  });

  return NextResponse.json({ data: updated });
}

// DELETE /api/form-responses/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ('error' in authResult) return authResult.error;
  const { auth } = authResult;

  const existing = await prisma.formResponse.findFirst({
    where: { id, orgId: auth.orgId },
  });
  if (!existing) return jsonError('Form response not found.', 404);

  await prisma.formResponse.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
```

**Step 3: Create `src/app/api/form-responses/[id]/submit/route.ts`**

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthSessionFirst } from '@/lib/auth';
import { parseJson, jsonError } from '@/lib/api-server';
import { TemplateDefinition, FormResponseData } from '@/lib/forms/types';
import { computeAllCalculatedFields } from '@/lib/forms/calculations';
import { validateFormResponse } from '@/lib/forms/validation';

// POST /api/form-responses/[id]/submit
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ('error' in authResult) return authResult.error;
  const { auth } = authResult;

  const body = await parseJson<{
    submissionLat?: number;
    submissionLng?: number;
  }>(request);

  const response = await prisma.formResponse.findFirst({
    where: { id, orgId: auth.orgId },
    include: {
      reportTemplate: { select: { definition: true, schemaVersion: true } },
    },
  });

  if (!response) return jsonError('Form response not found.', 404);
  if (response.status !== 'DRAFT') return jsonError('Response already submitted.', 400);

  const template = response.reportTemplate.definition as unknown as TemplateDefinition;
  if (!template?.sections) return jsonError('Invalid template definition.', 500);

  // Server-side: recompute all calculated fields
  const rawData = response.data as unknown as FormResponseData;
  const computedData = computeAllCalculatedFields(template.sections, rawData);

  // Validate required fields
  const errors = validateFormResponse(template, computedData);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', details: errors },
      { status: 400 }
    );
  }

  // Freeze template snapshot + submit
  const submitted = await prisma.formResponse.update({
    where: { id },
    data: {
      data: computedData as object,
      templateSnapshot: response.reportTemplate.definition as object,
      status: 'SUBMITTED',
      submittedAt: new Date(),
      submissionLat: body?.submissionLat ?? null,
      submissionLng: body?.submissionLng ?? null,
    },
    include: {
      reportTemplate: { select: { id: true, name: true } },
      filledBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: submitted });
}
```

**Step 4: Create `src/app/api/work-orders/[id]/reports/route.ts`**

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthSessionFirst, requireRole } from '@/lib/auth';
import { Role } from '@prisma/client';
import { parseJson, jsonError } from '@/lib/api-server';

// GET /api/work-orders/[id]/reports — list form responses for a WO
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ('error' in authResult) return authResult.error;
  const { auth } = authResult;

  const responses = await prisma.formResponse.findMany({
    where: { workOrderId: id, orgId: auth.orgId },
    include: {
      reportTemplate: { select: { id: true, name: true } },
      filledBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: responses });
}

// POST /api/work-orders/[id]/reports — assign template to WO (creates DRAFT)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ('error' in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await parseJson<{ reportTemplateId: string }>(request);
  if (!body?.reportTemplateId) return jsonError('reportTemplateId is required.', 400);

  // Verify WO belongs to org
  const wo = await prisma.workOrder.findFirst({
    where: { id, orgId: auth.orgId },
  });
  if (!wo) return jsonError('Work order not found.', 404);

  // Verify template is ACTIVE
  const template = await prisma.reportTemplate.findFirst({
    where: { id: body.reportTemplateId, orgId: auth.orgId, status: 'ACTIVE' },
  });
  if (!template) return jsonError('Active template not found.', 404);

  const response = await prisma.formResponse.create({
    data: {
      orgId: auth.orgId,
      reportTemplateId: body.reportTemplateId,
      workOrderId: id,
      siteId: wo.siteId,
      assetId: wo.assetId,
      data: {},
      filledByUserId: auth.userId,
    },
    include: {
      reportTemplate: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: response }, { status: 201 });
}
```

**Step 5: Create `src/app/api/form-templates/sync/route.ts`**

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthSessionFirst } from '@/lib/auth';

// GET /api/form-templates/sync — all ACTIVE templates for mobile cache
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ('error' in authResult) return authResult.error;
  const { auth } = authResult;

  const templates = await prisma.reportTemplate.findMany({
    where: { orgId: auth.orgId, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      description: true,
      definition: true,
      schemaVersion: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ data: templates });
}
```

**Step 6: Create `src/app/api/report-templates/[id]/publish/route.ts`**

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthSessionFirst, requireRole } from '@/lib/auth';
import { Role } from '@prisma/client';
import { jsonError } from '@/lib/api-server';

// POST /api/report-templates/[id]/publish — set ACTIVE + bump schemaVersion
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ('error' in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN]);
  if (roleError) return roleError;

  const template = await prisma.reportTemplate.findFirst({
    where: { id, orgId: auth.orgId },
  });
  if (!template) return jsonError('Template not found.', 404);

  const updated = await prisma.reportTemplate.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      schemaVersion: template.schemaVersion + 1,
      updatedByUserId: auth.userId,
    },
  });

  return NextResponse.json({ data: updated });
}
```

**Step 7: Verify compilation**

```bash
cd Serviceops-ai && npx tsc --noEmit
```

**Step 8: Commit**

```bash
git add src/app/api/form-responses/ src/app/api/work-orders/*/reports/ src/app/api/form-templates/ src/app/api/report-templates/*/publish/
git commit -m "feat: add form response API routes

CRUD for form responses (create draft, auto-save, get, delete).
Submit endpoint with server-side validation and calculated field recomputation.
WO report assignment (dispatcher assigns template to work order).
Mobile template sync endpoint (all ACTIVE templates for org).
Template publish endpoint (set ACTIVE + bump schema version).
All routes follow existing auth + multi-tenant + envelope patterns."
```

---

## Task 4: PDF Generation — FormReportDocument

**Files:**
- Create: `src/lib/pdf/documents/FormReportDocument.tsx`
- Modify: `src/lib/pdf/pdf-generator.ts` (add 1 export function)
- Create: `src/app/api/form-responses/[id]/pdf/route.ts`

**Step 1: Create `src/lib/pdf/documents/FormReportDocument.tsx`**

```typescript
import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { colors, formatDate } from './shared-styles';

// -- Types --

interface FormReportField {
  blockId: string;
  type: string;
  title: string;
  props: {
    unit?: string;
    minValue?: number;
    maxValue?: number;
    options?: string[];
    content?: string;
  };
}

export interface FormReportData {
  // Cover page
  orgName: string;
  orgLogoUrl?: string;
  reportTitle: string;
  subtitle?: string;
  customerName?: string;
  siteName?: string;
  assetName?: string;
  assetSerial?: string;
  workOrderNumber?: string;
  techName: string;
  submittedAt: string;
  // Template
  coverPageEnabled: boolean;
  sections: FormReportField[];
  // Response data
  data: Record<string, unknown>;
}

// -- Styles --

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.4,
  },
  // Cover page
  coverPage: {
    padding: 40,
    fontFamily: 'Helvetica',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  coverLogo: {
    width: 120,
    height: 120,
    marginBottom: 30,
    objectFit: 'contain',
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 40,
    textAlign: 'center',
  },
  coverInfoBlock: {
    marginBottom: 6,
    flexDirection: 'row',
  },
  coverLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.muted,
    width: 120,
    textAlign: 'right',
    marginRight: 12,
  },
  coverValue: {
    fontSize: 11,
    color: colors.text,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    color: colors.muted,
  },
  // Section header
  sectionHeader: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    paddingBottom: 4,
    marginTop: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Field row
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  fieldRowAlt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  fieldLabel: {
    fontSize: 10,
    color: colors.muted,
    width: '45%',
  },
  fieldValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
    width: '50%',
    textAlign: 'right',
  },
  specText: {
    fontSize: 8,
    color: colors.muted,
    textAlign: 'right',
  },
  inSpec: {
    fontSize: 8,
    color: '#10b981',
    textAlign: 'right',
  },
  outOfSpec: {
    fontSize: 8,
    color: '#ef4444',
    textAlign: 'right',
  },
  // Photo
  photoSection: {
    marginVertical: 8,
  },
  photoImage: {
    width: 200,
    height: 150,
    objectFit: 'cover',
    marginBottom: 4,
    borderRadius: 4,
  },
  photoCaption: {
    fontSize: 8,
    color: colors.muted,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  // Signature
  signatureImage: {
    width: 200,
    height: 60,
    objectFit: 'contain',
    marginVertical: 4,
  },
  signatureInfo: {
    fontSize: 9,
    color: colors.muted,
  },
  // Textarea / long text
  longText: {
    fontSize: 10,
    color: colors.text,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  longTextLabel: {
    fontSize: 10,
    color: colors.muted,
    marginBottom: 2,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#d1d5db',
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: colors.muted,
  },
});

// -- Helper Components --

function CoverPage({ data }: { data: FormReportData }) {
  return (
    <Page size="LETTER" style={s.coverPage}>
      {data.orgLogoUrl && <Image src={data.orgLogoUrl} style={s.coverLogo} />}
      <Text style={s.coverTitle}>{data.reportTitle}</Text>
      {data.subtitle && <Text style={s.coverSubtitle}>{data.subtitle}</Text>}

      <View style={{ marginTop: 20 }}>
        {data.customerName && (
          <View style={s.coverInfoBlock}>
            <Text style={s.coverLabel}>Customer:</Text>
            <Text style={s.coverValue}>{data.customerName}</Text>
          </View>
        )}
        {data.siteName && (
          <View style={s.coverInfoBlock}>
            <Text style={s.coverLabel}>Site:</Text>
            <Text style={s.coverValue}>{data.siteName}</Text>
          </View>
        )}
        {data.assetName && (
          <View style={s.coverInfoBlock}>
            <Text style={s.coverLabel}>Asset:</Text>
            <Text style={s.coverValue}>
              {data.assetName}{data.assetSerial ? ` (SN: ${data.assetSerial})` : ''}
            </Text>
          </View>
        )}
        {data.workOrderNumber && (
          <View style={s.coverInfoBlock}>
            <Text style={s.coverLabel}>Work Order:</Text>
            <Text style={s.coverValue}>{data.workOrderNumber}</Text>
          </View>
        )}
        <View style={s.coverInfoBlock}>
          <Text style={s.coverLabel}>Technician:</Text>
          <Text style={s.coverValue}>{data.techName}</Text>
        </View>
        <View style={s.coverInfoBlock}>
          <Text style={s.coverLabel}>Date:</Text>
          <Text style={s.coverValue}>{formatDate(data.submittedAt)}</Text>
        </View>
      </View>

      <Text style={s.coverFooter}>{data.orgName}</Text>
    </Page>
  );
}

function FieldRow({
  field,
  value,
  index,
}: {
  field: FormReportField;
  value: unknown;
  index: number;
}) {
  const rowStyle = index % 2 === 1 ? s.fieldRowAlt : s.fieldRow;

  switch (field.type) {
    case 'SECTION_HEADER':
      return <Text style={s.sectionHeader}>{field.title}</Text>;

    case 'INSTRUCTIONS':
      return null;

    case 'TEXTAREA': {
      const textVal = value != null ? String(value) : '—';
      return (
        <View style={s.longText}>
          <Text style={s.longTextLabel}>{field.title}</Text>
          <Text>{textVal}</Text>
        </View>
      );
    }

    case 'YES_NO':
      return (
        <View style={rowStyle}>
          <Text style={s.fieldLabel}>{field.title}</Text>
          <Text style={s.fieldValue}>
            {value === true ? '\u2713 YES' : value === false ? '\u2717 NO' : '\u2014'}
          </Text>
        </View>
      );

    case 'NUMERIC_INPUT': {
      const numVal = typeof value === 'number' ? value : null;
      const unit = field.props.unit ?? '';
      const hasSpec = field.props.minValue != null || field.props.maxValue != null;
      const inSpec = numVal != null && hasSpec
        ? (field.props.minValue == null || numVal >= field.props.minValue) &&
          (field.props.maxValue == null || numVal <= field.props.maxValue)
        : null;

      return (
        <View style={rowStyle}>
          <Text style={s.fieldLabel}>{field.title}</Text>
          <View style={{ width: '50%', alignItems: 'flex-end' }}>
            <Text style={s.fieldValue}>
              {numVal != null ? `${numVal} ${unit}` : '\u2014'}
            </Text>
            {hasSpec && (
              <Text style={s.specText}>
                Spec: {field.props.minValue ?? '—'}–{field.props.maxValue ?? '—'} {unit}
              </Text>
            )}
            {inSpec !== null && (
              <Text style={inSpec ? s.inSpec : s.outOfSpec}>
                {inSpec ? '\u2713 Within spec' : '\u2717 Out of spec'}
              </Text>
            )}
          </View>
        </View>
      );
    }

    case 'CALCULATED': {
      const calcVal = typeof value === 'number' ? value : null;
      const calcUnit = field.props.unit ?? '';
      return (
        <View style={rowStyle}>
          <Text style={s.fieldLabel}>{field.title}</Text>
          <View style={{ width: '50%', alignItems: 'flex-end' }}>
            <Text style={s.fieldValue}>
              {calcVal != null ? `${calcVal} ${calcUnit}` : '\u2014'}
            </Text>
            <Text style={s.specText}>(calculated)</Text>
          </View>
        </View>
      );
    }

    case 'MULTI_SELECT': {
      const selected = Array.isArray(value) ? value.join(', ') : '\u2014';
      return (
        <View style={rowStyle}>
          <Text style={s.fieldLabel}>{field.title}</Text>
          <Text style={s.fieldValue}>{selected}</Text>
        </View>
      );
    }

    case 'DATE_INPUT':
      return (
        <View style={rowStyle}>
          <Text style={s.fieldLabel}>{field.title}</Text>
          <Text style={s.fieldValue}>
            {typeof value === 'string' ? formatDate(value) : '\u2014'}
          </Text>
        </View>
      );

    case 'PHOTO_CAPTURE': {
      const photos = Array.isArray(value) ? value : [];
      if (photos.length === 0) return null;
      return (
        <View style={s.photoSection}>
          <Text style={s.longTextLabel}>{field.title}</Text>
          {photos.map((photo: { url?: string; caption?: string }, i: number) => (
            <View key={i}>
              {photo.url && <Image src={photo.url} style={s.photoImage} />}
              {photo.caption && <Text style={s.photoCaption}>{photo.caption}</Text>}
            </View>
          ))}
        </View>
      );
    }

    case 'SIGNATURE': {
      const sig = value as { url?: string; signedBy?: string; signedAt?: string } | null;
      if (!sig?.url) return null;
      return (
        <View style={s.photoSection}>
          <Text style={s.longTextLabel}>{field.title}</Text>
          <Image src={sig.url} style={s.signatureImage} />
          <Text style={s.signatureInfo}>
            {sig.signedBy ?? 'Unknown'} {'\u00B7'} {sig.signedAt ? formatDate(sig.signedAt) : ''}
          </Text>
        </View>
      );
    }

    case 'GPS_CAPTURE': {
      const gps = value as { lat?: number; lng?: number } | null;
      const gpsStr = gps?.lat != null ? `${gps.lat.toFixed(6)}, ${gps.lng?.toFixed(6)}` : '\u2014';
      return (
        <View style={rowStyle}>
          <Text style={s.fieldLabel}>{field.title}</Text>
          <Text style={s.fieldValue}>{gpsStr}</Text>
        </View>
      );
    }

    default: {
      // TEXT_INPUT, DROPDOWN, and any unknown types
      const strVal = value != null ? String(value) : '\u2014';
      return (
        <View style={rowStyle}>
          <Text style={s.fieldLabel}>{field.title}</Text>
          <Text style={s.fieldValue}>{strVal}</Text>
        </View>
      );
    }
  }
}

// -- Main Document --

export function FormReportDocument({ data }: { data: FormReportData }) {
  let fieldIndex = 0;

  return (
    <Document>
      {data.coverPageEnabled && <CoverPage data={data} />}

      <Page size="LETTER" style={s.page}>
        {!data.coverPageEnabled && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: colors.primary }}>
              {data.reportTitle}
            </Text>
            <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>
              {data.techName} {'\u00B7'} {formatDate(data.submittedAt)}
              {data.workOrderNumber ? ` \u00B7 ${data.workOrderNumber}` : ''}
            </Text>
          </View>
        )}

        {data.sections.map((field) => {
          if (field.type !== 'SECTION_HEADER' && field.type !== 'INSTRUCTIONS') {
            fieldIndex++;
          }
          return (
            <FieldRow
              key={field.blockId}
              field={field}
              value={data.data[field.blockId]}
              index={fieldIndex}
            />
          );
        })}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {data.orgName}
            {data.workOrderNumber ? ` \u00B7 ${data.workOrderNumber}` : ''}
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Page ${pageNumber}${data.coverPageEnabled ? ' ' : ''} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
```

**Step 2: Add generator function to `src/lib/pdf/pdf-generator.ts`**

After the existing exports (line ~47), add:

```typescript
import { FormReportDocument, FormReportData } from './documents/FormReportDocument';

export type { FormReportData };

export async function generateFormReportPdf(data: FormReportData): Promise<Buffer> {
  return render(<FormReportDocument data={data} />);
}
```

And add `FormReportDocument` to the React import if not already destructured, and ensure `render` helper is available (it already is in the existing file).

**Step 3: Create `src/app/api/form-responses/[id]/pdf/route.ts`**

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthSessionFirst, requireRole } from '@/lib/auth';
import { Role } from '@prisma/client';
import { jsonError } from '@/lib/api-server';
import { generateFormReportPdf } from '@/lib/pdf/pdf-generator';
import { TemplateDefinition } from '@/lib/forms/types';
import type { FormReportData } from '@/lib/pdf/pdf-generator';

// POST /api/form-responses/[id]/pdf — generate branded PDF
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ('error' in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const response = await prisma.formResponse.findFirst({
    where: { id, orgId: auth.orgId },
    include: {
      reportTemplate: true,
      workOrder: { select: { workOrderNumber: true } },
      site: { select: { name: true } },
      asset: { select: { name: true, serialNumber: true } },
      filledBy: { select: { name: true } },
    },
  });
  if (!response) return jsonError('Form response not found.', 404);
  if (response.status === 'DRAFT') return jsonError('Cannot generate PDF for draft.', 400);

  const org = await prisma.org.findUnique({
    where: { id: auth.orgId },
    select: { name: true, logoUrl: true },
  });

  // Use templateSnapshot if available, otherwise current template definition
  const templateDef = (response.templateSnapshot ?? response.reportTemplate.definition) as unknown as TemplateDefinition;

  // Resolve customer name from work order if linked
  let customerName: string | undefined;
  if (response.workOrderId) {
    const wo = await prisma.workOrder.findFirst({
      where: { id: response.workOrderId },
      include: { customer: { select: { name: true } } },
    });
    customerName = wo?.customer?.name ?? undefined;
  }

  const pdfData: FormReportData = {
    orgName: org?.name ?? 'Organization',
    orgLogoUrl: org?.logoUrl ?? undefined,
    reportTitle: response.reportTemplate.name,
    subtitle: templateDef.settings?.coverPage?.subtitle,
    customerName,
    siteName: response.site?.name ?? undefined,
    assetName: response.asset?.name ?? undefined,
    assetSerial: response.asset?.serialNumber ?? undefined,
    workOrderNumber: response.workOrder?.workOrderNumber ?? undefined,
    techName: response.filledBy?.name ?? 'Unknown',
    submittedAt: response.submittedAt?.toISOString() ?? response.updatedAt.toISOString(),
    coverPageEnabled: templateDef.settings?.coverPage?.enabled ?? false,
    sections: templateDef.sections ?? [],
    data: (response.data as Record<string, unknown>) ?? {},
  };

  try {
    const pdfBuffer = await generateFormReportPdf(pdfData);

    // Update pdfUrl status
    await prisma.formResponse.update({
      where: { id },
      data: { status: 'EXPORTED' },
    });

    const filename = `Report-${response.reportTemplate.name.replace(/\s+/g, '-')}-${id.slice(0, 8)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer) as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return jsonError('Failed to generate PDF.', 500);
  }
}
```

**Step 4: Verify compilation**

```bash
cd Serviceops-ai && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/lib/pdf/documents/FormReportDocument.tsx src/lib/pdf/pdf-generator.ts src/app/api/form-responses/*/pdf/
git commit -m "feat: add branded PDF generation for custom form reports

FormReportDocument with cover page, field-type rendering, and org branding.
Handles all 13 field types: text, numeric with specs, yes/no, photos, signatures, etc.
PDF route validates submission status, resolves customer/site/asset data, streams binary.
Follows existing @react-pdf/renderer patterns and shared color scheme."
```

---

## Task 5: Web App — Template Builder UI

**Files:**
- Create: `src/app/(app)/reports/templates/[id]/builder/page.tsx`
- Create: `src/app/(app)/reports/templates/[id]/builder/BuilderCanvas.tsx`
- Create: `src/app/(app)/reports/templates/[id]/builder/FieldCard.tsx`
- Create: `src/app/(app)/reports/templates/[id]/builder/PropertiesPanel.tsx`
- Create: `src/app/(app)/reports/templates/[id]/builder/AddFieldModal.tsx`
- Create: `src/app/(app)/reports/templates/[id]/builder/TemplateSettings.tsx`
- Create: `src/app/(app)/reports/templates/[id]/builder/builder.css`
- Create: `src/app/(app)/reports/templates/[id]/builder/types.ts`

This is the largest task. Each file is a focused component. Build them in order — types first, then page, then child components.

**Step 1: Create `types.ts`** — re-export from shared lib

```typescript
export type { TemplateDefinition, TemplateField, FieldProps, CoverPageSettings } from '@/lib/forms/types';
```

**Step 2: Create `builder.css`** — use project CSS variable patterns

Follow existing CSS patterns from `src/app/(app)/reports/reports.css` and other page CSS files. Use custom properties, not Tailwind. Key classes needed:
- `.builder-layout` — two-column flexbox (canvas 60% + panel 40%)
- `.builder-header` — top bar with template name, status, save/publish buttons
- `.canvas` — scrollable field list
- `.field-card` — draggable card with grip handle, icon, label, type badge
- `.field-card--selected` — highlighted border for selected field
- `.field-card--dragging` — opacity reduction during drag
- `.properties-panel` — right sidebar with field settings
- `.add-field-modal` — modal overlay with field type grid
- `.field-type-grid` — 3-column grid of type picker buttons
- `.field-type-button` — icon + label for each type

**Step 3: Create `page.tsx`** — server component, fetches template, renders builder

```typescript
import { apiFetch } from '@/lib/api';
import { BuilderCanvas } from './BuilderCanvas';
import './builder.css';

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Template data fetched client-side in BuilderCanvas for real-time editing
  return <BuilderCanvas templateId={id} />;
}
```

**Step 4: Create `BuilderCanvas.tsx`** — main client component

This is the core "use client" component that:
- Fetches template definition on mount via `GET /api/report-templates/[id]`
- Maintains local state for `definition: TemplateDefinition`
- Handles drag-and-drop reordering (HTML5 drag API)
- Manages selected field state
- Auto-saves definition on change via debounced `PATCH /api/report-templates/[id]`
- Renders FieldCard list, PropertiesPanel, AddFieldModal, TemplateSettings
- Provides Save (manual persist) and Publish (POST to `/publish` endpoint) buttons

Key state:
```typescript
const [definition, setDefinition] = useState<TemplateDefinition | null>(null);
const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
const [showAddModal, setShowAddModal] = useState(false);
const [isSaving, setIsSaving] = useState(false);
```

**Step 5: Create `FieldCard.tsx`** — single field row in canvas

Props: `{ field: TemplateField, isSelected: boolean, onSelect, onDragStart, onDragOver, onDrop }`

Renders: drag handle icon, field type icon/badge, title, key props summary (e.g., "Required", "100-200 °F"), delete button.

**Step 6: Create `PropertiesPanel.tsx`** — right sidebar

Props: `{ field: TemplateField | null, allFields: TemplateField[], onChange: (updated: TemplateField) => void }`

Renders context-sensitive form based on `field.type`:
- All types: Label input, Help Text input, Required checkbox
- NUMERIC_INPUT: Unit, Min, Max inputs
- DROPDOWN/MULTI_SELECT: Options list with add/remove
- CALCULATED: Operation dropdown + field reference pickers (filtered to numeric fields)
- PHOTO_CAPTURE: Max photos input, Caption required checkbox
- INSTRUCTIONS: Content textarea

**Step 7: Create `AddFieldModal.tsx`** — field type picker

Categorized grid:
- Input Fields: Text, Textarea, Number, Yes/No, Dropdown, Multi-Select, Date
- Capture Fields: Photo, Signature, GPS
- Layout & Computed: Section Header, Instructions, Calculated

Each button click: generates UUID for blockId, creates default TemplateField, adds to definition, closes modal, selects new field.

**Step 8: Create `TemplateSettings.tsx`** — template-level settings

Renders: Cover Page toggle + sub-settings (show logo, show customer, subtitle), Require All Fields toggle.

**Step 9: Verify compilation and test manually**

```bash
cd Serviceops-ai && npx tsc --noEmit
npm run build
```

Navigate to `/reports/templates/[id]/builder` to verify page loads.

**Step 10: Commit**

```bash
git add src/app/\(app\)/reports/templates/\[id\]/builder/
git commit -m "feat: add template builder UI for custom report forms

Two-panel builder: canvas with drag-and-drop field reordering + properties panel.
Supports all 13 field types with context-sensitive settings.
Add Field modal with categorized type picker grid.
Template settings for cover page and global options.
Auto-save definition on changes. Publish sets ACTIVE + bumps schema version."
```

---

## Task 6: Web App — Form Responses Management Pages

**Files:**
- Create: `src/app/(app)/reports/responses/page.tsx` — list all responses
- Create: `src/app/(app)/reports/responses/[id]/page.tsx` — view submitted response + export PDF
- Create: `src/app/(app)/reports/responses/responses.css`

**Step 1: Create responses list page**

Table view showing all form responses for the org:
- Columns: Report Name, Work Order, Status, Filled By, Submitted Date, Actions
- Filters: status dropdown, template dropdown
- Actions: View, Export PDF (for SUBMITTED+), Delete (for DRAFT only)

**Step 2: Create response detail page**

Read-only view of a submitted response:
- Template name + metadata header
- Renders all fields with their values (similar to PDF but in HTML)
- "Export PDF" button (calls POST `/api/form-responses/[id]/pdf`, triggers download)
- Status badge (DRAFT/SUBMITTED/REVIEWED/EXPORTED)

**Step 3: Add link from templates list page**

Add a "Responses" nav link to the reports section so admins can find it.

**Step 4: Verify and commit**

```bash
cd Serviceops-ai && npx tsc --noEmit && npm run build
git add src/app/\(app\)/reports/responses/
git commit -m "feat: add form responses list and detail pages

Admin/dispatcher can view all submitted form responses.
Detail page shows read-only form data with Export PDF button.
Status filtering and template filtering on list page."
```

---

## Task 7: Mobile App — SQLite Schema + Sync for Forms

**Files:**
- Modify: `serviceops-mobile/src/db/schema.ts` (add version 3 migration)
- Create: `serviceops-mobile/src/lib/db/form-queries.ts`
- Modify: `serviceops-mobile/src/db/sync-engine.ts` (add form sync operations)

**Step 1: Add SQLite migration**

In `src/db/schema.ts`, bump `CURRENT_VERSION` to 3 and add migration:

```typescript
export const CURRENT_VERSION = 3;

// Add to migrations object:
3: [
  `CREATE TABLE IF NOT EXISTS form_templates (
    id TEXT PRIMARY KEY NOT NULL,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    definition TEXT NOT NULL,
    schema_version INTEGER DEFAULT 1,
    updated_at INTEGER,
    synced_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS form_responses (
    id TEXT PRIMARY KEY NOT NULL,
    org_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    work_order_id TEXT,
    site_id TEXT,
    asset_id TEXT,
    data TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    submitted_at INTEGER,
    submission_lat REAL,
    submission_lng REAL,
    updated_at INTEGER NOT NULL,
    synced_at INTEGER,
    FOREIGN KEY (template_id) REFERENCES form_templates(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_form_responses_template ON form_responses(template_id)`,
  `CREATE INDEX IF NOT EXISTS idx_form_responses_wo ON form_responses(work_order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_form_responses_status ON form_responses(status)`,
],
```

**Step 2: Create `form-queries.ts`** — SQLite CRUD

Following the same pattern as existing `queries.ts`:

```typescript
// Functions needed:
export async function getAllFormTemplates(): Promise<FormTemplate[]>
export async function upsertFormTemplate(template: FormTemplate): Promise<void>
export async function getFormResponse(id: string): Promise<FormResponse | null>
export async function getFormResponsesForWO(woId: string): Promise<FormResponse[]>
export async function upsertFormResponse(response: FormResponse): Promise<void>
export async function deleteFormResponse(id: string): Promise<void>
```

**Step 3: Add form sync to sync-engine.ts**

In the sync engine's queue processing, form responses already go through the generic `sync_queue` table (endpoint + method + payload). No structural changes needed — the queue is generic.

Add a template sync function that runs periodically:

```typescript
// Add to SyncEngine class:
async syncFormTemplates() {
  try {
    const response = await apiClient.request('GET', '/api/form-templates/sync');
    const templates = response?.data ?? [];
    for (const t of templates) {
      await upsertFormTemplate({
        id: t.id,
        org_id: t.orgId ?? '',
        name: t.name,
        definition: JSON.stringify(t.definition),
        schema_version: t.schemaVersion,
        updated_at: new Date(t.updatedAt).getTime(),
        synced_at: Date.now(),
      });
    }
  } catch {
    // Silently fail — templates will sync next cycle
  }
}
```

Call this in the main sync loop alongside existing operations.

**Step 4: Verify and commit**

```bash
cd serviceops-mobile && npx tsc --noEmit
git add src/db/schema.ts src/lib/db/form-queries.ts src/db/sync-engine.ts
git commit -m "feat: add SQLite schema and sync for custom form system

Migration v3: form_templates and form_responses tables.
CRUD queries for local form data.
Template sync from server on each sync cycle.
Form responses queue through existing sync_queue mechanism."
```

---

## Task 8: Mobile App — Zustand Store + Hooks

**Files:**
- Create: `serviceops-mobile/src/store/forms-store.ts`
- Create: `serviceops-mobile/src/hooks/useFormTemplates.ts`
- Create: `serviceops-mobile/src/hooks/useFormResponse.ts`
- Create: `serviceops-mobile/src/hooks/useFormAutoSave.ts`

**Step 1: Create `forms-store.ts`**

Follow the exact pattern from `tasks-store.ts`:
- State: `templates: FormTemplate[]`, `responses: Map<string, FormResponse[]>`, `currentResponse: FormResponse | null`
- Actions: `fetchTemplates()`, `fetchResponsesForWO(woId)`, `createResponse(templateId, woId?, siteId?, assetId?)`, `updateResponseData(responseId, fieldId, value)`, `submitResponse(responseId, lat?, lng?)`
- Pattern: optimistic update → API call → sync queue fallback

**Step 2: Create `useFormTemplates.ts`**

```typescript
// Fetches ACTIVE templates from API with SQLite fallback
// Returns { templates, isLoading, error, refresh }
```

**Step 3: Create `useFormResponse.ts`**

```typescript
// Manages a single form response: loads data, provides update function
// Returns { response, template, updateField, isLoading, error }
// updateField(blockId, value) → local state + triggers auto-save
```

**Step 4: Create `useFormAutoSave.ts`**

```typescript
// Debounced save (5 second delay after last change)
// Saves to SQLite immediately, debounces API PATCH
// Returns { isSaving, lastSaved }
```

**Step 5: Verify and commit**

```bash
cd serviceops-mobile && npx tsc --noEmit
git add src/store/forms-store.ts src/hooks/useFormTemplates.ts src/hooks/useFormResponse.ts src/hooks/useFormAutoSave.ts
git commit -m "feat: add Zustand store and hooks for mobile form system

Forms store with API-first + SQLite fallback pattern.
useFormTemplates: fetch active templates with offline cache.
useFormResponse: load/update single form response.
useFormAutoSave: debounced 5s auto-save to API with SQLite persistence."
```

---

## Task 9: Mobile App — Form Components

**Files:**
- Create: `serviceops-mobile/src/components/form/DynamicFormRenderer.tsx`
- Create: `serviceops-mobile/src/components/form/FormFieldRenderer.tsx`
- Create: `serviceops-mobile/src/components/form/DropdownField.tsx`
- Create: `serviceops-mobile/src/components/form/MultiSelectField.tsx`
- Create: `serviceops-mobile/src/components/form/DateField.tsx`
- Create: `serviceops-mobile/src/components/form/CalculatedField.tsx`
- Create: `serviceops-mobile/src/components/form/FormProgress.tsx`
- Create: `serviceops-mobile/src/components/form/FormAutoSaveIndicator.tsx`

**Step 1: Create `DynamicFormRenderer.tsx`**

Props: `{ template: TemplateDefinition, data: FormResponseData, onFieldChange: (blockId, value) => void }`

Maps over `template.sections`, renders each via `FormFieldRenderer`. Wraps in `ScrollView` + `KeyboardAvoidingView`.

**Step 2: Create `FormFieldRenderer.tsx`**

Switch on `field.type` → dispatch to correct component:
- TEXT_INPUT → `TextInput`
- TEXTAREA → `TextInput multiline`
- NUMERIC_INPUT → reuse existing `MeasurementInput` (from `src/components/MeasurementInput.tsx`)
- YES_NO → two toggle buttons (reuse existing pass/fail pattern)
- DROPDOWN → `DropdownField`
- MULTI_SELECT → `MultiSelectField`
- DATE_INPUT → `DateField`
- PHOTO_CAPTURE → reuse existing `PhotoCapture` modal
- SIGNATURE → reuse existing signature pad
- GPS_CAPTURE → auto-capture button using existing location lib
- SECTION_HEADER → styled `Text` divider
- INSTRUCTIONS → styled read-only `Text`
- CALCULATED → `CalculatedField` (read-only, auto-computed)

**Step 3-6: Create individual field components**

Each is a focused component (~50-100 lines):
- `DropdownField`: ActionSheet or scrollable picker modal
- `MultiSelectField`: Checkbox list with toggle state
- `DateField`: DateTimePicker modal wrapper
- `CalculatedField`: Read-only display + auto-recompute on dependency changes

**Step 7: Create `FormProgress.tsx`**

Shows "4/12 required fields complete" with progress bar. Uses `getCompletionProgress()` from shared validation lib.

**Step 8: Create `FormAutoSaveIndicator.tsx`**

Shows "Auto-saved 30s ago" / "Saving..." / "Offline — saved locally". Props from `useFormAutoSave` hook.

**Step 9: Verify and commit**

```bash
cd serviceops-mobile && npx tsc --noEmit
git add src/components/form/
git commit -m "feat: add dynamic form renderer and field components for mobile

DynamicFormRenderer: maps template sections to field components.
FormFieldRenderer: type-switch dispatching to 13 field types.
Reuses existing MeasurementInput, PhotoCapture, SignaturePad.
New: DropdownField, MultiSelectField, DateField, CalculatedField.
FormProgress bar and AutoSaveIndicator status display."
```

---

## Task 10: Mobile App — Screens (Reports Tab + Form Filler)

**Files:**
- Create: `serviceops-mobile/src/app/(tabs)/work-orders/[id]/reports.tsx`
- Create: `serviceops-mobile/src/app/(tabs)/reports/index.tsx`
- Create: `serviceops-mobile/src/app/(tabs)/reports/new.tsx`
- Create: `serviceops-mobile/src/app/(tabs)/reports/[responseId].tsx`
- Modify: `serviceops-mobile/src/app/(tabs)/work-orders/[id]/index.tsx` (add Reports to action grid)

**Step 1: Create `reports.tsx`** — Reports tab on WO detail

Lists form responses for this WO:
- Card per response showing template name, status badge, progress
- "Continue Filling" or "Start Report" button per card
- "+ Add Report" button at bottom (opens template picker)
- Navigates to form filler screen

**Step 2: Create `reports/index.tsx`** — Standalone reports list

Lists all form responses for the current user:
- Filter by status (All, Draft, Submitted)
- Card per response
- "New Report" FAB button

**Step 3: Create `reports/new.tsx`** — New standalone report

Template picker → site picker → optional asset picker → create.

**Step 4: Create `reports/[responseId].tsx`** — Form filler screen

The core form filling experience:
- Loads template + response data
- Renders `DynamicFormRenderer`
- Auto-save indicator in header
- Progress bar at bottom
- Submit button with validation
- Handles offline gracefully

**Step 5: Add Reports to WO action grid**

In `serviceops-mobile/src/app/(tabs)/work-orders/[id]/index.tsx`, add to the `actionItems` array (around line 81-105):

```typescript
{
  label: 'Reports',
  icon: FileText,  // from lucide-react-native
  color: '#6366f1',
  route: `/work-orders/${id}/reports`,
},
```

Add `FileText` to the lucide-react-native import at the top of the file.

**Step 6: Verify and commit**

```bash
cd serviceops-mobile && npx tsc --noEmit
git add src/app/\(tabs\)/work-orders/\[id\]/reports.tsx src/app/\(tabs\)/reports/ src/app/\(tabs\)/work-orders/\[id\]/index.tsx
git commit -m "feat: add mobile screens for form reports

Reports tab on WO detail with assigned report cards.
Standalone reports list and new report creation flow.
Form filler screen with DynamicFormRenderer and auto-save.
Reports added to WO action grid navigation."
```

---

## Task 11: Integration Testing + Verification

**Step 1: Run web app build**

```bash
cd Serviceops-ai && npm run build
```

Expected: Clean build, no errors.

**Step 2: Run existing tests**

```bash
cd Serviceops-ai && npx vitest run
```

Expected: All 55 existing tests pass. No regressions.

**Step 3: Run mobile TypeScript check**

```bash
cd serviceops-mobile && npx tsc --noEmit
```

Expected: Zero errors.

**Step 4: Manual smoke test checklist**

Web app:
- [ ] Navigate to `/reports/templates` — see list
- [ ] Create new template — redirects to builder
- [ ] Add fields in builder — drag to reorder
- [ ] Save and Publish template
- [ ] Navigate to `/reports/responses` — see list (empty)

API (via curl or browser):
- [ ] `GET /api/form-templates/sync` returns ACTIVE templates
- [ ] `POST /api/form-responses` creates a draft
- [ ] `PATCH /api/form-responses/[id]` saves field data
- [ ] `POST /api/form-responses/[id]/submit` validates and submits
- [ ] `POST /api/form-responses/[id]/pdf` generates PDF

Mobile (via Expo):
- [ ] WO detail shows Reports in action grid
- [ ] Reports tab shows assigned reports
- [ ] Form filler renders fields from template
- [ ] Auto-save works (close and reopen maintains data)
- [ ] Submit validates required fields
- [ ] Offline: data persists in SQLite

**Step 5: Final commit**

```bash
git commit -m "chore: verify custom report/form system integration

All existing tests pass. Build clean. Mobile TypeScript clean.
Manual smoke test completed for web builder, API routes, mobile filler."
```

---

## Deployment Order

1. **Schema + API + Types** (Tasks 1-3) → Deploy backend to Vercel + run migration on Supabase
2. **PDF Generation** (Task 4) → Deploy, verify PDF endpoint works
3. **Web Builder UI** (Tasks 5-6) → Deploy, admins can create templates
4. **Mobile Foundation** (Tasks 7-8) → Build with EAS, test on device
5. **Mobile Components + Screens** (Tasks 9-10) → Final EAS build
6. **Integration Testing** (Task 11) → Verify end-to-end

Each deployment step is independently functional. Roll back any step without affecting the others.
