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
  QboItem,
  QboLine,
  QboRef,
  QboEmployee,
  QboVendor,
  QboTimeActivity,
  QboBill,
  QboPurchase,
  QboCreditMemo,
  QboPurchaseOrder,
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

// ============================================
// ITEM MAPPERS
// ============================================

/**
 * Outbound: Convert a ServiceOps Material or LaborRate to a QBO Item payload.
 *
 * - Materials map to Type: "NonInventory"
 * - LaborRates map to Type: "Service"
 * - incomeAccountRef comes from the org's account mapping
 * - existingQbo enables merge for updates (preserves unmanaged fields)
 */
export function toQboItem(
  source: { name: string; description?: string | null; unitCost?: number | null; hourlyRate?: unknown },
  type: "NonInventory" | "Service",
  incomeAccountRef: { value: string; name?: string },
  existingQbo?: QboItem
): Partial<QboItem> {
  const base: Record<string, unknown> = existingQbo
    ? { ...existingQbo }
    : {};

  base.Name = source.name;
  base.Type = type;
  base.IncomeAccountRef = incomeAccountRef;

  if (source.description) {
    base.Description = source.description;
  }

  // UnitPrice: use unitCost for materials, hourlyRate for labor
  const price = type === "NonInventory"
    ? source.unitCost
    : (typeof source.hourlyRate === "object" && source.hourlyRate !== null && "toFixed" in source.hourlyRate)
      ? Number((source.hourlyRate as { toFixed(d: number): string }).toFixed(2))
      : Number(source.hourlyRate);

  if (price != null && !isNaN(price)) {
    base.UnitPrice = roundQboAmount(price);
  }

  return base as Partial<QboItem>;
}

// ============================================
// EMPLOYEE MAPPERS
// ============================================

export function toQboEmployee(
  user: { name: string | null; email: string },
  existingQbo?: QboEmployee
): Partial<QboEmployee> {
  const base: Record<string, unknown> = existingQbo ? { ...existingQbo } : {};

  const displayName = user.name ?? user.email.split("@")[0];
  base.DisplayName = displayName;

  // Split name into given/family
  if (user.name) {
    const parts = user.name.split(" ");
    base.GivenName = parts[0];
    base.FamilyName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
  }

  base.PrimaryEmailAddr = { Address: user.email };
  base.BillableTime = true;

  return base as Partial<QboEmployee>;
}

// ============================================
// VENDOR MAPPERS
// ============================================

export function toQboVendor(
  vendor: {
    name: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    tax1099: boolean;
  },
  existingQbo?: QboVendor
): Partial<QboVendor> {
  const base: Record<string, unknown> = existingQbo ? { ...existingQbo } : {};

  base.DisplayName = vendor.name;

  if (vendor.companyName) {
    base.CompanyName = vendor.companyName;
  }

  if (vendor.email) {
    base.PrimaryEmailAddr = { Address: vendor.email };
  }

  if (vendor.phone) {
    base.PrimaryPhone = { FreeFormNumber: vendor.phone };
  }

  if (vendor.address || vendor.city || vendor.state || vendor.postalCode) {
    base.BillAddr = {
      Line1: vendor.address || undefined,
      City: vendor.city || undefined,
      CountrySubDivisionCode: vendor.state || undefined,
      PostalCode: vendor.postalCode || undefined,
    };
  }

  base.Vendor1099 = vendor.tax1099;
  base.PrintOnCheckName = vendor.companyName ?? vendor.name;

  return base as Partial<QboVendor>;
}

// ============================================
// TIME ACTIVITY MAPPERS
// ============================================

export function toQboTimeActivity(
  timeEntry: { startedAt: Date; accumulatedSeconds: number; notes: string | null },
  qboEmployeeId: string,
  qboCustomerId: string,
  options?: { qboItemId?: string; classRef?: QboRef; billable?: boolean; hourlyRate?: number }
): Partial<QboTimeActivity> {
  const txnDate = timeEntry.startedAt instanceof Date
    ? timeEntry.startedAt.toISOString().split("T")[0]
    : String(timeEntry.startedAt).split("T")[0];

  const hours = Math.floor(timeEntry.accumulatedSeconds / 3600);
  const minutes = Math.round((timeEntry.accumulatedSeconds % 3600) / 60);

  const result: Record<string, unknown> = {
    TxnDate: txnDate,
    NameOf: "Employee",
    EmployeeRef: { value: qboEmployeeId },
    CustomerRef: { value: qboCustomerId },
    Hours: hours,
    Minutes: minutes,
    BillableStatus: options?.billable === false ? "NotBillable" : "Billable",
  };

  if (timeEntry.notes) {
    result.Description = timeEntry.notes;
  }

  if (options?.qboItemId) {
    result.ItemRef = { value: options.qboItemId };
  }

  if (options?.classRef) {
    result.ClassRef = options.classRef;
  }

  if (options?.hourlyRate != null) {
    result.HourlyRate = roundQboAmount(options.hourlyRate);
  }

  return result as Partial<QboTimeActivity>;
}

// ============================================
// BILL MAPPERS
// ============================================

