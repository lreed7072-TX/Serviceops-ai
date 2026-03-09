/**
 * qbo-mapper.ts — Pure transformation functions for ServiceOps <-> QBO mapping.
 *
 * Rules:
 * - Every function is pure: no database calls, no API calls, no side effects
 * - No `await` or `Promise` in any function signature or body
 * - No `import { prisma }` or `import fetch`
 * - Fully testable without mocking
 * - All monetary values pass through roundQboAmount()
 * - Merge pattern: when existingQbo is provided, spread it before applying changes
 */

import type {
  QboCustomer,
  QboInvoice,
  QboEstimate,
  QboLine,
  QboRef,
} from "./qbo-types";
import type {
  Customer,
  Invoice,
  InvoiceLineItem,
  Quote,
  QuoteLineItem,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// ============================================
// HELPERS
// ============================================

/**
 * Round a value to 2 decimal places for QBO API compatibility.
 *
 * QBO validates monetary amounts to 2 decimal places. Prisma's Decimal type
 * can produce floating-point artifacts when converted to Number directly.
 * This helper ensures clean 2-decimal output.
 */
export function roundQboAmount(value: Decimal | number | string): number {
  if (value instanceof Decimal) {
    return Number(value.toFixed(2));
  }
  return Number(Number(value).toFixed(2));
}

// ============================================
// CUSTOMER MAPPERS
// ============================================

/**
 * Outbound: Convert a ServiceOps Customer to a QBO Customer payload.
 *
 * - If `existingQbo` is undefined, builds a create payload (no Id/SyncToken).
 * - If `existingQbo` is provided, merges ServiceOps changes into the existing
 *   QBO entity, preserving all fields ServiceOps doesn't manage (solves FOUND-02).
 */
export function toQboCustomer(
  customer: Pick<Customer, "name" | "primaryEmail" | "primaryPhone" | "billingStreet1" | "billingCity" | "billingState" | "billingPostalCode">,
  existingQbo?: QboCustomer
): Partial<QboCustomer> {
  const base: Record<string, unknown> = existingQbo
    ? { ...existingQbo }
    : {};

  // ServiceOps-managed fields — always override
  base.DisplayName = customer.name;

  // Email: override if provided, preserve existing if not
  if (customer.primaryEmail !== undefined) {
    base.PrimaryEmailAddr = customer.primaryEmail
      ? { Address: customer.primaryEmail }
      : existingQbo?.PrimaryEmailAddr;
  }

  // Phone: override if provided, preserve existing if not
  if (customer.primaryPhone !== undefined) {
    base.PrimaryPhone = customer.primaryPhone
      ? { FreeFormNumber: customer.primaryPhone }
      : existingQbo?.PrimaryPhone;
  }

  // Address: only set on create or if explicitly provided
  if (!existingQbo && (customer.billingStreet1 || customer.billingCity)) {
    base.BillAddr = {
      Line1: customer.billingStreet1 || undefined,
      City: customer.billingCity || undefined,
      CountrySubDivisionCode: customer.billingState || undefined,
      PostalCode: customer.billingPostalCode || undefined,
    };
  }

  return base as Partial<QboCustomer>;
}

/**
 * Inbound: Convert a QBO Customer to a partial ServiceOps Customer update.
 *
 * Used by CDC inbound sync (Phase 4). Returns only the fields that should
 * be updated in ServiceOps from the QBO data. ServiceOps wins on operational
 * fields; QBO wins on billing fields.
 */
export function fromQboCustomer(
  qbo: QboCustomer
): {
  name: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  billingStreet1: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
} {
  return {
    name: qbo.DisplayName,
    primaryEmail: qbo.PrimaryEmailAddr?.Address ?? null,
    primaryPhone: qbo.PrimaryPhone?.FreeFormNumber ?? null,
    billingStreet1: qbo.BillAddr?.Line1 ?? null,
    billingCity: qbo.BillAddr?.City ?? null,
    billingState: qbo.BillAddr?.CountrySubDivisionCode ?? null,
    billingPostalCode: qbo.BillAddr?.PostalCode ?? null,
  };
}

// ============================================
// INVOICE MAPPERS
// ============================================

/**
 * Convert a ServiceOps InvoiceLineItem to a QBO Line.
 *
 * If `itemRef` is provided (QBO Item ID), includes the ItemRef to avoid
 * revenue posting to Uncategorized Income (ITEM-02 in Phase 3).
 */
export function toQboInvoiceLine(
  item: Pick<InvoiceLineItem, "description" | "totalPrice" | "quantity" | "unitPrice">,
  itemRef?: string
): QboLine {
  const line: QboLine = {
    Amount: roundQboAmount(item.totalPrice),
    Description: item.description,
    DetailType: "SalesItemLineDetail",
    SalesItemLineDetail: {
      Qty: roundQboAmount(item.quantity),
      UnitPrice: roundQboAmount(item.unitPrice),
    },
  };

  if (itemRef && line.SalesItemLineDetail) {
    line.SalesItemLineDetail.ItemRef = { value: itemRef };
  }

  return line;
}

/**
 * Outbound: Convert a ServiceOps Invoice to a QBO Invoice payload.
 *
 * - `customerRef` is the QBO Customer entity ID (must be synced first)
 * - `existingQbo` enables merge for updates (preserves unmanaged fields)
 */
export function toQboInvoice(
  invoice: Pick<Invoice, "invoiceNumber" | "dueDate">,
  lineItems: Array<Pick<InvoiceLineItem, "description" | "totalPrice" | "quantity" | "unitPrice">>,
  customerRef: string,
  existingQbo?: QboInvoice
): Partial<QboInvoice> {
  const base: Record<string, unknown> = existingQbo
    ? { ...existingQbo }
    : {};

  base.CustomerRef = { value: customerRef } as QboRef;
  base.Line = lineItems.map((item) => toQboInvoiceLine(item));

  if (invoice.dueDate) {
    base.DueDate = invoice.dueDate instanceof Date
      ? invoice.dueDate.toISOString().split("T")[0]
      : String(invoice.dueDate).split("T")[0];
  }
  if (invoice.invoiceNumber) {
    base.DocNumber = invoice.invoiceNumber;
  }

  return base as Partial<QboInvoice>;
}

// ============================================
// ESTIMATE MAPPERS
// ============================================

/**
 * Outbound: Convert a ServiceOps Quote to a QBO Estimate payload.
 *
 * - `customerRef` is the QBO Customer entity ID
 * - Line items built from QuoteLineItem with roundQboAmount
 */
export function toQboEstimate(
  quote: Pick<Quote, "quoteNumber" | "validUntil" | "notes" | "total">,
  lineItems: Array<Pick<QuoteLineItem, "description" | "totalPrice" | "quantity" | "unitPrice">>,
  customerRef: string,
  existingQbo?: QboEstimate
): Partial<QboEstimate> {
  const base: Record<string, unknown> = existingQbo
    ? { ...existingQbo }
    : {};

  base.CustomerRef = { value: customerRef } as QboRef;
  base.Line = lineItems.map((item): QboLine => ({
    Amount: roundQboAmount(item.totalPrice),
    Description: item.description ?? undefined,
    DetailType: "SalesItemLineDetail",
    SalesItemLineDetail: {
      Qty: roundQboAmount(item.quantity),
      UnitPrice: roundQboAmount(item.unitPrice),
    },
  }));

  if (quote.quoteNumber) {
    base.DocNumber = quote.quoteNumber;
  }
  if (quote.validUntil) {
    base.ExpirationDate = quote.validUntil instanceof Date
      ? quote.validUntil.toISOString().split("T")[0]
      : String(quote.validUntil).split("T")[0];
  }
  if (quote.notes) {
    base.CustomerMemo = { value: quote.notes };
  }

  return base as Partial<QboEstimate>;
}
