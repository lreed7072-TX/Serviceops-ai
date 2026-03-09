import { QboConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { QboCustomer, QboInvoice, QboBatchOperation, QboBatchItemResponse, QboCdcResponse, QboAccount } from "./qbo-types";
export type { QboCustomer, QboInvoice, QboBatchOperation, QboBatchItemResponse, QboCdcResponse, QboAccount };

// QBO API endpoints
const QBO_SANDBOX_BASE = "https://sandbox-quickbooks.api.intuit.com/v3/company";
const QBO_PRODUCTION_BASE = "https://quickbooks.api.intuit.com/v3/company";
const QBO_OAUTH_BASE = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

const isSandbox = process.env.QBO_ENVIRONMENT !== "production";

/** QBO API minor version — pinned to 75 (all versions below deprecated Aug 2025) */
export const QBO_API_VERSION = "75";

function getApiBase(): string {
  return isSandbox ? QBO_SANDBOX_BASE : QBO_PRODUCTION_BASE;
}

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
};

/**
 * Generate the OAuth 2.0 authorization URL for QBO.
 */
export function getAuthorizationUrl(orgId: string, redirectUri: string): string {
  const clientId = process.env.QBO_CLIENT_ID;
  if (!clientId) throw new Error("QBO_CLIENT_ID not configured");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    state: orgId, // Pass orgId through state for CSRF + context
  });

  return `${QBO_OAUTH_BASE}?${params.toString()}`;
}

/**
 * Exchange the authorization code for access/refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  realmId: string
): Promise<TokenResponse> {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const redirectUri = process.env.QBO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("QBO OAuth credentials not configured");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QBO token exchange failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAccessToken(
  connection: QboConnection
): Promise<TokenResponse> {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("QBO OAuth credentials not configured");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QBO token refresh failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Get a valid access token, refreshing if needed.
 * Updates the stored tokens in the database.
 */
export async function getValidAccessToken(
  connection: QboConnection
): Promise<string> {
  // Check if token is still valid (with 5 min buffer)
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  if (connection.accessTokenExpiry.getTime() - bufferMs > now.getTime()) {
    return connection.accessToken;
  }

  // Token expired — attempt to acquire refresh lock via CAS
  const lockResult = await prisma.qboConnection.updateMany({
    where: {
      id: connection.id,
      refreshInProgress: false,
    },
    data: {
      refreshInProgress: true,
      refreshLockedAt: new Date(),
    },
  });

  if (lockResult.count === 1) {
    // This instance won the lock — perform the refresh
    try {
      const tokens = await refreshAccessToken(connection);
      await prisma.qboConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessTokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
          refreshTokenExpiry: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
          refreshInProgress: false,
          refreshLockedAt: null,
        },
      });
      return tokens.accessToken;
    } catch (err) {
      // Always clear lock on failure
      await prisma.qboConnection.updateMany({
        where: { id: connection.id, refreshInProgress: true },
        data: { refreshInProgress: false, refreshLockedAt: null },
      }).catch(() => {}); // Swallow — already in error path
      throw err;
    }
  }

  // Lost the CAS — another instance is refreshing. Check for stale lock first.
  const existing = await prisma.qboConnection.findUnique({
    where: { id: connection.id },
  });
  if (
    existing?.refreshLockedAt &&
    Date.now() - existing.refreshLockedAt.getTime() > 30_000
  ) {
    // Stale lock — force clear and retry
    await prisma.qboConnection.updateMany({
      where: { id: connection.id, refreshInProgress: true },
      data: { refreshInProgress: false, refreshLockedAt: null },
    });
    return getValidAccessToken(connection);
  }

  // Poll until the refresh completes
  const MAX_POLLS = 5;
  const POLL_INTERVAL_MS = 200;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const fresh = await prisma.qboConnection.findUnique({
      where: { id: connection.id },
    });
    if (fresh && !fresh.refreshInProgress) {
      return fresh.accessToken;
    }
  }

  throw new Error("Token refresh lock timed out after polling");
}

/**
 * Make an authenticated request to the QBO API.
 */
