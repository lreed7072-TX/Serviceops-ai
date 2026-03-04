import { QboConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// QBO API endpoints
const QBO_SANDBOX_BASE = "https://sandbox-quickbooks.api.intuit.com/v3/company";
const QBO_PRODUCTION_BASE = "https://quickbooks.api.intuit.com/v3/company";
const QBO_OAUTH_BASE = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

const isSandbox = process.env.QBO_ENVIRONMENT !== "production";

function getApiBase(): string {
  return isSandbox ? QBO_SANDBOX_BASE : QBO_PRODUCTION_BASE;
}

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
};

export type QboCustomer = {
  Id: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
};

export type QboInvoice = {
  Id: string;
  DocNumber: string;
  TotalAmt: number;
  Balance: number;
  DueDate?: string;
  CustomerRef: { value: string; name?: string };
  Line: Array<{
    Amount: number;
    Description?: string;
    DetailType: string;
    SalesItemLineDetail?: {
      Qty?: number;
      UnitPrice?: number;
    };
  }>;
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
  // Check if token is expired (with 5 min buffer)
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  if (connection.accessTokenExpiry.getTime() - bufferMs > now.getTime()) {
    return connection.accessToken;
  }

  // Token expired, refresh it
  const tokens = await refreshAccessToken(connection);

  await prisma.qboConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
    },
  });

  return tokens.accessToken;
}

/**
 * Make an authenticated request to the QBO API.
 */
async function qboRequest(
  connection: QboConnection,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const accessToken = await getValidAccessToken(connection);
  const url = `${getApiBase()}/${connection.realmId}/${path}`;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
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
  // First fetch to get SyncToken (required for updates)
  const existing = await getCustomer(connection, qboCustomerId);

  const qboCustomer: Record<string, unknown> = {
    Id: qboCustomerId,
    SyncToken: (existing as Record<string, unknown>).SyncToken,
    DisplayName: customerData.displayName,
  };

  if (customerData.email) {
    qboCustomer.PrimaryEmailAddr = { Address: customerData.email };
  }

  const result = await qboRequest(connection, "POST", "customer", qboCustomer) as {
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
