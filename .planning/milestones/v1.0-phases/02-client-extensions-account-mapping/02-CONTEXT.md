# Phase 2: Client Extensions + Account Mapping - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `qbo-client.ts` with the batch, CDC, void, and email HTTP methods that all sync modules require; pull the org's Chart of Accounts from QBO and provide an admin UI to map ServiceOps financial categories to specific QBO accounts — the prerequisite gate that blocks all financial transaction syncs until configured.

Requirements: FOUND-10, ACCT-01, ACCT-02, ACCT-03

</domain>

<decisions>
## Implementation Decisions

### Client Extension Methods (FOUND-10)
- Add 5 new functions to `qbo-client.ts`: `batchRequest()`, `queryEntities()`, `cdcRequest()`, `voidInvoice()`, `sendInvoiceEmail()`
- All build on existing `qboRequest()` helper — same auth, minorversion, error handling pattern
- `batchRequest()` targets QBO's `/batch` endpoint with up to 30 operations per request
- `queryEntities()` uses QBO's query language (`SELECT * FROM Account WHERE Active = true`)
- `cdcRequest()` calls QBO's `/cdc` endpoint with `changedSince` parameter and entity list
- `voidInvoice()` uses the sparse update pattern: `{Id, SyncToken, void: true}`
- `sendInvoiceEmail()` POSTs to `/invoice/{id}/send` with optional email override

### Account Mapping UI (ACCT-02)
- Expand the existing `/settings/integrations` page — add a "Chart of Accounts Mapping" section below the connection details when connected
- Show a card with 5 category rows (labor_income, materials_income, service_income, job_cost_expense, subcontractor_expense) each with a dropdown of QBO accounts filtered by type (Income accounts for income categories, Expense/COGS accounts for expense categories)
- Friendly labels: "Labor Income", "Materials Income", "Service Fee Income", "Job Cost Expense", "Subcontractor Expense"
- Save button at bottom — individual dropdowns save on change (optimistic UI)
- Status indicator: green check when all 5 are mapped, orange warning when incomplete
- Follows existing page CSS patterns (integrations.css)

### Chart of Accounts Caching (ACCT-01)
- Do NOT create a separate DB table — re-fetch from QBO API when the settings page loads (accounts change rarely, and the QBO query is fast)
- Add a "Refresh Accounts" button for manual re-fetch
- Auto-fetch on first connect (after OAuth callback completes)
- Cache in React state for the session — no persistent storage of account list
- New API endpoint: `GET /api/integrations/qbo/accounts` — calls `queryEntities()` for active accounts

### Prerequisite Gate (ACCT-03)
- Check account mapping before any financial sync operation (invoice, item, estimate, expense, bill)
- New helper: `getAccountMapping(orgId, category)` returns mapped QBO account ID or throws descriptive error
- New helper: `requireAccountMapping(orgId)` checks all 5 categories are mapped — returns `{complete: boolean, missing: string[]}`
- Gate enforcement in `qbo-sync.ts` sync functions — check before API call, not after
- When mapping incomplete: return `{success: false, error: "Account mapping required — configure in QBO Settings", missingCategories: [...]}`
- On the integrations page: show a warning banner when connected but mapping incomplete — "Complete account mapping to enable financial syncs"
- On dashboard (future Phase 3): DASH-01 will show this in the health display

### Claude's Discretion
- Exact dropdown styling and empty state for accounts list
- Error handling for QBO API failures during account fetch
- Whether to batch-validate all 5 mappings or validate individually per sync type
- Loading spinner placement during account fetch

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `qboRequest()` in `qbo-client.ts:219` — authenticated QBO API call helper, all new methods build on this
- `QboAccount` type in `qbo-types.ts:415` — already has Id, Name, AccountType, AccountSubType, Classification, Active fields
- `QboQueryResponse<T>` type in `qbo-types.ts:521` — generic wrapper for query results
- `QboCdcResponse` type in `qbo-types.ts:529` — CDC response wrapper already defined
- `ConfirmDialog` component — used on integrations page, available for disconnect/reset flows
- `integrations.css` — existing CSS file with card, badge, table, and message styles

### Established Patterns
- QBO client follows export-function pattern (no class) — all functions take `connection: QboConnection` as first param
- API routes use `requireAuthSessionFirst(request)` → `{ orgId, userId, role }` pattern
- Prisma queries always include `orgId` for multi-tenancy
- Settings pages use `apiFetch()` wrapper for authenticated API calls
- CSS follows custom variables pattern: `var(--primary)`, `var(--accent)`, `var(--transition)`

### Integration Points
- Existing integrations page at `src/app/(app)/settings/integrations/page.tsx` — the account mapping UI section gets added here
- New API routes needed:
  - `GET /api/integrations/qbo/accounts` — fetch Chart of Accounts from QBO
  - `GET/PUT /api/integrations/qbo/account-mapping` — CRUD for account mappings
- `qbo-sync.ts` — prerequisite gate calls added before sync operations
- `QboAccountMap` Prisma model already exists with `@@unique([orgId, category])` constraint

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Phase 1 context established all infrastructure patterns; Phase 2 follows them directly.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-client-extensions-account-mapping*
*Context gathered: 2026-03-09*
