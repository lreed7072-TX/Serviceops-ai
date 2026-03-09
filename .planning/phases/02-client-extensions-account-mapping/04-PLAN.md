---
phase: 2
plan: 04
title: Account Mapping UI + Warning Banner on Integrations Page
wave: 3
depends_on: [01, 02]
requirements: [ACCT-01, ACCT-02, ACCT-03]
files_modified:
  - src/app/(app)/settings/integrations/page.tsx
  - src/app/(app)/settings/integrations/integrations.css
autonomous: true
estimated_effort: large
---

# Plan 04: Account Mapping UI + Warning Banner on Integrations Page

<context>
## Background
Plans 01 and 02 delivered the backend: 5 new QBO client methods, 2 new API routes (`/qbo/accounts` and `/qbo/account-mapping`), and the `requireAccountMapping()` gate in `qbo-sync.ts`. This plan builds the frontend: a "Chart of Accounts Mapping" section on the existing integrations settings page that lets admins map 5 ServiceOps financial categories to specific QBO accounts.

The UI appears inside the existing QBO integration card, below the connection details and actions, only when connected. It includes:
1. A status indicator (green when all 5 mapped, orange when incomplete)
2. A "Refresh Accounts" button to re-fetch the QBO Chart of Accounts
3. 5 mapping rows — each with a label, a dropdown filtered by account type, and a type tag
4. Optimistic per-row save on dropdown change (no global Save button)
5. A warning banner at the top when connected but mapping incomplete

The design follows the existing `integrations.css` patterns and the project's CSS variable system (orange = action, blue = info-only).
</context>

<tasks>
## Tasks

### Task 1: Add Account Mapping CSS to integrations.css

Append the following CSS to the END of `src/app/(app)/settings/integrations/integrations.css`, before the existing `@media` breakpoints. The new styles go after the `.sync-status--pending` rule (line ~287) and before the `@media (max-width: 768px)` rule (line ~289):

```css
/* ============================================
   Account Mapping Section
   ============================================ */

.account-mapping-section {
  border-top: 1px solid #f3f4f6;
  padding-top: 24px;
  margin-top: 24px;
}

.account-mapping-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.account-mapping-header h3 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.mapping-status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 600;
}

.mapping-status-indicator.complete {
  background: #ecfdf5;
  color: #059669;
}

.mapping-status-indicator.incomplete {
  background: #fffbeb;
  color: #d97706;
}

.mapping-refresh-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  color: #374151;
  transition: background 200ms, border-color 200ms;
}

.mapping-refresh-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.mapping-refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Mapping Rows */
.mapping-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mapping-row {
  display: grid;
  grid-template-columns: 180px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f9fafb;
}

.mapping-row:last-child {
  border-bottom: none;
}

.mapping-row-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
}

.mapping-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #111827;
  background: white;
  cursor: pointer;
  transition: border-color 200ms;
  appearance: auto;
}

.mapping-select:hover {
  border-color: #9ca3af;
}

.mapping-select:focus {
  outline: none;
  border-color: var(--accent, #f97316);
  box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.15);
}

.mapping-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #f9fafb;
}

.mapping-account-type {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.mapping-account-type.income {
  background: #ecfdf5;
  color: #059669;
}

.mapping-account-type.expense {
  background: #fef2f2;
  color: #dc2626;
}

.mapping-row-saving {
  font-size: 0.75rem;
  color: var(--accent, #f97316);
  font-weight: 500;
}

.mapping-row-error {
  font-size: 0.75rem;
  color: #dc2626;
  font-weight: 500;
}

/* Accounts Loading / Error State */
.mapping-accounts-loading {
  text-align: center;
  padding: 24px;
  color: #6b7280;
  font-size: 0.875rem;
}

.mapping-accounts-error {
  text-align: center;
  padding: 24px;
  color: #dc2626;
  font-size: 0.875rem;
}

.mapping-accounts-error button {
  margin-top: 8px;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--accent, #f97316);
  background: white;
  color: var(--accent, #f97316);
  transition: background 200ms;
}

.mapping-accounts-error button:hover {
  background: #fff7ed;
}

/* Warning Banner — incomplete mapping */
.mapping-warning-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 16px;
}

.mapping-warning-banner svg {
  flex-shrink: 0;
}
```

Then update the `@media (max-width: 768px)` block to add responsive rules for mapping rows:

Inside the existing `@media (max-width: 768px) { ... }` block (at line ~289), add:

```css
  .mapping-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .account-mapping-header {
    flex-direction: column;
    align-items: flex-start;
  }
```

### Task 2: Update page.tsx with Account Mapping UI

