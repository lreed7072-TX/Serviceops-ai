/**
 * Factory functions for test data objects.
 * All IDs use deterministic strings for easy assertion.
 */

export function makeOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: "org-1",
    name: "Test Corp",
    ...overrides,
  };
}

export function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    orgId: "org-1",
    role: "ADMIN",
    ...overrides,
  };
}

export function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: "cust-1",
    orgId: "org-1",
    name: "Acme Water",
    status: "ACTIVE",
    primaryEmail: "info@acme.com",
    primaryPhone: "555-0100",
    billingAddress: null,
    billingStreet1: null,
    billingStreet2: null,
    billingCity: null,
    billingState: null,
    billingPostalCode: null,
    billingCountry: null,
    notes: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function makeSite(overrides: Record<string, unknown> = {}) {
  return {
    id: "site-1",
    orgId: "org-1",
    customerId: "cust-1",
    name: "Main Pump Station",
    address: "123 Industrial Blvd",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    orgId: "org-1",
    siteId: "site-1",
    name: "Pump A-101",
    serialNumber: "SN-12345",
    assetTag: "AT-001",
    status: "ACTIVE",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function makeWorkOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "wo-1",
    orgId: "org-1",
    workOrderNumber: "WO00001",
    orderType: "WORK_ORDER",
    customerId: "cust-1",
    siteId: "site-1",
    assetId: null,
    title: "Fix pump bearing",
    description: "Bearing noise detected on Pump A-101",
    status: "OPEN",
    executionMode: "UNIFIED",
    scheduledStart: null,
    scheduledEnd: null,
    priority: null,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
    ...overrides,
  };
}

export function makeQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "quote-1",
    orgId: "org-1",
    customerId: "cust-1",
    siteId: "site-1",
    quoteNumber: "Q-20240115-001",
    status: "DRAFT",
    title: "Pump Repair Estimate",
    description: "Estimate for bearing replacement",
    subtotal: { toNumber: () => 1500 },
    tax: { toNumber: () => 0 },
    taxRate: { toNumber: () => 0 },
    total: { toNumber: () => 1500 },
    validUntil: null,
    notes: null,
    terms: "Quote valid for 30 days.",
    sentAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    createdByUserId: "user-1",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
    ...overrides,
  };
}

export function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    orgId: "org-1",
    customerId: "cust-1",
    siteId: null,
    workOrderId: null,
    quoteId: null,
    invoiceNumber: "INV-000001",
    status: "DRAFT",
    title: "Pump Repair Invoice",
    description: null,
    subtotal: 1500,
    tax: 0,
    taxRate: 0,
    total: 1500,
    dueDate: null,
    paidAt: null,
    notes: null,
    terms: null,
    createdByUserId: "user-1",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
    ...overrides,
  };
}

export function makeAuditLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "audit-1",
    userId: "user-1",
    orgId: "org-1",
    action: "CREATE",
    entityType: "WORK_ORDER",
    entityId: "wo-1",
    entityName: "WO00001",
    changes: null,
    metadata: null,
    ipAddress: null,
    userAgent: null,
    createdAt: new Date("2024-01-15"),
    ...overrides,
  };
}