export function toQboBill(
  stockMovement: { totalCost: unknown; unitCost: unknown; quantity: unknown; reference: string | null; notes: string | null; createdAt: Date },
  material: { name: string },
  qboVendorId: string,
  expenseAccountRef: { value: string; name?: string },
  options?: { classRef?: QboRef }
): Partial<QboBill> {
  const txnDate = stockMovement.createdAt instanceof Date
    ? stockMovement.createdAt.toISOString().split("T")[0]
    : String(stockMovement.createdAt).split("T")[0];

  const amount = roundQboAmount(stockMovement.totalCost as number);
  const qty = Number(stockMovement.quantity);

  const line: QboLine = {
    Amount: amount,
    DetailType: "AccountBasedExpenseLineDetail",
    Description: `${material.name} x${qty}`,
    AccountBasedExpenseLineDetail: {
      AccountRef: expenseAccountRef,
      ...(options?.classRef ? { ClassRef: options.classRef } : {}),
    },
  };

  const result: Record<string, unknown> = {
    VendorRef: { value: qboVendorId },
    TxnDate: txnDate,
    Line: [line],
  };

  if (stockMovement.reference) {
    result.DocNumber = stockMovement.reference;
  }

  return result as Partial<QboBill>;
}

// ============================================
// PURCHASE MAPPERS
// ============================================

export function toQboPurchase(
  stockMovement: { totalCost: unknown; reference: string | null; notes: string | null; createdAt: Date },
  material: { name: string },
  expenseAccountRef: { value: string; name?: string },
  options?: { classRef?: QboRef }
): Partial<QboPurchase> {
  const txnDate = stockMovement.createdAt instanceof Date
    ? stockMovement.createdAt.toISOString().split("T")[0]
    : String(stockMovement.createdAt).split("T")[0];

  const amount = roundQboAmount(stockMovement.totalCost as number);

  const line: QboLine = {
    Amount: amount,
    DetailType: "AccountBasedExpenseLineDetail",
    Description: material.name,
    AccountBasedExpenseLineDetail: {
      AccountRef: expenseAccountRef,
      ...(options?.classRef ? { ClassRef: options.classRef } : {}),
    },
  };

  const result: Record<string, unknown> = {
    PaymentType: "Cash",
    AccountRef: expenseAccountRef,
    TxnDate: txnDate,
    Line: [line],
  };

  if (stockMovement.reference) {
    result.DocNumber = stockMovement.reference;
  }

  return result as Partial<QboPurchase>;
}

// ============================================
// CREDIT MEMO MAPPERS
// ============================================

export function toQboCreditMemo(
  invoice: { total: unknown; invoiceNumber: string; notes: string | null },
  lineItems: Array<{ description: string; totalPrice: unknown; quantity: unknown; unitPrice: unknown }>,
  qboCustomerId: string,
  qboInvoiceId: string,
  options?: { classRef?: QboRef }
): Partial<QboCreditMemo> {
  const lines: QboLine[] = lineItems.map((item) => ({
    Amount: roundQboAmount(item.totalPrice as number),
    Description: item.description,
    DetailType: "SalesItemLineDetail",
    SalesItemLineDetail: {
      Qty: roundQboAmount(item.quantity as number),
      UnitPrice: roundQboAmount(item.unitPrice as number),
    },
  }));

  const result: Record<string, unknown> = {
    CustomerRef: { value: qboCustomerId },
    LinkedTxn: [{ TxnId: qboInvoiceId, TxnType: "Invoice" }],
    DocNumber: `CM-${invoice.invoiceNumber}`,
    Line: lines,
  };

  if (options?.classRef) {
    result.ClassRef = options.classRef;
  }

  if (invoice.notes) {
    result.CustomerMemo = { value: invoice.notes };
  }

  return result as Partial<QboCreditMemo>;
}

// ─── Purchase Order Mapper ─────────────────────────────────────

export function toQboPurchaseOrder(
  po: {
    poNumber: string;
    notes?: string | null;
    expectedDate?: Date | null;
    totalAmount?: unknown;
  },
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number | string;
    amount: number | string;
    material?: { name: string; qboItemId?: string | null } | null;
  }>,
  qboVendorId: string,
  options?: {
    classRef?: { value: string; name?: string };
    departmentRef?: { value: string; name?: string };
    apAccountRef?: { value: string; name?: string };
  }
): Partial<QboPurchaseOrder> {
  const qboLines: QboLine[] = lines.map((line, idx) => ({
    Id: String(idx + 1),
    DetailType: "ItemBasedExpenseLineDetail" as const,
    Amount: roundQboAmount(line.amount),
    Description: line.description,
    ItemBasedExpenseLineDetail: {
      ItemRef: line.material?.qboItemId
        ? { value: line.material.qboItemId, name: line.material.name }
        : { value: "", name: line.description },
      Qty: line.quantity,
      UnitPrice: roundQboAmount(line.unitPrice),
      ...(options?.classRef ? { ClassRef: options.classRef } : {}),
    },
  }));

  const result: Partial<QboPurchaseOrder> = {
    DocNumber: po.poNumber,
    VendorRef: { value: qboVendorId },
    Line: qboLines,
    ...(po.notes ? { Memo: po.notes } : {}),
    ...(po.expectedDate
      ? { DueDate: po.expectedDate.toISOString().split("T")[0] }
      : {}),
    ...(options?.departmentRef ? { DepartmentRef: options.departmentRef } : {}),
    ...(options?.classRef ? { ClassRef: options.classRef } : {}),
    ...(options?.apAccountRef ? { APAccountRef: options.apAccountRef } : {}),
  };

  return result;
}
