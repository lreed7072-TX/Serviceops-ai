#!/usr/bin/env node
/**
 * ServiceOpsIQ — Full API Smoke Test
 * Tests every major API endpoint for basic reachability and auth.
 * Run: node scripts/smoke-test.mjs
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ORG_ID = process.env.DEV_ORG_ID || '951acf8a-bd4d-411c-abd1-f8127843c44c';
const USER_ID = process.env.DEV_USER_ID || 'd4d9a35b-9b87-4c45-8fbd-fafc6dd51364';
const ROLE = process.env.DEV_ROLE || 'ADMIN';

const headers = {
  'Content-Type': 'application/json',
  'x-org-id': ORG_ID,
  'x-user-id': USER_ID,
  'x-role': ROLE,
};

const results = { pass: 0, fail: 0, skip: 0, errors: [] };

async function test(name, method, path, opts = {}) {
  const { expectedStatus, body, query, skipReason } = opts;
  const expected = expectedStatus || (method === 'POST' ? [200, 201] : [200]);
  const expectedArr = Array.isArray(expected) ? expected : [expected];

  if (skipReason) {
    results.skip++;
    process.stdout.write(`  ⏭️  ${name} — ${skipReason}\n`);
    return null;
  }

  const url = `${BASE}/api${path}${query ? '?' + new URLSearchParams(query) : ''}`;
  try {
    const fetchOpts = { method, headers: { ...headers }, signal: AbortSignal.timeout(15000) };
    if (body) fetchOpts.body = JSON.stringify(body);
    if (opts.headers) Object.assign(fetchOpts.headers, opts.headers);

    const res = await fetch(url, fetchOpts);
    if (expectedArr.includes(res.status)) {
      results.pass++;
      process.stdout.write(`  ✅ ${name}\n`);
      try { return await res.json(); } catch { return null; }
    } else {
      const text = await res.text().catch(() => '');
      results.fail++;
      const msg = `${name} — expected ${expectedArr.join('|')}, got ${res.status}: ${text.slice(0, 120)}`;
      results.errors.push(msg);
      process.stdout.write(`  ❌ ${msg}\n`);
      return null;
    }
  } catch (err) {
    results.fail++;
    const msg = `${name} — ${err.message}`;
    results.errors.push(msg);
    process.stdout.write(`  ❌ ${msg}\n`);
    return null;
  }
}

// Collect IDs during tests for dependent endpoints
const ids = {};

async function run() {
  console.log(`\n🔥 ServiceOpsIQ Smoke Test — ${BASE}\n`);
  console.log(`Auth: org=${ORG_ID.slice(0, 8)}… user=${USER_ID.slice(0, 8)}… role=${ROLE}\n`);

  // ── AUTH ──────────────────────────────────────────
  console.log('── AUTH ──');
  await test('GET /auth/me (cookie-only, expect 401)', 'GET', '/auth/me', { expectedStatus: [401] });

  // ── DASHBOARD ────────────────────────────────────
  console.log('\n── DASHBOARD ──');
  await test('GET /dashboard/stats', 'GET', '/dashboard/stats');

  // ── CUSTOMERS ────────────────────────────────────
  console.log('\n── CUSTOMERS ──');
  const custData = await test('GET /customers', 'GET', '/customers');
  {
    const list = custData?.data || [];
    if (list.length > 0) {
      ids.customerId = list[0].id;
      await test('GET /customers/:id', 'GET', `/customers/${ids.customerId}`);
      await test('GET /customers/:id/activity', 'GET', `/customers/${ids.customerId}/activity`);
    }
  }

  // ── SITES ────────────────────────────────────────
  console.log('\n── SITES ──');
  const siteData = await test('GET /sites', 'GET', '/sites');
  {
    const list = siteData?.data || [];
    if (list.length > 0) {
      ids.siteId = list[0].id;
      await test('GET /sites/:id', 'GET', `/sites/${ids.siteId}`);
    }
  }

  // ── ASSETS ───────────────────────────────────────
  console.log('\n── ASSETS ──');
  const assetData = await test('GET /assets', 'GET', '/assets');
  {
    const list = assetData?.data || [];
    if (list.length > 0) {
      ids.assetId = list[0].id;
      await test('GET /assets/:id', 'GET', `/assets/${ids.assetId}`);
    }
  }

  // ── WORK ORDERS ──────────────────────────────────
  console.log('\n── WORK ORDERS ──');
  const woData = await test('GET /work-orders', 'GET', '/work-orders');
  {
    const list = woData?.data || [];
    if (list.length > 0) {
      ids.workOrderId = list[0].id;
      await test('GET /work-orders/:id', 'GET', `/work-orders/${ids.workOrderId}`);
      await test('GET /work-orders/:id/tasks', 'GET', `/work-orders/${ids.workOrderId}/tasks`);
      await test('GET /work-orders/:id/photos', 'GET', `/work-orders/${ids.workOrderId}/photos`);
      await test('GET /work-orders/:id/signatures', 'GET', `/work-orders/${ids.workOrderId}/signatures`);
      await test('GET /work-orders/:id/packages', 'GET', `/work-orders/${ids.workOrderId}/packages`);
      await test('GET /work-orders/:id/report', 'GET', `/work-orders/${ids.workOrderId}/report`);
    }
  }

  // ── VISITS ───────────────────────────────────────
  console.log('\n── VISITS ──');
  const visitData = await test('GET /visits', 'GET', '/visits');
  {
    const list = visitData?.data || [];
    if (list.length > 0) {
      ids.visitId = list[0].id;
      await test('GET /visits/:id', 'GET', `/visits/${ids.visitId}`);
    }
  }

  // ── QUOTES ───────────────────────────────────────
  console.log('\n── QUOTES ──');
  const quoteData = await test('GET /quotes', 'GET', '/quotes');
  {
    const list = quoteData?.data || [];
    if (list.length > 0) {
      ids.quoteId = list[0].id;
      await test('GET /quotes/:id', 'GET', `/quotes/${ids.quoteId}`);
      await test('GET /quotes/:id/line-items', 'GET', `/quotes/${ids.quoteId}/line-items`);
    }
  }

  // ── INVOICES ─────────────────────────────────────
  console.log('\n── INVOICES ──');
  const invData = await test('GET /invoices', 'GET', '/invoices');
  {
    const list = invData?.data || [];
    if (list.length > 0) {
      ids.invoiceId = list[0].id;
      await test('GET /invoices/:id', 'GET', `/invoices/${ids.invoiceId}`);
    }
  }

  // ── MATERIALS ────────────────────────────────────
  console.log('\n── MATERIALS ──');
  await test('GET /materials', 'GET', '/materials');
  await test('GET /materials/duplicates', 'GET', '/materials/duplicates');
  await test('GET /inventory/low-stock', 'GET', '/inventory/low-stock');

  // ── PM SCHEDULES ─────────────────────────────────
  console.log('\n── PM SCHEDULES ──');
  await test('GET /pm-schedules', 'GET', '/pm-schedules');

  // ── PROCEDURE TEMPLATES ──────────────────────────
  console.log('\n── PROCEDURE TEMPLATES ──');
  await test('GET /procedure-templates', 'GET', '/procedure-templates');

  // ── STANDARDS PACKS ──────────────────────────────
  console.log('\n── STANDARDS PACKS ──');
  await test('GET /standards-packs', 'GET', '/standards-packs');

  // ── USERS ────────────────────────────────────────
  console.log('\n── USERS ──');
  await test('GET /users (ADMIN)', 'GET', '/users');

  // ── VENDORS ──────────────────────────────────────
  console.log('\n── VENDORS ──');
  await test('GET /vendors', 'GET', '/vendors');

  // ── LABOR RATES ──────────────────────────────────
  console.log('\n── LABOR RATES ──');
  await test('GET /labor-rates', 'GET', '/labor-rates');
  await test('GET /settings/labor-rates', 'GET', '/settings/labor-rates');

  // ── REPORT TEMPLATES ─────────────────────────────
  console.log('\n── REPORT TEMPLATES ──');
  await test('GET /report-templates', 'GET', '/report-templates');

  // ── KNOWLEDGE BASE ───────────────────────────────
  console.log('\n── KNOWLEDGE BASE ──');
  await test('GET /knowledge-base', 'GET', '/knowledge-base');

  // ── NOTIFICATIONS ────────────────────────────────
  console.log('\n── NOTIFICATIONS ──');
  await test('GET /notifications', 'GET', '/notifications');

  // ── SEARCH ───────────────────────────────────────
  console.log('\n── SEARCH ──');
  await test('GET /search?q=pump', 'GET', '/search', { query: { q: 'pump' } });

  // ── ANALYTICS ────────────────────────────────────
  console.log('\n── ANALYTICS ──');
  await test('GET /analytics/work-orders', 'GET', '/analytics/work-orders');
  await test('GET /analytics/revenue', 'GET', '/analytics/revenue');
  await test('GET /analytics/quotes', 'GET', '/analytics/quotes');
  await test('GET /analytics/materials', 'GET', '/analytics/materials');

  // ── AUDIT LOGS ───────────────────────────────────
  console.log('\n── AUDIT LOGS ──');
  await test('GET /audit-logs', 'GET', '/audit-logs');

  // ── ORGANIZATION ─────────────────────────────────
  console.log('\n── ORGANIZATION ──');
  await test('GET /organization', 'GET', '/organization');

  // ── AI FEATURES ──────────────────────────────────
  console.log('\n── AI FEATURES ──');
  await test('GET /ai/insights', 'GET', '/ai/insights');
  await test('GET /ai/stats', 'GET', '/ai/stats');
  await test('GET /ai/conversations', 'GET', '/ai/conversations');

  // ── QBO INTEGRATION ──────────────────────────────
  console.log('\n── QBO INTEGRATION ──');
  await test('GET /integrations/qbo/status', 'GET', '/integrations/qbo/status');
  await test('GET /integrations/qbo/health', 'GET', '/integrations/qbo/health');
  await test('GET /integrations/qbo/sync-logs', 'GET', '/integrations/qbo/sync-logs');
  await test('GET /integrations/qbo/account-mapping', 'GET', '/integrations/qbo/account-mapping');

  // ── CRM MODULE ───────────────────────────────────
  console.log('\n── CRM MODULE ──');
  await test('GET /crm/industries', 'GET', '/crm/industries');
  await test('GET /crm/lead-sources', 'GET', '/crm/lead-sources');
  await test('GET /crm/call-types', 'GET', '/crm/call-types');
  await test('GET /crm/call-outcomes', 'GET', '/crm/call-outcomes');
  await test('GET /crm/follow-up-types', 'GET', '/crm/follow-up-types');
  await test('GET /crm/custom-fields', 'GET', '/crm/custom-fields');
  await test('GET /crm/dashboard', 'GET', '/crm/dashboard');
  await test('GET /crm/reports/pipeline-summary', 'GET', '/crm/reports/pipeline-summary');
  await test('GET /crm/reports/call-activity', 'GET', '/crm/reports/call-activity');
  await test('GET /crm/reports/follow-up-performance', 'GET', '/crm/reports/follow-up-performance');
  await test('GET /crm/reports/customer-coverage', 'GET', '/crm/reports/customer-coverage');
  await test('GET /crm/reports/win-loss', 'GET', '/crm/reports/win-loss');
  await test('GET /contacts', 'GET', '/contacts');
  await test('GET /call-logs', 'GET', '/call-logs');
  await test('GET /follow-ups', 'GET', '/follow-ups');
  await test('GET /opportunities', 'GET', '/opportunities');
  await test('GET /service-tickets', 'GET', '/service-tickets');

  // ── PORTAL (unauthenticated — expect 401) ────────
  console.log('\n── PORTAL (expect 401 without portal token) ──');
  await test('GET /portal/quotes (no token)', 'GET', '/portal/quotes', { expectedStatus: [401] });
  await test('GET /portal/invoices (no token)', 'GET', '/portal/invoices', { expectedStatus: [401] });
  await test('GET /portal/work-orders (no token)', 'GET', '/portal/work-orders', { expectedStatus: [401] });

  // ── TECH ENDPOINTS ───────────────────────────────
  console.log('\n── TECH ENDPOINTS ──');
  await test('GET /tech/tasks (as TECH)', 'GET', '/tech/tasks', { headers: { 'x-role': 'TECH' } });
  await test('GET /tech/timer', 'GET', '/tech/timer');
  await test('GET /me/active-check-in', 'GET', '/me/active-check-in');

  // ── FILES (requires query params) ────────────────
  console.log('\n── FILES ──');
  await test('GET /files (with params)', 'GET', '/files', { query: { entityType: 'WORK_ORDER', entityId: ids.workOrderId || 'none' }, expectedStatus: [200, 400] });

  // ── FORM RESPONSES ───────────────────────────────
  console.log('\n── FORM RESPONSES ──');
  await test('GET /form-responses', 'GET', '/form-responses');

  // ── WRITE OPERATIONS (create → update → delete) ──
  console.log('\n── WRITE OPERATIONS (create → update → delete) ──');

  // Customer CRUD
  {
    const createRes = await test('POST /customers (create)', 'POST', '/customers', {
      body: { name: `__SMOKE_TEST_${Date.now()}` },
    });
    if (createRes?.data?.id) {
      const testId = createRes.data.id;
      await test('PUT /customers/:id (update)', 'PUT', `/customers/${testId}`, {
        body: { name: `__SMOKE_UPDATED`, primaryPhone: '555-9999' },
      });
      await test('DELETE /customers/:id (cleanup)', 'DELETE', `/customers/${testId}`);
    }
  }

  // Material CRUD
  {
    const createRes = await test('POST /materials (create)', 'POST', '/materials', {
      body: { name: `__SMOKE_MAT_${Date.now()}`, partNumber: 'SM-000', unitCost: '10.00' },
    });
    if (createRes?.data?.id) {
      await test('DELETE /materials/:id (cleanup)', 'DELETE', `/materials/${createRes.data.id}`);
    }
  }

  // ── ROLE-BASED ACCESS ────────────────────────────
  console.log('\n── ROLE-BASED ACCESS ──');
  // TECH should NOT access /users
  await test('GET /users as TECH → 403', 'GET', '/users', {
    headers: { 'x-role': 'TECH' },
    expectedStatus: [403],
  });
  // SALES should NOT access /users
  await test('GET /users as SALES → 403', 'GET', '/users', {
    headers: { 'x-role': 'SALES' },
    expectedStatus: [403],
  });
  // DISPATCHER should access /users
  await test('GET /users as DISPATCHER → 200', 'GET', '/users', {
    headers: { 'x-role': 'DISPATCHER' },
  });

  // ── SUMMARY ──────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 SMOKE TEST RESULTS`);
  console.log(`   ✅ Passed: ${results.pass}`);
  console.log(`   ❌ Failed: ${results.fail}`);
  console.log(`   ⏭️  Skipped: ${results.skip}`);
  console.log(`   Total: ${results.pass + results.fail + results.skip}`);

  if (results.errors.length > 0) {
    console.log(`\n🔴 FAILURES:`);
    results.errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
  } else {
    console.log(`\n🟢 ALL TESTS PASSED`);
  }

  console.log('\n' + '═'.repeat(60));
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
