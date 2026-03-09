# Summary: Plan 03-01 — Schema migration + QBO client extensions + toQboItem mapper + resolveOrCreateQboEntity helper

## Status: COMPLETE

## Commits
| Task | Commit | Title |
|------|--------|-------|
| 03-01-01 | `540ed00` | Add qboEntityId and qboRealmId fields to QboSyncJob model |
| 03-01-02 | `248d355` | Add getPayment, createItem, updateItem, getItem to qbo-client.ts |
| 03-01-03 | `31bd2a6` | Add createEstimate, updateEstimate, getEstimate to qbo-client.ts |
| 03-01-04 | `d247246` | Add toQboItem mapper function |
| 03-01-05 | `c9ba034` | Add resolveOrCreateQboEntity helper to qbo-sync.ts |

## What Was Delivered

### Task 03-01-01: QboSyncJob Schema Migration
- Added `qboEntityId String?` and `qboRealmId String?` to QboSyncJob model
- Added composite index `@@index([qboEntityId, entityType, status])` for webhook dedup queries
- Migration: `prisma/migrations/0009_add_qbo_sync_job_dedup_fields/migration.sql`
- Prisma validate passes, client generated

### Task 03-01-02: Payment + Item CRUD Functions
- `getPayment(connection, paymentId)` — GET payment by ID
- `createItem(connection, itemData)` — POST new item
- `getItem(connection, qboItemId)` — GET item by ID
- `updateItem(connection, qboItemId, itemData)` — Fetch-merge-POST pattern
- Updated imports: QboPayment, QboItem, QboEstimate now imported and re-exported

### Task 03-01-03: Estimate CRUD Functions
- `createEstimate(connection, estimateData)` — POST new estimate
- `getEstimate(connection, qboEstimateId)` — GET estimate by ID
- `updateEstimate(connection, qboEstimateId, estimateData)` — Fetch-merge-POST pattern
- All 7 new functions exported from qbo-client.ts

### Task 03-01-04: toQboItem Mapper
- Pure function: no I/O, no await, no prisma import
- Handles both Material (NonInventory) and LaborRate (Service) sources
- Uses `unitCost` for materials, `hourlyRate` for labor
- Merge pattern: spreads existingQbo when provided (for updates)
- All monetary values pass through `roundQboAmount()`

### Task 03-01-05: resolveOrCreateQboEntity Helper
- Generic collision-handling helper implementing VEND-02
- Query-before-create pattern to avoid QBO DisplayName collisions
- matchFn callback lets callers define "same entity" logic per entity type
- Creates with " (SvcOps)" suffix when collision is detected but no match
- Returns `{ entity, wasExisting }` for caller awareness
- Added `queryEntities` to qbo-sync.ts imports

## Verification
- `npx prisma validate` — PASS
- `npx prisma generate` — PASS
- `npm run build` — PASS (0 errors, 0 warnings)
- All files compile cleanly with TypeScript

## Files Modified
- `prisma/schema.prisma` — 2 fields + 1 index on QboSyncJob
- `prisma/migrations/0009_add_qbo_sync_job_dedup_fields/migration.sql` — NEW
- `src/lib/qbo/qbo-client.ts` — 7 new functions, updated type imports/exports (+119 lines)
- `src/lib/qbo/qbo-mapper.ts` — toQboItem function, QboItem import (+46 lines)
- `src/lib/qbo/qbo-sync.ts` — resolveOrCreateQboEntity function, queryEntities import (+48 lines)

## Decisions
- Migration created with `--create-only` approach (manual SQL file) due to existing DB drift from prior development phases — consistent with project pattern of sequential numbered migrations
- Item functions placed before Estimate functions in qbo-client.ts for alphabetical entity ordering
- `resolveOrCreateQboEntity` uses generic constraint `T extends { Id: string }` to work with any QBO entity type
