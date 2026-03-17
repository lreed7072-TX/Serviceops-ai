# Session Handoff — v2.0 CRM 92% Complete

**Date:** 2026-03-17
**Status:** CRM 47/50 requirements done — 3 remaining (Custom Fields system)
**Next action:** Build CFIELD-01, CFIELD-02, CFIELD-03

---

## RESUME INSTRUCTIONS

```
Read these files first:
- .planning/HANDOFF.md
- .planning/REQUIREMENTS.md

ServiceOpsIQ v2.0: AI validated, CRM 94% complete (47/50 done).
3 remaining items — all Custom Fields system (CFIELD-01/02/03).

Last commit: 102d163 — CUST-03 customer archive/restore UI.

Build the 3 remaining Custom Fields items in order:
1. CFIELD-01 — Custom field definition admin (API + settings UI)
2. CFIELD-03 — Custom field value CRUD API
3. CFIELD-02 — Custom field rendering on customer/site edit forms

Follow existing patterns exactly:
- API routes: requireAuthSessionFirst + requireRole(ADMIN), orgId scoping
- Settings UI: same ConfigSection pattern as /sales/settings but needs
  custom section for field definitions (entity type, field type, industry filter)
- CSS: inline styles or scoped CSS variables, never :root overrides
- Commit after each logical chunk
```

---

## What Was Done This Session (2026-03-17)

### 5 CRM Items Completed (6 commits)

1. **LOOK-04** — Industry CRUD API (`/api/crm/industries` + `[id]`) + Industries ConfigSection on settings page
   - Commit: bb596f3

2. **CUST-04** — Industry picker on CRM edit modal + fixed customer PUT API
   - Extended customer PUT to handle tier, leadSourceId, assignedToUserId, industryId, archivedAt (previously silently ignored!)
   - Added industry picker dropdown + industry display on info tab
   - Commit: 50a6bdd

3. **CONT-04** — Contact quick-add from call log form
   - "+" button next to contact dropdown opens inline form (first/last name, email, phone)
   - Auto-selects newly created contact in dropdown
   - Commit: ce0932b

4. **CONT-05** — Contact list on site detail page
   - Added siteId filter to contacts GET API + siteId to contacts POST
   - Contact cards with role badges on site detail page
   - Commit: ce0932b (same commit as CONT-04)

5. **CUST-03** — Customer archive/restore UI
   - Added archivedAt filter to customers GET API (default hides archived)
   - "Show Archived" toggle on sales customer list
   - Archive/Restore button + archived banner on sales customer detail
   - Commit: 102d163

### Important Fix Discovered
The customer PUT API was NOT saving CRM fields (tier, leadSourceId, assignedToUserId). The sales CRM edit modal was sending them but they were silently ignored. Fixed in CUST-04 commit.

---

## 3 Remaining Items (Custom Fields System)

### Schema (already in DB from migration 0011):

```prisma
enum CustomFieldEntityType { CUSTOMER, SITE }
enum CustomFieldType { TEXT, NUMBER, BOOLEAN }

model CustomFieldDefinition {
  id, orgId, entityType, industryId?, fieldName, fieldType, displayOrder, isActive
  // Relations: org, industry?, values[]
  // Indexes: [orgId], [orgId, entityType], [orgId, entityType, industryId]
}

model CustomFieldValue {
  id, orgId, fieldDefinitionId, entityType, entityId, value?
  // Relations: org, fieldDefinition (cascade delete)
  // Unique: [fieldDefinitionId, entityType, entityId]
  // Indexes: [orgId], [entityType, entityId]
}
```

### CFIELD-01: Custom field definition admin API + UI
- Create `/api/crm/custom-fields/route.ts` (GET list + POST create)
- Create `/api/crm/custom-fields/[id]/route.ts` (GET/PUT/DELETE)
- GET should accept `?entityType=CUSTOMER` filter
- All routes: requireAuthSessionFirst + requireRole(ADMIN) for writes
- Add "Custom Fields" section to `/sales/settings/page.tsx`
- CANNOT reuse ConfigSection directly — needs entity type selector, field type selector, optional industry picker
- Build a dedicated CustomFieldsSection component

### CFIELD-03: Custom field value CRUD API
- Create `/api/crm/custom-field-values/route.ts`
- GET: filter by entityType + entityId, returns values with fieldDefinition included
- POST/PUT: upsert pattern — find by [fieldDefinitionId, entityType, entityId], create or update
- Batch save endpoint: accept array of { fieldDefinitionId, value } for a given entityType + entityId

### CFIELD-02: Custom field rendering on forms
- On customer CRM edit modal (`/sales/customers/[id]/page.tsx`):
  - Load field definitions for entityType=CUSTOMER filtered by customer's industryId
  - Load existing values for this customer
  - Render TEXT as input, NUMBER as number input, BOOLEAN as checkbox
  - Save values on form submit via batch endpoint
- On site edit modal (`/sites/[id]/page.tsx`):
  - Same pattern for entityType=SITE
- Display saved custom field values on info/detail views

---

## Architecture Context

Key files for reference:
- Lead sources API pattern: `src/app/api/crm/lead-sources/route.ts` + `[id]/route.ts`
- Industries API (just built): `src/app/api/crm/industries/route.ts` + `[id]/route.ts`
- Settings page: `src/app/(sales)/sales/settings/page.tsx` (ConfigSection component)
- Sales customer detail: `src/app/(sales)/sales/customers/[id]/page.tsx` (CRM edit modal at bottom)
- Site detail: `src/app/(app)/sites/[id]/page.tsx` (edit modal at bottom)
- Customer PUT API: `src/app/api/customers/[id]/route.ts` (now handles CRM fields)
- Contacts API: `src/app/api/contacts/route.ts` (siteId filter added)

---
*Last updated: 2026-03-17*
