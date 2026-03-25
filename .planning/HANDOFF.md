# Session Handoff — Pre-Launch QA Complete

**Date:** 2026-03-25
**Status:** All code work done — ready for Lance's manual QA on production
**Next action:** Manual testing on serviceopsiq.com (see QA-LAUNCH-PLAN.md)

---

## RESUME INSTRUCTIONS

```
Read these files first:
- .planning/HANDOFF.md
- .planning/QA-LAUNCH-PLAN.md

ServiceOpsIQ v2.0: All features shipped, all automated tests green.
Domain fixed, PWA install ready, security verified.

Last commits:
- 90f25f0 — fix(middleware): Set serviceopsiq.com as canonical host
- a47665d — feat(PWA): Install prompt, SW update banner, manifest enhancements

WHAT WAS DONE 2026-03-25:
1. PWA install prompt component (Android beforeinstallprompt + iOS Share instructions)
2. SW update banner (detects new version, shows "Update now" button)
3. Manifest.json enhancements (id, scope, categories, screenshots)
4. Canonical host fix — middleware was redirecting serviceopsiq.com → vercel.app
5. Removed dead src/middleware.ts (root middleware handles everything)
6. Created QA-LAUNCH-PLAN.md (10-phase pre-launch checklist)
7. Security verified: dev bypass blocked, crons require CRON_SECRET, rate limiting active
8. All automated tests green: 269 unit, 83 smoke, 82 E2E
9. Confirmed ALL deferred AI polish items were already fixed in prior sessions

WHAT LANCE NEEDS TO DO (manual testing):
- Phase 2: Login with each role on serviceopsiq.com
- Phase 3: Create WO → assign → complete → invoice (full lifecycle)
- Phase 4: QBO OAuth connect (needs sandbox)
- Phase 5: Trigger AI insights, test copilot
- Phase 6: CRM calls, pipeline, custom fields
- Phase 7: Install PWA on iPhone + Android, test offline
- Phase 8: Portal login + quote accept
- Phase 10: PDF generation
- Verify Vercel env vars (no DEV_AUTH_BYPASS in production)
- Verify all 5 crons show in Vercel Crons tab

Test suite: 269 passing, 0 failing
Smoke: 83/83 pass
E2E: 82/82 pass (13 workflows)
Build: Clean
```

---

## What Was Done This Session (2026-03-25)

### Phase 0: Housekeeping
- Confirmed `test-tasks-api.mjs` already deleted
- Verified 5 crons in vercel.json
- Discovered and fixed domain redirect issue (see below)

### Phase 1: PWA Polish
- **InstallPrompt.tsx** (new): Captures `beforeinstallprompt` on Android/Chrome, shows iOS Share→Add to Home Screen instructions, dismissible for 7 days via localStorage, hides when already in standalone mode
- **ServiceWorkerRegistration.tsx** (enhanced): Detects new SW waiting, shows blue "Update available" banner with "Update now" button, triggers skipWaiting + reload
- **manifest.json** (enhanced): Added `id`, `scope`, `categories`, `screenshots`, `prefer_related_applications: false`
- **layout.tsx**: Wired InstallPrompt into root layout
- **globals.css**: Added install-prompt + sw-update-banner styles with animations

### Domain Fix (Critical)
- **Root cause**: `middleware.ts` line 5 had `CANONICAL_HOST = "serviceops-ai.vercel.app"` — was forcing 308 redirect AWAY from the custom domain
- **Fix**: Changed to `CANONICAL_HOST = "serviceopsiq.com"`, updated logic so Vercel URLs and www redirect TO the custom domain
- **Verified**: `serviceopsiq.com` → 200, `serviceops-ai.vercel.app` → 308 to serviceopsiq.com, `www.serviceopsiq.com` → 308 to serviceopsiq.com

### Dead Code Cleanup
- Removed `src/middleware.ts` — dead code, root `middleware.ts` takes precedence in Next.js. CORS headers already handled by `next.config.ts`.

### Security Verification (Phase 9)
- ✅ Dev bypass headers return 401 on production
- ✅ All 3 cron endpoints return 401 without CRON_SECRET
- ✅ Rate limiting active: 20 requests → 429 on auth endpoints (confirmed 20/35 split)

### Deferred Items Audit — ALL ALREADY FIXED
Checked every item from the deferred list:
- ✅ copilot-tools.ts: `parseDate()` + `validateEnum()` helpers already present
- ✅ ai-copilot.ts: Token budget guard (MAX_TURN_TOKENS=25000) + input trimming already present
- ✅ AiSuggestedTechBadge: Rollback on failed dismiss already present (setDismissed(false) + toast)
- ✅ AiAlertsWidget: role="button", tabIndex={0}, onKeyDown already present
- ✅ Conversations routes: Cache-Control: no-store already present on both GET routes
- ✅ quotes/[id]/page.tsx: Already uses apiFetch everywhere (9 calls, zero bare fetch)

### Automated Test Results
- Unit tests: 269 pass / 0 fail / 32 todo
- Smoke tests: 83/83 pass (197 endpoints)
- E2E workflows: 82/82 pass (13 workflows)

---

## Files Created (2)
- `src/components/common/InstallPrompt.tsx`
- `.planning/QA-LAUNCH-PLAN.md`

## Files Modified (4)
- `public/manifest.json` — enhanced for PWA
- `src/components/common/ServiceWorkerRegistration.tsx` — SW update banner
- `src/app/layout.tsx` — wired InstallPrompt
- `src/app/globals.css` — install prompt + update banner styles
- `middleware.ts` — canonical host → serviceopsiq.com

## Files Deleted (1)
- `src/middleware.ts` — dead code (root middleware takes precedence)

---

## Remaining (Lance Manual Testing Only)
- See `.planning/QA-LAUNCH-PLAN.md` for full 10-phase checklist
- No code changes needed — all items are manual verification on production
- 32 QBO todo tests remain (edge cases, low priority)

---
*Last updated: 2026-03-25*
