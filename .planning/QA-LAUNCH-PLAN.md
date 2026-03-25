# ServiceOpsIQ — Pre-Launch QA & PWA Plan

**Created:** 2026-03-25
**Goal:** Get ServiceOpsIQ production-ready for real-world use at GPS
**URL:** https://serviceopsiq.com

---

## Phase 0: Housekeeping (30 min)

Prerequisites that must be clean before any testing.

| # | Item | Action | Verify |
|---|------|--------|--------|
| 0.1 | Delete stray test file | Remove `test-tasks-api.mjs` from project root (hardcoded creds) | `ls Serviceops-ai/test-tasks-api.mjs` returns not found |
| 0.2 | Verify prod env vars | Confirm Vercel has ONLY: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `QBO_*` vars. Confirm `DEV_AUTH_BYPASS` is NOT set. | Vercel dashboard → Settings → Environment Variables |
| 0.3 | Verify crons registered | All 5 crons active in Vercel dashboard | Vercel → Crons tab shows 5 entries |
| 0.4 | Verify domain DNS | `serviceopsiq.com` resolves, SSL valid, www redirects | `curl -I https://serviceopsiq.com` returns 200 |
| 0.5 | Check build status | Latest deploy is green on Vercel | Vercel dashboard → Deployments |

---

## Phase 1: PWA Polish (2-3 hours code work)

Make the app fully installable on phones without app stores.

| # | Item | What | Files |
|---|------|------|-------|
| 1.1 | Update manifest.json | Add `id` field, `scope`, `categories`, `screenshots` array, `prefer_related_applications: false` | `public/manifest.json` |
| 1.2 | Build install prompt banner | Capture `beforeinstallprompt` event (Android/desktop Chrome), show a dismissible "Install ServiceOpsIQ" banner. On iOS Safari, detect standalone-capable + show "Tap Share → Add to Home Screen" instruction. Persist dismissal in localStorage. | New: `src/components/common/InstallPrompt.tsx`, `src/app/globals.css` (add styles) |
| 1.3 | Enhance ServiceWorkerRegistration | Add SW update notification — when new version detected, show "Update available" toast with refresh button. Wire into existing Toast system. | `src/components/common/ServiceWorkerRegistration.tsx` |
| 1.4 | Branded icons | Replace placeholder 192/512/maskable PNGs with real ServiceOpsIQ branded icons. Also verify `apple-touch-icon.png` is high quality. | `public/icons/*`, `public/apple-touch-icon.png` |
| 1.5 | Add 180x180 apple icon | iOS specifically wants 180x180 apple-touch-icon | `public/apple-touch-icon.png`, verify in layout.tsx |

**Depends on:** Phase 0 complete
**Deliverable:** PWA passes Chrome Lighthouse installability audit

---

## Phase 2: Auth & Access Control (1-2 hours manual testing)

Test every login path on production. This gates all other testing.

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 2.1 | Admin login | Go to serviceopsiq.com/login → enter Lance's creds → submit | Redirects to /dashboard, sidebar shows all nav items |
| 2.2 | Session persistence | Close browser tab → reopen serviceopsiq.com | Still logged in, no redirect to /login |
| 2.3 | Session expiry | Wait for Supabase session timeout (or manually clear cookies) | Graceful redirect to /login, not a crash/blank page |
| 2.4 | TECH role access | Log in as tech user | Redirects to /tech, cannot access /admin or /sales routes |
| 2.5 | SALES role access | Log in as sales user | Redirects to /sales/dashboard, sees CRM nav only |
| 2.6 | DISPATCHER access | Log in as dispatcher | Sees dispatch-relevant pages, cannot access admin-only |
| 2.7 | Portal login | Generate portal token for a test customer → visit /portal/login → enter token | Sees portal dashboard with customer's quotes/invoices/WOs |
| 2.8 | Invalid portal token | Visit /portal/login → enter garbage token | Shows error, does not grant access |
| 2.9 | Dev bypass blocked | Confirm `x-org-id` / `x-user-id` headers do NOT work on prod | API returns 401, not 200 |

**Depends on:** Phase 0 (env vars verified)
**Blocking:** All subsequent phases need working auth

---

## Phase 3: Core CRUD Workflows (2-3 hours manual testing)

Test the daily bread-and-butter operations a GPS tech/admin would do.