async function qboRequest(
  connection: QboConnection,
  method: string,
  path: string,
  body?: Record<string, unknown> | null,
  options?: { contentType?: string }
): Promise<unknown> {
  const accessToken = await getValidAccessToken(connection);
  const base = `${getApiBase()}/${connection.realmId}/${path}`;
  const url = base.includes("?")
    ? `${base}&minorversion=${QBO_API_VERSION}`
    : `${base}?minorversion=${QBO_API_VERSION}`;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
    "Content-Type": options?.contentType || "application/json",
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QBO API error (${method} ${path}): ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Create a customer in QBO.
 */
export async function createCustomer(
  connection: QboConnection,
  customerData: {
    displayName: string;
    email?: string | null;
    phone?: string | null;
    billingStreet1?: string | null;
    billingCity?: string | null;
    billingState?: string | null;
    billingPostalCode?: string | null;
  }
): Promise<QboCustomer> {
  const qboCustomer: Record<string, unknown> = {
    DisplayName: customerData.displayName,
  };

  if (customerData.email) {
    qboCustomer.PrimaryEmailAddr = { Address: customerData.email };
  }
  if (customerData.phone) {
    qboCustomer.PrimaryPhone = { FreeFormNumber: customerData.phone };
  }
  if (customerData.billingStreet1 || customerData.billingCity) {
    qboCustomer.BillAddr = {
      Line1: customerData.billingStreet1 || undefined,
      City: customerData.billingCity || undefined,
      CountrySubDivisionCode: customerData.billingState || undefined,
      PostalCode: customerData.billingPostalCode || undefined,
    };
  }

  const result = await qboRequest(connection, "POST", "customer", qboCustomer) as {
    Customer: QboCustomer;
  };
  return result.Customer;
}

/**
 * Update a customer in QBO.
 */
export async function updateCustomer(
  connection: QboConnection,
  qboCustomerId: string,
  customerData: {
    displayName: string;
    email?: string | null;
    phone?: string | null;
  }
): Promise<QboCustomer> {
  // 1. Fetch the full existing entity (includes SyncToken and all fields)
  const existing = await getCustomer(connection, qboCustomerId);

  // 2. Merge — spread existing entity, then override only ServiceOps-managed fields
  const merged: Record<string, unknown> = {
    ...(existing as Record<string, unknown>),
    DisplayName: customerData.displayName,
  };

  // Only override email/phone if explicitly provided
  if (customerData.email !== undefined) {
    merged.PrimaryEmailAddr = customerData.email
      ? { Address: customerData.email }
      : undefined;
  }
  if (customerData.phone !== undefined) {
    merged.PrimaryPhone = customerData.phone
      ? { FreeFormNumber: customerData.phone }
      : undefined;
  }

  // 3. POST the complete merged payload
  const result = (await qboRequest(connection, "POST", "customer", merged)) as {
    Customer: QboCustomer;
  };
  return result.Customer;
}

/**
 * Get a customer from QBO by ID.
 */
export async function getCustomer(
  connection: QboConnection,
  qboCustomerId: string
): Promise<QboCustomer> {
  const result = await qboRequest(connection, "GET", `customer/${qboCustomerId}`) as {
    Customer: QboCustomer;
  };
  return result.Customer;
}

/**
 * Create an invoice in QBO.
 */
export async function createInvoice(
  connection: QboConnection,
  invoiceData: {
    customerRef: string; // QBO customer ID
    lineItems: Array<{
      description: string;
      amount: number;
      quantity?: number;
      unitPrice?: number;
    }>;
    dueDate?: string;
    docNumber?: string;
    taxRate?: number;
  }
): Promise<QboInvoice> {
  const lines = invoiceData.lineItems.map((item) => ({
    Amount: item.amount,
    Description: item.description,
    DetailType: "SalesItemLineDetail",
    SalesItemLineDetail: {
      Qty: item.quantity || 1,
      UnitPrice: item.unitPrice || item.amount,
    },
  }));

  const qboInvoice: Record<string, unknown> = {
    CustomerRef: { value: invoiceData.customerRef },
    Line: lines,
  };

  if (invoiceData.dueDate) {
    qboInvoice.DueDate = invoiceData.dueDate;
  }
  if (invoiceData.docNumber) {
    qboInvoice.DocNumber = invoiceData.docNumber;
  }

  const result = await qboRequest(connection, "POST", "invoice", qboInvoice) as {
    Invoice: QboInvoice;
  };
  return result.Invoice;
}

/**
 * Get an invoice from QBO by ID.
 */
export async function getInvoice(
  connection: QboConnection,
  qboInvoiceId: string
): Promise<QboInvoice> {
  const result = await qboRequest(connection, "GET", `invoice/${qboInvoiceId}`) as {
    Invoice: QboInvoice;
  };
  return result.Invoice;
}

/**
 * Get company info from QBO (used to display connected company name).
 */
export async function getCompanyInfo(
  connection: QboConnection
): Promise<{ companyName: string }> {
  const result = await qboRequest(
    connection,
    "GET",
    `companyinfo/${connection.realmId}`
  ) as {
    CompanyInfo: { CompanyName: string };
  };
  return { companyName: result.CompanyInfo.CompanyName };
}

/**
 * Send a batch request to QBO (up to 30 operations per batch).
 * Each operation can be a CRUD operation or a query.
 * Returns an array of results — check each item for Fault.
 * The overall HTTP response is always 200 when the batch is accepted;
 * per-operation failures appear as Fault in individual items.
 */
export async function batchRequest(
  connection: QboConnection,
  operations: QboBatchOperation[]
): Promise<QboBatchItemResponse[]> {
  if (operations.length === 0) {
    return [];
  }
  if (operations.length > 30) {
    throw new Error(
      `QBO batch limit is 30 operations, received ${operations.length}`
    );
  }

  const result = (await qboRequest(connection, "POST", "batch", {
    BatchItemRequest: operations,
  })) as { BatchItemResponse: QboBatchItemResponse[] };

  return result.BatchItemResponse || [];
}

/**
 * Execute an IQL query against the QBO API and return the entity array.
 * Caller provides the full IQL string and the entity name to extract.
 * Returns an empty array if no results found.
 *
 * Example: queryEntities<QboAccount>(connection, "SELECT * FROM Account WHERE Active = true", "Account")
 */
export async function queryEntities<T>(
  connection: QboConnection,
  iql: string,
  entityName: string
): Promise<T[]> {
  const result = (await qboRequest(
    connection,
    "GET",
    `query?query=${encodeURIComponent(iql)}`
  )) as { QueryResponse: Record<string, unknown> };

  const entities = result.QueryResponse?.[entityName];
  if (Array.isArray(entities)) {
    return entities as T[];
  }
  return [];
}

/**
 * Call the QBO Change Data Capture (CDC) endpoint.
 * Returns all entities changed since the given timestamp.
 * changedSince must be within the past 30 days.
 */
export async function cdcRequest(
  connection: QboConnection,
  entities: string[],
  changedSince: Date
): Promise<QboCdcResponse> {
  const entityList = entities.join(",");
  const sinceStr = changedSince.toISOString();

  const result = (await qboRequest(
    connection,
    "GET",
    `cdc?entities=${entityList}&changedSince=${encodeURIComponent(sinceStr)}`
  )) as QboCdcResponse;

  return result;
}

/**
 * Void an invoice in QBO. The invoice is zeroed out but not deleted.
 * Requires the current SyncToken for optimistic concurrency.
 * Uses the ?operation=void query parameter — NOT a sparse update.
 */
export async function voidInvoice(
  connection: QboConnection,
  qboInvoiceId: string,
  syncToken: string
): Promise<{ Id: string; status: string }> {
  const result = (await qboRequest(
    connection,
    "POST",
    "invoice?operation=void",
    { Id: qboInvoiceId, SyncToken: syncToken }
  )) as { Invoice: { Id: string; status: string } };

  return result.Invoice;
}

/**
 * Send an invoice via QBO's email service.
 * Uses the BillEmail.Address on the invoice unless sendTo is specified.
 * Requires Content-Type: application/octet-stream (QBO quirk).
 * Note: QBO enforces a daily email limit per realmId.
 */
export async function sendInvoiceEmail(
  connection: QboConnection,
  qboInvoiceId: string,
  sendTo?: string
): Promise<QboInvoice> {
  const path = sendTo
    ? `invoice/${qboInvoiceId}/send?sendTo=${encodeURIComponent(sendTo)}`
    : `invoice/${qboInvoiceId}/send`;

  const result = (await qboRequest(connection, "POST", path, null, {
    contentType: "application/octet-stream",
  })) as { Invoice: QboInvoice };

  return result.Invoice;
}

/**
 * Verify a QBO webhook signature using HMAC-SHA256.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookVerifierToken: string
): boolean {
  const crypto = require("crypto");
  const hash = crypto
    .createHmac("sha256", webhookVerifierToken)
    .update(payload)
    .digest("base64");
  return hash === signature;
}