Rewrite `src/app/(app)/settings/integrations/page.tsx` to add account mapping state, fetching, and UI. The changes are:

**A. Add new imports (Lucide icons for the warning banner and status):**

Update the imports at the top:
```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import "./integrations.css";
```

**B. Add type definitions after `QboConnectionStatus`:**

```typescript
type QboAccountItem = {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  FullyQualifiedName?: string;
};

type AccountMappingRecord = {
  qboAccountId: string;
  qboAccountName: string;
  qboAccountType: string;
};

const MAPPING_CATEGORIES: { key: string; label: string; filterType: string[] }[] = [
  { key: "labor_income", label: "Labor Income", filterType: ["Income"] },
  { key: "materials_income", label: "Materials Income", filterType: ["Income"] },
  { key: "service_income", label: "Service Fee Income", filterType: ["Income"] },
  { key: "job_cost_expense", label: "Job Cost Expense", filterType: ["Expense", "Cost of Goods Sold"] },
  { key: "subcontractor_expense", label: "Subcontractor Expense", filterType: ["Expense", "Cost of Goods Sold"] },
];
```

**C. Add state variables inside the component, after the existing state declarations:**

```typescript
  // Account mapping state
  const [accounts, setAccounts] = useState<QboAccountItem[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Record<string, AccountMappingRecord>>({});
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState<{ category: string; message: string } | null>(null);
```

**D. Add fetchAccounts and fetchMappings functions:**

```typescript
  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const res = await apiFetch("/api/integrations/qbo/accounts");
      if (res.ok) {
        const json = await res.json();
        setAccounts(json.data || []);
      } else {
        const json = await res.json();
        setAccountsError(json.error || "Failed to fetch accounts");
      }
    } catch {
      setAccountsError("Failed to fetch accounts from QuickBooks");
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    try {
      const res = await apiFetch("/api/integrations/qbo/account-mapping");
      if (res.ok) {
        const json = await res.json();
        setMappings(json.data || {});
      }
    } catch {
      // Silent — mappings will show as empty
    }
  }, []);
```

**E. Add useEffect to load accounts and mappings when connected:**

After the existing `useEffect(() => { fetchStatus(); }, [])`, add:

```typescript
  // Load accounts and mappings when connected
  useEffect(() => {
    if (status?.connected) {
      fetchAccounts();
      fetchMappings();
    }
  }, [status?.connected, fetchAccounts, fetchMappings]);
```

**F. Add handleMappingChange function:**

```typescript
  async function handleMappingChange(category: string, qboAccountId: string) {
    if (!qboAccountId) return; // "Select..." placeholder chosen — ignore

    const account = accounts.find((a) => a.Id === qboAccountId);
    if (!account) return;

    const previousMapping = mappings[category];
    setSavingCategory(category);
    setMappingError(null);

    // Optimistic update
    setMappings((prev) => ({
      ...prev,
      [category]: {
        qboAccountId: account.Id,
        qboAccountName: account.Name,
        qboAccountType: account.AccountType,
      },
    }));

    try {
      const res = await apiFetch("/api/integrations/qbo/account-mapping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          qboAccountId: account.Id,
          qboAccountName: account.Name,
          qboAccountType: account.AccountType,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to save mapping");
      }
    } catch (err) {
      // Revert optimistic update
      if (previousMapping) {
        setMappings((prev) => ({ ...prev, [category]: previousMapping }));
      } else {
        setMappings((prev) => {
          const next = { ...prev };
          delete next[category];
          return next;
        });
      }
      setMappingError({
        category,
        message: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setSavingCategory(null);
    }
  }
```

**G. Compute mapping completeness for the warning banner:**

Add this derived value before the return statement:

```typescript
  const mappedCount = Object.keys(mappings).length;
  const allMapped = mappedCount === MAPPING_CATEGORIES.length;
```

**H. Add warning banner JSX:**

Inside the connected section (`status?.connected && status.connection` branch), BEFORE the `<div className="integration-details">`, add:

```tsx
              {/* Account Mapping Warning Banner */}
              {!allMapped && status?.connected && (
                <div className="mapping-warning-banner">
                  <AlertTriangle size={16} />
                  Account mapping incomplete ({mappedCount}/{MAPPING_CATEGORIES.length}) — financial syncs are blocked. Configure mapping below.
                </div>
              )}
```

**I. Add Account Mapping Section JSX:**

After the sync log section (after the closing `</div>` of `sync-log-section`), but still inside the connected `<>...</>` fragment, add:

```tsx
              {/* Account Mapping Section */}
              <div className="account-mapping-section">
                <div className="account-mapping-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <h3>Chart of Accounts Mapping</h3>
                    <span className={`mapping-status-indicator ${allMapped ? "complete" : "incomplete"}`}>
                      {allMapped ? (
                        <><CheckCircle size={12} /> All mapped</>
                      ) : (
                        <><AlertTriangle size={12} /> {mappedCount}/{MAPPING_CATEGORIES.length} mapped</>
                      )}
                    </span>
                  </div>
                  <button
                    className="mapping-refresh-btn"
                    onClick={fetchAccounts}
                    disabled={accountsLoading}
                  >
                    <RefreshCw size={14} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />
                    {accountsLoading ? "Refreshing..." : "Refresh Accounts"}
                  </button>
                </div>

                {accountsLoading && accounts.length === 0 ? (
                  <div className="mapping-accounts-loading">
                    Loading Chart of Accounts from QuickBooks...
                  </div>
                ) : accountsError && accounts.length === 0 ? (
                  <div className="mapping-accounts-error">
                    {accountsError}
                    <br />
                    <button onClick={fetchAccounts}>Try Again</button>
                  </div>
                ) : accounts.length > 0 ? (
                  <div className="mapping-rows">
                    {MAPPING_CATEGORIES.map((cat) => {
                      const filteredAccounts = accounts.filter((a) =>
                        cat.filterType.includes(a.AccountType)
                      );
                      const currentMapping = mappings[cat.key];
                      const isSaving = savingCategory === cat.key;
                      const hasError = mappingError?.category === cat.key;

                      return (
                        <div key={cat.key} className="mapping-row">
                          <span className="mapping-row-label">{cat.label}</span>
                          <select
                            className="mapping-select"
                            value={currentMapping?.qboAccountId || ""}
                            onChange={(e) => handleMappingChange(cat.key, e.target.value)}
                            disabled={isSaving || accountsLoading}
                          >
                            <option value="">Select a QBO account...</option>
                            {filteredAccounts.map((acct) => (
                              <option key={acct.Id} value={acct.Id}>
                                {acct.FullyQualifiedName || acct.Name}
                              </option>
                            ))}
                          </select>
                          <div style={{ minWidth: 70, textAlign: "right" }}>
                            {isSaving ? (
                              <span className="mapping-row-saving">Saving...</span>
                            ) : hasError ? (
                              <span className="mapping-row-error">{mappingError.message}</span>
                            ) : currentMapping ? (
                              <span
                                className={`mapping-account-type ${
                                  currentMapping.qboAccountType === "Income" ? "income" : "expense"
                                }`}
                              >
                                {currentMapping.qboAccountType}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
```

</tasks>

<verification>
## Verification
- [ ] `npx tsc --noEmit` completes with zero TypeScript errors
- [ ] `npm run build` completes without errors
- [ ] When QBO is connected, the integrations page shows a "Chart of Accounts Mapping" section
- [ ] The section shows 5 rows: Labor Income, Materials Income, Service Fee Income, Job Cost Expense, Subcontractor Expense
- [ ] Income category dropdowns only show Income-type QBO accounts
- [ ] Expense category dropdowns show Expense and Cost of Goods Sold accounts
- [ ] Changing a dropdown triggers a PUT to `/api/integrations/qbo/account-mapping`
- [ ] A "Saving..." indicator appears on the row while the PUT is in flight
- [ ] On save failure, the dropdown reverts to the previous value and shows an error
- [ ] The status indicator shows green "All mapped" when 5/5, orange "X/5 mapped" when incomplete
- [ ] A yellow warning banner appears when connected but mapping is incomplete
- [ ] The "Refresh Accounts" button re-fetches the account list from QBO
- [ ] The warning banner disappears when all 5 categories are mapped
- [ ] On mobile (< 768px), mapping rows stack vertically
- [ ] When QBO is not connected, the mapping section does not appear
</verification>

<must_haves>
## Must-Haves (Goal-Backward)
- Admin can select a QBO income account for Labor, Materials, and Service Fees and a QBO expense account for Job Costs and Subcontractor Expense — selections persist via `QboAccountMap` and survive page reload
- Chart of Accounts list is fetched live from QBO (not from DB cache) with a visible Refresh button
- When connected but mapping incomplete, a clear warning banner displays: "Account mapping incomplete ... financial syncs are blocked"
- Dropdowns filter by account type: Income accounts for income categories, Expense/COGS accounts for expense categories
- Per-row optimistic save on dropdown change with saving state, error handling, and revert on failure
- CSS follows project design system: orange for action elements, blue for info-only, `var(--accent)` for focus states
</must_haves>
