# Custom Report/Form System — Design Document

**Date**: 2026-03-06
**Status**: Approved
**Approach**: Extend existing ReportTemplate (JSON definition) + new FormResponse model

---

## Requirements Summary

- **Field types**: Full set — core (text, number, yes/no, dropdown, date, photo, signature) + advanced (multi-select, section headers, instructions, GPS) + calculated fields
- **WO linkage**: Both WO-linked (dispatcher assigns) and standalone (tech creates in field)
- **PDF branding**: Org logo/info on every page + optional cover page
- **Save behavior**: Auto-save drafts to SQLite, sync when online

---

## 1. Data Model

### Existing Models (no changes to structure)

**ReportTemplate** — container for form definitions:
- `id`, `orgId`, `name`, `description`, `status` (DRAFT/ACTIVE/ARCHIVED)
- `schemaVersion` (Int) — incremented on publish
- `definition` (JSON) — full template schema (sections + fields)
- `createdByUserId`, `updatedByUserId`

**ReportBlock** — kept for backward compatibility but NOT used by the form builder. Form builder reads/writes `ReportTemplate.definition` exclusively.

### New Enum Values: ReportBlockType

Add to existing enum:
```
TEXT_INPUT, TEXTAREA, NUMERIC_INPUT, YES_NO, DROPDOWN, MULTI_SELECT,
DATE_INPUT, PHOTO_CAPTURE, SIGNATURE, GPS_CAPTURE, SECTION_HEADER,
INSTRUCTIONS, CALCULATED
```

### New Model: FormResponse

```prisma
model FormResponse {
  id                String             @id @default(uuid()) @db.Uuid
  orgId             String             @db.Uuid
  org               Org                @relation(fields: [orgId], references: [id])

  reportTemplateId  String             @db.Uuid
  reportTemplate    ReportTemplate     @relation(fields: [reportTemplateId], references: [id])
  templateSnapshot  Json               // Frozen template definition at submission

  workOrderId       String?            @db.Uuid
  workOrder         WorkOrder?         @relation(fields: [workOrderId], references: [id])
  siteId            String?            @db.Uuid
  site              Site?              @relation(fields: [siteId], references: [id])
  assetId           String?            @db.Uuid
  asset             Asset?             @relation(fields: [assetId], references: [id])

  data              Json               // All field values: { blockId: value }
  status            FormResponseStatus @default(DRAFT)

  filledByUserId    String             @db.Uuid
  filledBy          User               @relation(fields: [filledByUserId], references: [id])
  submittedAt       DateTime?
  submissionLat     Float?
  submissionLng     Float?
  pdfUrl            String?

  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  @@index([orgId])
  @@index([workOrderId])
  @@index([reportTemplateId])
}

enum FormResponseStatus {
  DRAFT
  SUBMITTED
  REVIEWED
  EXPORTED
}
```

### Template Definition JSON Structure

```typescript
interface TemplateDefinition {
  version: number;
  settings: {
    requireAllFields: boolean;
    allowPhotoEvidence: boolean;
    coverPage: {
      enabled: boolean;
      showLogo: boolean;
      showCustomerName: boolean;
      subtitle: string;
    };
  };
  sections: TemplateField[];
}

interface TemplateField {
  blockId: string;        // UUID for this field
  type: ReportBlockType;  // Field type enum value
  title: string;          // Label shown to tech
  props: {
    required?: boolean;
    helpText?: string;
    unit?: string;            // NUMERIC_INPUT
    minValue?: number;        // NUMERIC_INPUT
    maxValue?: number;        // NUMERIC_INPUT
    options?: string[];       // DROPDOWN, MULTI_SELECT
    formula?: CalcOperation;  // CALCULATED
    inputs?: string[];        // CALCULATED — blockId references
    maxPhotos?: number;       // PHOTO_CAPTURE
    captionRequired?: boolean;// PHOTO_CAPTURE
  };
  sortOrder: number;
}

type CalcOperation = 'SUM' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE' | 'AVERAGE' | 'MIN' | 'MAX' | 'COUNT';
```

### FormResponse.data JSON Structure

```typescript
// Every field stores its value at data[blockId]:
{
  "uuid-yes-no":      true,
  "uuid-numeric":     165.5,
  "uuid-text":        "No issues found",
  "uuid-dropdown":    "Good",
  "uuid-multiselect": ["OPT_A", "OPT_C"],
  "uuid-date":        "2026-03-06",
  "uuid-calculated":  25.3,
  "uuid-photo":       [{ "url": "https://...", "caption": "Nameplate", "gps": { "lat": 29.7, "lng": -95.3 } }],
  "uuid-signature":   { "url": "https://...", "signedBy": "John Smith", "signedAt": "2026-03-06T14:34:00Z" },
  "uuid-gps":         { "lat": 29.7604, "lng": -95.3698, "accuracy": 5.2 }
}
```