| # | Workflow | Steps | Expected |
|---|----------|-------|----------|
| 3.1 | Customer lifecycle | Create customer → edit → add contact → view list | CRUD works, pagination works, search works |
| 3.2 | Site + Asset | Create site under customer → create asset under site → set PM schedule | Hierarchy correct, asset shows on site page |
| 3.3 | Work Order lifecycle | Create WO → assign tech → add materials → add visit → upload photo → complete | All steps save, status transitions work, timeline updates |
| 3.4 | Quote lifecycle | Create quote → add line items → send → view in portal → accept | Quote converts to WO, status shows ACCEPTED |
| 3.5 | Invoice lifecycle | Create invoice from completed WO → add line items → send | Invoice generates with correct totals, PDF downloadable |
| 3.6 | Materials | Add material to inventory → use on WO → verify stock decremented | Stock tracking accurate |
| 3.7 | PM auto-generation | Create PM schedule (daily) → verify cron creates WO next day | Check WO list after cron fires (or trigger manually) |
| 3.8 | Search | Use global search for customer, WO number, asset | Returns correct results |
| 3.9 | Pagination | View lists with 25+ items | Pagination controls work, page navigation correct |
| 3.10 | Notifications | Complete a WO → check notification bell | Notification appears for relevant users |

**Depends on:** Phase 2 (auth working)

---

## Phase 4: QBO Integration (1-2 hours, needs QBO sandbox)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.1 | OAuth connect | Settings → QBO → Connect → authorize in QBO sandbox | Connection saved, company name displays |
| 4.2 | Account mapping | Configure 5 account categories (income, expense, asset, etc.) | Mapping saved, prerequisite gate clears |
| 4.3 | Customer sync out | Create customer in ServiceOps | Appears in QBO within 5 min (queue flush) |
| 4.4 | Invoice sync out | Create + send invoice | Appears in QBO with correct line items and amounts |
| 4.5 | Payment sync in | Record payment in QBO sandbox | Invoice marked paid in ServiceOps after CDC poll |
| 4.6 | Webhook test | Trigger change in QBO | Webhook fires, enqueues job, processes correctly |
| 4.7 | Sync log | Check QBO sync dashboard | Shows history of syncs with success/failure status |
| 4.8 | Disconnect + reconnect | Disconnect QBO → reconnect | Old data preserved, sync resumes |

**Depends on:** Phase 2 (auth), QBO sandbox account
**Note:** Can defer to post-launch if QBO sandbox not ready — core app works without it

---

## Phase 5: AI Features (1 hour)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 5.1 | AI insight generation | Complete a WO → wait 2 min for cron | AiInsight generated, visible on asset page |
| 5.2 | Risk badge | View asset with AI insights | AiRiskBadge shows severity color |
| 5.3 | Dashboard alerts | Check dashboard AI alerts widget | Shows HIGH/CRITICAL insights if any exist |
| 5.4 | AI copilot | Open copilot → ask "What work orders are overdue?" | Claude responds with real data from org |
| 5.5 | Copilot conversation history | Close copilot → reopen | Previous conversation preserved |
| 5.6 | AI stats | Visit AI admin stats page | Shows token usage, job counts, success rate |

**Depends on:** Phase 3 (need WO data to trigger AI), `ANTHROPIC_API_KEY` set on Vercel

---

## Phase 6: CRM Module (1 hour)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 6.1 | CRM dashboard | /sales/dashboard | Charts render, numbers populate |
| 6.2 | Call logging | Log a call → select outcome that triggers follow-up | Follow-up auto-created with correct date |
| 6.3 | Opportunity pipeline | Create opportunity → move through stages (Lead → Qualified → Proposal → Won) | Pipeline updates, amounts correct |
| 6.4 | Follow-ups | View follow-up list → mark complete | Status updates, removed from active list |
| 6.5 | Custom fields | Define a custom field (e.g., "Equipment Type" for Customer) → go to customer form → fill value → save | Value persists on reload |
| 6.6 | CRM reports | View call activity, revenue by rep, pipeline reports | Recharts render with real data |
| 6.7 | Service tickets | Create service ticket → convert to WO | Ticket links to WO, status updates |
| 6.8 | SALES role isolation | Log in as SALES user → verify sees only own call logs/opportunities | Cannot see other users' data |

**Depends on:** Phase 2 (auth), Phase 3 (customer data exists)

---

## Phase 7: PWA & Mobile Testing (1-2 hours)

| # | Test | Device | Steps | Expected |
|---|------|--------|-------|----------|
| 7.1 | iPhone install | iPhone Safari | Visit serviceopsiq.com → Share → Add to Home Screen | App icon on home screen, opens standalone (no Safari chrome) |
| 7.2 | Android install | Android Chrome | Visit site → install prompt or menu → install | App icon on home screen, opens standalone |
| 7.3 | Install prompt | Android Chrome | First visit shows install banner (Phase 1.2 work) | Banner appears, dismiss persists |
| 7.4 | Responsive - dashboard | Phone (any) | View /dashboard | Cards stack vertically, charts resize, no horizontal scroll |
| 7.5 | Responsive - sidebar | Phone (any) | Tap hamburger → navigate → tap link | Sidebar opens/closes, auto-closes on nav |
| 7.6 | Responsive - tables | Phone (any) | View /work-orders list | Table scrolls horizontally or stacks, usable |
| 7.7 | Responsive - forms | Phone (any) | Create a WO on phone | Keyboard doesn't cover inputs, form submits correctly |
| 7.8 | Offline - cached pages | Phone (any) | Load app → airplane mode → navigate | Cached pages load, offline banner shows |
| 7.9 | Offline - mutation queue | Phone (any) | Airplane mode → edit a WO → reconnect | Edit queued, syncs on reconnect, toast confirms |
| 7.10 | SW update | Desktop Chrome | Deploy new version → visit app | "Update available" toast appears |

