---
plan: 04
phase: 02
status: complete
---
# Plan 04 Summary: Account Mapping UI + Warning Banner on Integrations Page

## What Was Built
A "Chart of Accounts Mapping" section was added to the existing QBO integrations settings page, allowing admins to map 5 ServiceOps financial categories (Labor Income, Materials Income, Service Fee Income, Job Cost Expense, Subcontractor Expense) to specific QBO accounts fetched live from QuickBooks. Each dropdown is filtered by account type (Income vs Expense/COGS), saves optimistically on change with per-row saving/error states and revert-on-failure, and a yellow warning banner appears at the top of the connected section whenever the mapping is incomplete.

## Key Files

### Modified
- `src/app/(app)/settings/integrations/page.tsx`: Added QboAccountItem + AccountMappingRecord types, MAPPING_CATEGORIES array, accounts/mappings/savingCategory/mappingError state, fetchAccounts + fetchMappings callbacks, useEffect to load on connect, handleMappingChange with optimistic update + revert, mappedCount/allMapped derived values, warning banner JSX, and full account mapping section JSX with 5 filtered dropdowns.
- `src/app/(app)/settings/integrations/integrations.css`: Added 207 lines of account mapping CSS covering the section container, header, status indicator (complete/incomplete), refresh button, mapping rows grid, select styling with orange focus ring, account type badges (income/expense), saving/error states, loading/error states, warning banner, and responsive stacking at 768px breakpoint.

## Commits
- `59778de`: feat(02-04): Add account mapping CSS to integrations page
- `8aafc13`: feat(02-04): Add account mapping UI with warning banner to integrations page

## Self-Check: PASSED