---

## 2. Web App — Template Builder UI

### Route

`/reports/templates/[id]/builder` — full-screen form designer

### Layout

Two-panel design:
- **Left/Center — Canvas**: Ordered list of field cards with drag-and-drop reordering (HTML5 drag). Each card shows type icon, label, key props (unit, required, etc.)
- **Right — Properties Panel**: Context-sensitive settings for selected field. Shows different controls per field type.

### Key Interactions

- **Add Field**: Modal with categorized grid (Input Fields / Capture Fields / Layout & Computed). Clicking adds to bottom of canvas + opens properties panel.
- **Edit Field**: Click any card → properties panel populates with that field's settings.
- **Reorder**: Drag handle on each card. Updates sortOrder in definition JSON.
- **Save**: Persists definition JSON to template (stays DRAFT).
- **Publish**: Sets status=ACTIVE, increments schemaVersion. Template available for assignment.
- **Preview PDF**: Opens new tab with preview PDF using placeholder data.

### Files

```
src/app/reports/templates/[id]/builder/
├── page.tsx              # Server component — fetches template
├── BuilderCanvas.tsx     # Client — field list + drag/drop
├── FieldCard.tsx         # Single field row in canvas
├── PropertiesPanel.tsx   # Right sidebar — field settings
├── AddFieldModal.tsx     # Field type picker modal
├── FieldTypePicker.tsx   # Grid of field type icons
├── TemplateSettings.tsx  # Cover page + global settings
├── builder.css           # Custom CSS variables
└── types.ts              # TypeScript interfaces
```

---

## 3. Mobile App — Form Filler UI

### Entry Points

1. **WO-Linked**: "Reports" tab on Work Order detail screen. Lists assigned reports with status + progress. "Add Report" to assign from available templates.
2. **Standalone**: Reports section accessible from main navigation. "New Report" flow: pick template → pick site → optionally pick asset → create.

### Form Filler Screen

Single scrollable screen with `KeyboardAvoidingView`. Renders sections from template definition via `DynamicFormRenderer` → `FormFieldRenderer` (switch on type).

### Field Component Reuse

| Field Type | Reuses Existing? |
|------------|-----------------|
| NUMERIC_INPUT | Yes — MeasurementInput |
| YES_NO | Yes — existing pass/fail pattern |
| PHOTO_CAPTURE | Yes — PhotoCapture modal |
| SIGNATURE | Yes — SignaturePad modal |
| GPS_CAPTURE | Yes — existing location lib |
| TEXT_INPUT, TEXTAREA | Standard RN TextInput |
| DROPDOWN | New — ActionSheet/Picker |
| MULTI_SELECT | New — Checkbox list |
| DATE_INPUT | New — DateTimePicker |
| CALCULATED | New — read-only computed |
| SECTION_HEADER, INSTRUCTIONS | Styled Text |

### Auto-Save

- Every field change saves to SQLite immediately
- Debounced PATCH to API every 5 seconds (not per keystroke)
- Offline: queued in sync_queue
- Status indicator: "Auto-saved 30s ago" / "Saving..." / "Offline — saved locally"

### Submit Flow

1. Validate required fields → scroll to first empty if incomplete
2. Capture GPS (submissionLat/Lng)
3. Compute CALCULATED fields (final values)
4. Freeze templateSnapshot
5. Set status=SUBMITTED, submittedAt=now()
6. Save to SQLite → POST to API (or queue if offline)
7. Success toast → navigate back

### Offline SQLite Tables

```sql
CREATE TABLE form_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  schema_version INTEGER,
  updated_at INTEGER,
  synced_at INTEGER
);

CREATE TABLE form_responses (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  work_order_id TEXT,
  site_id TEXT,
  asset_id TEXT,
  data TEXT NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  submitted_at INTEGER,
  submission_lat REAL,
  submission_lng REAL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER
);
```

### Files

```
src/app/(tabs)/work-orders/[id]/reports.tsx
src/app/(tabs)/reports/index.tsx
src/app/(tabs)/reports/new.tsx
src/app/(tabs)/reports/[responseId].tsx

src/components/form/
├── DynamicFormRenderer.tsx
├── FormFieldRenderer.tsx
├── DropdownField.tsx
├── MultiSelectField.tsx
├── DateField.tsx
├── CalculatedField.tsx
├── FormProgress.tsx
└── FormAutoSaveIndicator.tsx

src/hooks/useFormTemplates.ts
src/hooks/useFormResponse.ts
src/hooks/useFormAutoSave.ts
src/store/forms-store.ts
src/lib/db/form-queries.ts
```