**Depends on:** Phase 1 (PWA polish), Phase 2 (auth)

---

## Phase 8: Customer Portal (30 min)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 8.1 | Portal login | Enter valid token at /portal/login | Redirects to /portal dashboard |
| 8.2 | Portal dashboard | View dashboard | Shows open quotes, unpaid invoices, active WOs |
| 8.3 | View quote | Click a quote | Shows line items, total, status |
| 8.4 | Accept quote | Click accept on a SENT quote | Quote status → ACCEPTED, WO created |
| 8.5 | View invoice | Click an invoice | Shows line items, total, payment status |
| 8.6 | View work order | Click a WO | Shows details, visits, status |
| 8.7 | Portal on mobile | Open /portal on phone | Responsive layout, usable |
| 8.8 | Expired token | Use revoked token | Shows error, redirects to login |

**Depends on:** Phase 3 (need quote/invoice/WO data), Phase 2

---

## Phase 9: Security Spot Checks (30 min)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 9.1 | TECH can't admin | Logged in as TECH → visit /admin URLs | 403 or redirect, not data leak |
| 9.2 | Cross-org isolation | Use API with one org's auth → request another org's data | 404 or 403, never returns other org's data |
| 9.3 | No dev bypass in prod | Send `x-org-id` / `x-user-id` headers to prod API | Returns 401 |
| 9.4 | Portal scope | Portal token for Customer A → try to view Customer B's data | 404, no data leak |
| 9.5 | No creds in code | Check deployed source for hardcoded keys | None found |
| 9.6 | CRON_SECRET required | Hit /api/cron/* without auth header | 401 |
| 9.7 | Rate limiting | Rapid-fire 50 requests to /api/auth | Rate limit kicks in (429) |

**Depends on:** Phase 2

---

## Phase 10: PDF Generation (30 min)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 10.1 | Invoice PDF | Generate invoice PDF | Correct line items, totals, GPS branding |
| 10.2 | Quote PDF | Generate quote PDF | Correct items, pricing, terms |
| 10.3 | WO Report PDF | Generate WO report | Visits, materials, labor, photos |
| 10.4 | PDF on mobile | Download PDF on phone | Opens in viewer, readable |

**Depends on:** Phase 3 (need data to generate PDFs)

---

## Execution Order (Critical Path)

```
Phase 0: Housekeeping (do first, 30 min)
    │
    ├── Phase 1: PWA Polish (code work, 2-3 hrs)
    │       │
    │       └── Phase 7: PWA & Mobile Testing
    │
    └── Phase 2: Auth Testing (gates everything)
            │
            ├── Phase 9: Security Spot Checks (parallel)
            │
            └── Phase 3: Core CRUD Workflows
                    │
                    ├── Phase 4: QBO Integration (can defer)
                    │
                    ├── Phase 5: AI Features
                    │
                    ├── Phase 6: CRM Module
                    │
                    ├── Phase 8: Customer Portal
                    │
                    └── Phase 10: PDF Generation
```

**Total estimated time:** ~10-12 hours across sessions
**Code work:** Phase 0 + Phase 1 (~3 hours)
**Manual testing:** Phases 2-10 (~7-9 hours)

---

## Automated Test Runs (Supplement Manual Testing)

Run these against production to catch regressions:

```bash
# Point smoke tests at production (needs dev bypass disabled — use Supabase auth)
# These currently use dev headers, so they'll need minor adaptation for prod
# OR run against local dev server as regression baseline
npm run dev
node scripts/smoke-test.mjs        # 83 endpoint tests
node scripts/smoke-test-e2e.mjs    # 82 workflow tests
npm test                            # 269 unit tests
```

---

## Definition of Done

ServiceOpsIQ is production-ready when:
- [ ] All Phase 0 housekeeping items clean
- [ ] PWA installs on iPhone + Android with branded icon
- [ ] All 4 roles can log in and see only their authorized content
- [ ] Customer portal works end-to-end
- [ ] Core WO lifecycle works (create → assign → complete → invoice)
- [ ] AI insights generate from real mutations
- [ ] CRM call logging and pipeline tracking work
- [ ] PDFs generate with correct data and branding
- [ ] Offline mode shows cached pages and queues mutations
- [ ] No security leaks (cross-org, role bypass, dev bypass)
- [ ] All 5 Vercel crons firing on schedule

---
*Plan created 2026-03-25. Update as items complete.*
