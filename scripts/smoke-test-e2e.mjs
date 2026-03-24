#!/usr/bin/env node
/**
 * ServiceOpsIQ — Full End-to-End Smoke Test
 * Tests all critical user workflows across Admin, Tech, Sales, and Portal apps.
 * Run: node scripts/smoke-test-e2e.mjs
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ORG_ID = process.env.DEV_ORG_ID || '951acf8a-bd4d-411c-abd1-f8127843c44c';
// Use REAL user IDs from the DB (dev bypass creates auth context, but FKs need real User rows)
const USER_ID = process.env.DEV_USER_ID || 'd4d9a35b-9b87-4c45-8fbd-fafc6dd51364'; // Lance Reed, ADMIN
const TECH_USER_ID = process.env.DEV_TECH_ID || '75088e57-efad-4108-89f5-ec466a60c8de'; // lance@gpspumps.com, TECH

function makeHeaders(role = 'ADMIN') {
  return {
    'Content-Type': 'application/json',
    'x-org-id': ORG_ID,
    'x-user-id': USER_ID,
    'x-role': role,
  };
}

const results = { pass: 0, fail: 0, errors: [] };
const ids = {}; // Collected IDs for dependent tests

async function api(method, path, opts = {}) {
  const { body, role, query, raw } = opts;
  const url = `${BASE}/api${path}${query ? '?' + new URLSearchParams(query) : ''}`;
  const fetchOpts = {
    method,
    headers: makeHeaders(role || 'ADMIN'),
    signal: AbortSignal.timeout(20000),
  };
  if (body) fetchOpts.body = JSON.stringify(body);
  const res = await fetch(url, fetchOpts);
  if (raw) return res;
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, ok: res.ok };
}

function ok(name, passed, detail) {
  if (passed) {
    results.pass++;
    process.stdout.write(`  ✅ ${name}\n`);
  } else {
    results.fail++;
    const msg = `${name}${detail ? ' — ' + detail : ''}`;
    results.errors.push(msg);
    process.stdout.write(`  ❌ ${msg}\n`);
  }
  return passed;
}

async function run() {
  console.log(`\n🔥 ServiceOpsIQ E2E Smoke Test — ${BASE}`);
  console.log(`   Testing all critical workflows across Admin, Tech, Sales, Portal\n`);

  // ════════════════════════════════════════════════════
  // WORKFLOW 1: FULL FIELD SERVICE LIFECYCLE
  // Create customer → site → asset → WO → assign tech →
  // tech tasks → complete → generate invoice → cleanup
  // ════════════════════════════════════════════════════
  console.log('══ WORKFLOW 1: Field Service Lifecycle ══');

  // 1a. Create customer
  let r = await api('POST', '/customers', { body: { name: `__E2E_Customer_${Date.now()}` } });
  if (!ok('Create customer', r.status === 201 || r.status === 200, `${r.status}`)) return abort();
  ids.customer = r.data?.data?.id || r.data?.id;

  // 1b. Create site
  r = await api('POST', '/sites', { body: { name: `__E2E_Site_${Date.now()}`, customerId: ids.customer } });
  if (!ok('Create site', r.ok, `${r.status}`)) return abort();
  ids.site = r.data?.data?.id || r.data?.id;

  // 1c. Create asset (requires customerId + siteId UUIDs, assetCategory enum)
  r = await api('POST', '/assets', { body: {
    name: `__E2E_Pump_${Date.now()}`, customerId: ids.customer, siteId: ids.site,
    assetCategory: 'ROTATING_EQUIPMENT', assetFamily: 'PUMP', status: 'ACTIVE', criticality: 'HIGH',
  }});
  if (!ok('Create asset', r.ok, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`)) { ids.asset = null; }
  else { ids.asset = r.data?.data?.id || r.data?.id; }

  // 1d. Create work order (assetId optional)
  const woBody = {
    title: `__E2E_WO_${Date.now()}`, customerId: ids.customer, siteId: ids.site,
    orderType: 'WORK_ORDER', description: 'E2E smoke test work order',
  };
  if (ids.asset) woBody.assetId = ids.asset;
  r = await api('POST', '/work-orders', { body: woBody });
  if (!ok('Create work order', r.ok, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`)) return abort();
  ids.wo = r.data?.data?.id || r.data?.id;

  // 1e. Read WO back
  r = await api('GET', `/work-orders/${ids.wo}`);
  ok('Read work order', r.ok && r.data?.data?.id === ids.wo, `${r.status}`);

  // 1f. Add task to WO
  r = await api('POST', `/work-orders/${ids.wo}/tasks`, { body: {
    title: '__E2E_Task_1', description: 'Smoke test task', packageType: 'MECHANICAL',
  }});
  ok('Add task to WO', r.ok, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  ids.task = r.data?.data?.id || r.data?.id;

  // 1g. Assign tech (use real TECH user — assign-tech validates role=TECH)
  r = await api('POST', `/work-orders/${ids.wo}/assign-tech`, { body: { techId: TECH_USER_ID } });
  ok('Assign tech to WO', r.ok, `${r.status}`);

  // 1h. Start WO (IN_PROGRESS)
  r = await api('PATCH', `/work-orders/${ids.wo}`, { body: { status: 'IN_PROGRESS' } });
  ok('Start WO (IN_PROGRESS)', r.ok, `${r.status}`);

  // 1i. Tech reads tasks
  r = await api('GET', `/work-orders/${ids.wo}/tasks`);
  ok('Tech: read WO tasks', r.ok, `${r.status}`);

  // 1j. Tech completes task (TaskStatus enum: TODO, IN_PROGRESS, DONE, BLOCKED, SKIPPED)
  if (ids.task) {
    r = await api('PATCH', `/tasks/${ids.task}`, { body: { status: 'DONE' }, role: 'TECH' });
    ok('Tech: complete task', r.ok, `${r.status}`);
  }

  // 1k. Read photos endpoint
  r = await api('GET', `/work-orders/${ids.wo}/photos`);
  ok('Read WO photos', r.ok || r.status === 200, `${r.status}`);

  // 1l. Read signatures endpoint
  r = await api('GET', `/work-orders/${ids.wo}/signatures`);
  ok('Read WO signatures', r.ok, `${r.status}`);

  // 1m. Complete WO
  r = await api('PATCH', `/work-orders/${ids.wo}`, { body: { status: 'COMPLETED' } });
  ok('Complete WO', r.ok, `${r.status}`);

  // 1n. Generate invoice from WO
  r = await api('POST', '/invoices', { body: {
    title: `__E2E_Invoice_${Date.now()}`, customerId: ids.customer,
    siteId: ids.site, workOrderId: ids.wo, taxRate: 8.25,
  }});
  ok('Generate invoice from WO', r.ok, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  ids.invoice = r.data?.data?.id || r.data?.id;

  // 1o. Read invoice back
  if (ids.invoice) {
    r = await api('GET', `/invoices/${ids.invoice}`);
    ok('Read invoice', r.ok, `${r.status}`);
  }

  // 1p. WO report endpoint
  r = await api('GET', `/work-orders/${ids.wo}/report`);
  ok('Read WO report', r.ok || r.status === 200, `${r.status}`);

  // ════════════════════════════════════════════════════
  // WORKFLOW 2: QUOTE-TO-WORK-ORDER
  // ════════════════════════════════════════════════════
  console.log('\n══ WORKFLOW 2: Quote → WO Conversion ══');

  // 2a. Create quote (include siteId for WO conversion)
  r = await api('POST', '/quotes', { body: {
    title: `__E2E_Quote_${Date.now()}`, customerId: ids.customer, siteId: ids.site,
    description: 'E2E quote smoke test', taxRate: 8.25,
    validUntil: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
  }});
  ok('Create quote (DRAFT)', r.ok, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  ids.quote = r.data?.data?.id || r.data?.id;

  if (ids.quote) {
    // 2b. Add line items (itemType: LABOR|MATERIAL|SERVICE|OTHER)
    r = await api('POST', `/quotes/${ids.quote}/line-items`, { body: {
      description: 'Pump repair labor', itemType: 'LABOR', quantity: 4, unitPrice: 150,
    }});
    ok('Add quote line item', r.ok, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);

    // 2c. Read quote with line items
    r = await api('GET', `/quotes/${ids.quote}`);
    ok('Read quote detail', r.ok, `${r.status}`);

    // 2d. Send quote
    r = await api('PATCH', `/quotes/${ids.quote}`, { body: { status: 'SENT' } });
    ok('Send quote (SENT)', r.ok, `${r.status}`);

    // 2e. Accept / convert to WO
    r = await api('POST', `/quotes/${ids.quote}/accept`);
    ok('Accept quote → WO', r.ok || r.status === 200 || r.status === 201, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
    ids.quoteWo = r.data?.data?.id || r.data?.workOrderId || r.data?.data?.workOrderId;

    // 2f. Duplicate quote
    r = await api('POST', `/quotes/${ids.quote}/duplicate`);
    ok('Duplicate quote', r.ok, `${r.status}`);
    ids.quoteDup = r.data?.data?.id || r.data?.id;
  }

  // ════════════════════════════════════════════════════
  // WORKFLOW 3: CRM / SALES PIPELINE
  // ════════════════════════════════════════════════════
  console.log('\n══ WORKFLOW 3: CRM / Sales Pipeline ══');

  // 3a. CRM dashboard
  r = await api('GET', '/crm/dashboard');
  ok('CRM dashboard', r.ok, `${r.status}`);

  // 3b. Create contact (requires ADMIN or SALES role)
  r = await api('POST', '/contacts', { body: {
    customerId: ids.customer, firstName: '__E2E', lastName: 'Contact',
    email: 'e2e@smoke.test', phone: '555-1234', isPrimary: true,
  }});
  ok('Create contact', r.ok, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  ids.contact = r.data?.data?.id || r.data?.id;

  // 3c. Seed CRM lookups if empty, then fetch IDs
  let callTypeId = null, callOutcomeId = null;
  {
    let ctRes = await api('GET', '/crm/call-types');
    let callTypes = ctRes.data?.data || [];
    if (callTypes.length === 0) {
      await api('POST', '/crm/call-types', { body: { name: '__E2E_CallType', sortOrder: 99 } });
      ctRes = await api('GET', '/crm/call-types');
      callTypes = ctRes.data?.data || [];
    }
    callTypeId = callTypes[0]?.id || null;
    ids._callTypeCreated = callTypes.find(ct => ct.name === '__E2E_CallType')?.id;

    let coRes = await api('GET', '/crm/call-outcomes');
    let callOutcomes = coRes.data?.data || [];
    if (callOutcomes.length === 0) {
      await api('POST', '/crm/call-outcomes', { body: { name: '__E2E_Outcome', sortOrder: 99, triggersFollowUp: false, triggersOpportunityPrompt: false } });
      coRes = await api('GET', '/crm/call-outcomes');
      callOutcomes = coRes.data?.data || [];
    }
    callOutcomeId = callOutcomes[0]?.id || null;
    ids._callOutcomeCreated = callOutcomes.find(co => co.name === '__E2E_Outcome')?.id;
  }

  // 3c. Log a call (requires callTypeId, callOutcomeId, callMethod, callTimestamp)
  if (callTypeId && callOutcomeId) {
    r = await api('POST', '/call-logs', { body: {
      customerId: ids.customer, contactId: ids.contact,
      callTypeId, callOutcomeId, callMethod: 'PHONE',
      callTimestamp: new Date().toISOString(),
      callDuration: 300, notes: 'E2E test call',
    }, role: 'SALES' });
    ok('Log call (SALES)', r.ok, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
    ids.callLog = r.data?.data?.id || r.data?.id;
  } else {
    ok('Log call (SALES)', false, 'Could not create CRM seed data');
  }

  // 3d. Create follow-up (requires assignedToUserId; priority: HOT/NORMAL/LOW)
  r = await api('POST', '/follow-ups', { body: {
    customerId: ids.customer, contactId: ids.contact,
    assignedToUserId: USER_ID, // must be a real User in the org
    title: '__E2E Follow-Up', dueDate: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
    priority: 'NORMAL', notes: 'Follow up on E2E test',
  }, role: 'SALES' });
  ok('Create follow-up', r.ok, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  ids.followUp = r.data?.data?.id || r.data?.id;

  // 3e. Create opportunity (field: name not title, status not stage, amount not value)
  r = await api('POST', '/opportunities', { body: {
    customerId: ids.customer, name: `__E2E_Opp_${Date.now()}`,
    status: 'PROSPECTING', amount: 25000,
    expectedCloseDate: new Date(Date.now() + 60*24*60*60*1000).toISOString(),
  }, role: 'SALES' });
  ok('Create opportunity', r.ok, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  ids.opportunity = r.data?.data?.id || r.data?.id;

  // 3f. Update opportunity status (uses PUT, not PATCH)
  if (ids.opportunity) {
    r = await api('PUT', `/opportunities/${ids.opportunity}`, { body: { status: 'QUALIFICATION' }, role: 'SALES' });
    ok('Advance opportunity stage', r.ok, `${r.status}`);
  }

  // 3g. CRM reports
  r = await api('GET', '/crm/reports/pipeline-summary');
  ok('CRM pipeline report', r.ok, `${r.status}`);
  r = await api('GET', '/crm/reports/call-activity');
  ok('CRM call activity report', r.ok, `${r.status}`);

  // 3h. All CRM lookups
  const lookups = ['industries', 'lead-sources', 'call-types', 'call-outcomes', 'follow-up-types', 'custom-fields'];
  for (const lookup of lookups) {
    r = await api('GET', `/crm/${lookup}`);
    ok(`CRM lookup: ${lookup}`, r.ok, `${r.status}`);
  }

  // ════════════════════════════════════════════════════
  // WORKFLOW 4: TECH APP FLOWS
  // ════════════════════════════════════════════════════
  console.log('\n══ WORKFLOW 4: Tech App ══');

  // 4a. Tech tasks list
  r = await api('GET', '/tech/tasks', { role: 'TECH' });
  ok('Tech: task list', r.ok, `${r.status}`);

  // 4b. Tech timer
  r = await api('GET', '/tech/timer', { role: 'TECH' });
  ok('Tech: timer state', r.ok, `${r.status}`);

  // 4c. Tech active check-in
  r = await api('GET', '/me/active-check-in', { role: 'TECH' });
  ok('Tech: active check-in', r.ok, `${r.status}`);

  // 4d. Tech photos (uses Supabase session auth, not dev-header bypass — expect 401)
  r = await api('GET', '/tech/photos/free', { role: 'TECH' });
  ok('Tech: free photos (Supabase-only auth)', r.status === 401 || r.ok, `${r.status}`);

  // ════════════════════════════════════════════════════
  // WORKFLOW 5: PORTAL (Customer-Facing)
  // ════════════════════════════════════════════════════
  console.log('\n══ WORKFLOW 5: Portal ══');

  // 5a. Portal endpoints require portal token, should reject header auth
  r = await api('GET', '/portal/quotes');
  ok('Portal: quotes reject without token', r.status === 401, `got ${r.status}`);
  r = await api('GET', '/portal/invoices');
  ok('Portal: invoices reject without token', r.status === 401, `got ${r.status}`);
  r = await api('GET', '/portal/work-orders');
  ok('Portal: work-orders reject without token', r.status === 401, `got ${r.status}`);

  // 5b. Grant portal access to test customer (requires email since customer has no primaryEmail)
  r = await api('POST', `/customers/${ids.customer}/portal-access`, {
    body: { email: 'e2e-portal@smoke.test' },
  });
  ok('Grant portal access', r.ok || r.status === 200 || r.status === 201 || r.status === 409, `${r.status}`);

  // ════════════════════════════════════════════════════
  // WORKFLOW 6: PM SCHEDULE AUTOMATION
  // ════════════════════════════════════════════════════
  console.log('\n══ WORKFLOW 6: PM Schedules ══');

  r = await api('GET', '/pm-schedules');
  ok('List PM schedules', r.ok, `${r.status}`);

  if (ids.asset) {
    r = await api('POST', '/pm-schedules', { body: {
      name: `__E2E_PM_${Date.now()}`, assetId: ids.asset,
      frequencyType: 'MONTHLY', frequencyValue: 1,
      startDate: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
      priority: 'MEDIUM',
    }});
    ok('Create PM schedule', r.ok, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
    ids.pm = r.data?.data?.id || r.data?.id;
  }

  // ════════════════════════════════════════════════════
  // WORKFLOW 7: MATERIALS & INVENTORY
  // ════════════════════════════════════════════════════
  console.log('\n══ WORKFLOW 7: Materials & Inventory ══');

  r = await api('POST', '/materials', { body: {
    name: `__E2E_Material_${Date.now()}`, partNumber: 'E2E-001', unitCost: '25.50', category: 'PART',
  }});
  ok('Create material', r.ok, `${r.status}`);
  ids.material = r.data?.data?.id || r.data?.id;

  r = await api('GET', '/materials/duplicates');
  ok('Check material duplicates', r.ok, `${r.status}`);

  r = await api('GET', '/inventory/low-stock');
  ok('Low stock check', r.ok, `${r.status}`);

  // ════════════════════════════════════════════════════
  // WORKFLOW 8: ANALYTICS & REPORTING
  // ════════════════════════════════════════════════════
  console.log('\n══ WORKFLOW 8: Analytics & Reporting ══');

  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30*24*60*60*1000);
  const dateQuery = { startDate: thirtyDaysAgo.toISOString(), endDate: now.toISOString() };

  r = await api('GET', '/analytics/work-orders', { query: dateQuery });
  ok('Analytics: work orders', r.ok, `${r.status}`);
  r = await api('GET', '/analytics/revenue', { query: dateQuery });
  ok('Analytics: revenue', r.ok, `${r.status}`);
  r = await api('GET', '/analytics/quotes', { query: dateQuery });
  ok('Analytics: quotes', r.ok, `${r.status}`);
  r = await api('GET', '/analytics/materials', { query: dateQuery });
  ok('Analytics: materials', r.ok, `${r.status}`);

  // ════════════════════════════════════════════════════
  // WORKFLOW 9: QBO INTEGRATION
  // ════════════════════════════════════════════════════
  console.log('\n══ WORKFLOW 9: QBO Integration ══');

  r = await api('GET', '/integrations/qbo/status');
  ok('QBO: connection status', r.ok, `${r.status}`);
  r = await api('GET', '/integrations/qbo/health');
  ok('QBO: health check', r.ok, `${r.status}`);
  r = await api('GET', '/integrations/qbo/sync-logs');
  ok('QBO: sync logs', r.ok, `${r.status}`);
  r = await api('GET', '/integrations/qbo/account-mapping');
  ok('QBO: account mapping', r.ok, `${r.status}`);

  // ════════════════════════════════════════════════════
  // WORKFLOW 10: AI FEATURES
  // ════════════════════════════════════════════════════
  console.log('\n══ WORKFLOW 10: AI Features ══');

  r = await api('GET', '/ai/insights');
  ok('AI: insights list', r.ok, `${r.status}`);
  r = await api('GET', '/ai/stats');
  ok('AI: statistics', r.ok, `${r.status}`);
  r = await api('GET', '/ai/conversations');
  ok('AI: conversations', r.ok, `${r.status}`);

  // ════════════════════════════════════════════════════
  // WORKFLOW 11: ADMIN FEATURES
  // ════════════════════════════════════════════════════
  console.log('\n══ WORKFLOW 11: Admin Features ══');

  r = await api('GET', '/users');
  ok('Admin: user list', r.ok, `${r.status}`);
  r = await api('GET', '/audit-logs');
  ok('Admin: audit logs', r.ok, `${r.status}`);
  r = await api('GET', '/organization');
  ok('Admin: organization', r.ok, `${r.status}`);
  r = await api('GET', '/notifications');
  ok('Admin: notifications', r.ok, `${r.status}`);
  r = await api('GET', '/search', { query: { q: 'pump' } });
  ok('Admin: global search', r.ok, `${r.status}`);
  r = await api('GET', '/knowledge-base');
  ok('Admin: knowledge base', r.ok, `${r.status}`);
  r = await api('GET', '/labor-rates');
  ok('Admin: labor rates', r.ok, `${r.status}`);
  r = await api('GET', '/vendors');
  ok('Admin: vendors', r.ok, `${r.status}`);

  // ════════════════════════════════════════════════════
  // WORKFLOW 12: TEMPLATES & STANDARDS
  // ════════════════════════════════════════════════════
  console.log('\n══ WORKFLOW 12: Templates & Standards ══');

  r = await api('GET', '/procedure-templates');
  ok('Procedure templates list', r.ok, `${r.status}`);
  r = await api('GET', '/standards-packs');
  ok('Standards packs list', r.ok, `${r.status}`);
  r = await api('GET', '/report-templates');
  ok('Report templates list', r.ok, `${r.status}`);
  r = await api('GET', '/form-responses');
  ok('Form responses list', r.ok, `${r.status}`);

  // ════════════════════════════════════════════════════
  // WORKFLOW 13: SERVICE TICKETS → WO CONVERSION
  // ════════════════════════════════════════════════════
  console.log('\n══ WORKFLOW 13: Service Tickets ══');

  r = await api('POST', '/service-tickets', { body: {
    customerId: ids.customer, siteId: ids.site,
    reasonForService: 'Customer reports pump vibration — E2E smoke test',
    urgency: 'HIGH', notes: `__E2E_Ticket_${Date.now()}`,
  }});
  ok('Create service ticket', r.ok, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  ids.ticket = r.data?.data?.id || r.data?.id;

  if (ids.ticket) {
    r = await api('GET', `/service-tickets/${ids.ticket}`);
    ok('Read service ticket', r.ok, `${r.status}`);

    // Convert to WO
    r = await api('POST', `/service-tickets/${ids.ticket}/convert-to-work-order`);
    ok('Convert ticket → WO', r.ok || r.status === 200 || r.status === 201, `${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  }

  // ════════════════════════════════════════════════════
  // ROLE-BASED ACCESS CONTROL
  // ════════════════════════════════════════════════════
  console.log('\n══ ROLE-BASED ACCESS CONTROL ══');

  // TECH cannot access admin routes
  r = await api('GET', '/users', { role: 'TECH' });
  ok('TECH blocked from /users', r.status === 403, `got ${r.status}`);
  r = await api('GET', '/audit-logs', { role: 'TECH' });
  ok('TECH blocked from /audit-logs', r.status === 403 || r.status === 401, `got ${r.status}`);

  // SALES can access CRM but should be scoped
  r = await api('GET', '/crm/dashboard', { role: 'SALES' });
  ok('SALES can access CRM dashboard', r.ok, `${r.status}`);
  r = await api('GET', '/call-logs', { role: 'SALES' });
  ok('SALES can access call logs', r.ok, `${r.status}`);
  r = await api('GET', '/opportunities', { role: 'SALES' });
  ok('SALES can access opportunities', r.ok, `${r.status}`);

  // DISPATCHER should have broad access
  r = await api('GET', '/users', { role: 'DISPATCHER' });
  ok('DISPATCHER can access /users', r.ok, `${r.status}`);
  r = await api('GET', '/work-orders', { role: 'DISPATCHER' });
  ok('DISPATCHER can access /work-orders', r.ok, `${r.status}`);

  // ════════════════════════════════════════════════════
  // CLEANUP — Delete all test data
  // ════════════════════════════════════════════════════
  console.log('\n══ CLEANUP ══');

  const cleanups = [
    ids._callTypeCreated && ['DELETE', `/crm/call-types/${ids._callTypeCreated}`, 'E2E call type'],
    ids._callOutcomeCreated && ['DELETE', `/crm/call-outcomes/${ids._callOutcomeCreated}`, 'E2E call outcome'],
    ids.pm && ['DELETE', `/pm-schedules/${ids.pm}`, 'PM schedule'],
    ids.ticket && ['DELETE', `/service-tickets/${ids.ticket}`, 'Service ticket'],
    ids.followUp && ['DELETE', `/follow-ups/${ids.followUp}`, 'Follow-up'],
    ids.opportunity && ['DELETE', `/opportunities/${ids.opportunity}`, 'Opportunity'],
    ids.callLog && ['DELETE', `/call-logs/${ids.callLog}`, 'Call log'],
    ids.contact && ['DELETE', `/contacts/${ids.contact}`, 'Contact'],
    ids.material && ['DELETE', `/materials/${ids.material}`, 'Material'],
    ids.quoteDup && ['DELETE', `/quotes/${ids.quoteDup}`, 'Duplicate quote'],
    ids.invoice && ['DELETE', `/invoices/${ids.invoice}`, 'Invoice'],
    ids.quoteWo && ['DELETE', `/work-orders/${ids.quoteWo}`, 'Quote-generated WO'],
    ids.quote && ['DELETE', `/quotes/${ids.quote}`, 'Quote'],
    ids.wo && ['DELETE', `/work-orders/${ids.wo}`, 'Work order'],
    ids.asset && ['DELETE', `/assets/${ids.asset}`, 'Asset'],
    ids.site && ['DELETE', `/sites/${ids.site}`, 'Site'],
    ids.customer && ['DELETE', `/customers/${ids.customer}`, 'Customer'],
  ].filter(Boolean);

  for (const [method, path, label] of cleanups) {
    try {
      r = await api(method, path);
      if (r.ok || r.status === 200 || r.status === 204) {
        process.stdout.write(`  🧹 ${label} deleted\n`);
      } else {
        process.stdout.write(`  ⚠️  ${label} — ${r.status} (may have deps)\n`);
      }
    } catch (e) {
      process.stdout.write(`  ⚠️  ${label} — ${e.message}\n`);
    }
  }

  // ════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 E2E SMOKE TEST RESULTS`);
  console.log(`   ✅ Passed: ${results.pass}`);
  console.log(`   ❌ Failed: ${results.fail}`);
  console.log(`   Total: ${results.pass + results.fail}`);

  if (results.errors.length > 0) {
    console.log(`\n🔴 FAILURES:`);
    results.errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
  } else {
    console.log(`\n🟢 ALL WORKFLOWS PASSED`);
  }

  console.log('\n' + '═'.repeat(60));
  process.exit(results.fail > 0 ? 1 : 0);
}

function abort() {
  console.log('\n⛔ ABORTING — critical creation step failed, cannot continue workflow.\n');
  process.exit(2);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