---

## 4. API Routes

### Template Routes (extend existing)

```
GET    /api/report-templates              # Add ?type=form filter
POST   /api/report-templates/[id]/publish  # NEW — set ACTIVE + bump schemaVersion
```

### Form Response Routes (new)

```
GET    /api/form-responses                # List (filter: ?workOrderId, ?status, ?templateId)
POST   /api/form-responses                # Create draft
GET    /api/form-responses/[id]           # Get response + template snapshot
PATCH  /api/form-responses/[id]           # Auto-save (merge, not replace)
DELETE /api/form-responses/[id]           # Delete draft
POST   /api/form-responses/[id]/submit    # Validate + freeze + submit
POST   /api/form-responses/[id]/pdf       # Generate branded PDF
```

### WO Integration (extend existing)

```
GET    /api/work-orders/[id]/reports      # List responses for WO
POST   /api/work-orders/[id]/reports      # Assign template → create draft
```

### Mobile Sync

```
GET    /api/form-templates/sync           # All ACTIVE templates for org
```

### Role-Based Access

| Action | ADMIN | DISPATCHER | TECH |
|--------|-------|-----------|------|
| Create/edit templates | Yes | Yes | No |
| Publish templates | Yes | No | No |
| Assign report to WO | Yes | Yes | No |
| Fill out report | Yes | Yes | Yes |
| Submit report | Yes | Yes | Yes |
| Generate PDF | Yes | Yes | No |
| Create standalone report | Yes | Yes | Yes |

---

## 5. PDF Generation

### New File: `src/lib/pdf/documents/FormReportDocument.tsx`

Structure:
1. **Cover page** (optional): Company logo, report title, customer/site/asset info, date, technician
2. **Form data pages**: Sections rendered with field-type-specific layouts
3. **Footer**: Org name, WO number (if linked), page numbers

Field rendering rules:
- SECTION_HEADER → bold divider with title
- INSTRUCTIONS → omitted from PDF
- TEXT/TEXTAREA/DROPDOWN → label: value row
- NUMERIC → label: value + unit, with spec range and in-spec indicator
- YES_NO → label: checkmark YES or X NO
- MULTI_SELECT → label: comma-separated values
- DATE → label: formatted date
- CALCULATED → label: value + unit (marked "auto")
- PHOTO → embedded image with caption
- SIGNATURE → embedded signature image with name + timestamp
- GPS → formatted coordinates

### Generator Addition

Add `generateFormReportPdf(data: FormReportData)` to `pdf-generator.ts`.

---

## 6. Integration Safety

### Pure Additive Changes

All new files (zero risk to existing code):
- All form-responses API routes
- FormReportDocument.tsx
- All mobile form components, hooks, stores
- Builder UI pages
- SQLite form tables

### Surgical Edits to Existing Files

| File | Change | Risk |
|------|--------|------|
| `prisma/schema.prisma` | Add FormResponse model, enum values, relation fields | Low — additive |
| `pdf-generator.ts` | Add 1 export function | Zero |
| `shared-styles.ts` | Add new styles | Zero |
| `report-templates/route.ts` | Add ?type filter | Very low |
| Mobile: WO detail | Add Reports tab | Low |
| Mobile: `schema.ts` | Add 2 CREATE TABLE | Zero |
| Mobile: `sync-engine.ts` | Add form sync cases | Low |

### Migration Safety

- FormResponse has nullable FKs — no backfill, no existing data affected
- Relation fields on parent models are Prisma-side only (no DB column changes)
- Enum additions are non-destructive (ADD VALUE, not ALTER)
- Verify enum state before migrating: `SELECT enum_range(NULL::"ReportBlockType")`

### Deployment Strategy

```
Step 1: Schema migration + API routes → Deploy backend
Step 2: Template Builder UI → Deploy web
Step 3: Mobile form filler → EAS Build
Step 4: PDF generation → Deploy final
```

Each step is independently deployable and functional without the next.

---

## File Count Estimate

| Area | New Files | Modified Files |
|------|-----------|---------------|
| Schema + Migration | 1 | 1 |
| API Routes | ~8 | 1 |
| Web Builder UI | ~9 | 0 |
| Mobile Screens | ~4 | 2 |
| Mobile Components | ~8 | 0 |
| Mobile Hooks/Store/DB | ~5 | 2 |
| PDF | ~1 | 2 |
| **Total** | **~36** | **~8** |
