import { prisma } from "@/lib/prisma";
import {
  createCustomer,
  updateCustomer,
  createInvoice,
  getValidAccessToken,
  queryEntities,
  createItem,
  getItem,
  updateItem,
  createEstimate,
  getPayment,
  getInvoice,
} from "./qbo-client";
import { toQboItem, toQboEstimate } from "./qbo-mapper";
import type { QboItem, QboCustomer } from "./qbo-types";
import { QboConnection } from "@prisma/client";

/**
 * Round a Decimal/number to 2 decimal places for QBO API compatibility.
 * QBO validates amounts to 2 decimal places; IEEE 754 floating point
 * can produce artifacts like 123.45000000000000284217... from Prisma Decimal.
 */
function roundQboAmount(value: { toFixed(digits: number): string } | number | string): number {
  if (typeof value === "object" && value !== null && "toFixed" in value) {
    return Number(value.toFixed(2));
  }
  return Number(Number(value).toFixed(2));
}

/**
 * Get the active QBO connection for an org, or null if not connected.
 */
export async function getActiveConnection(orgId: string): Promise<QboConnection | null> {
  return prisma.qboConnection.findFirst({
    where: { orgId, isActive: true },
  });
}

// ============================================
// ACCOUNT MAPPING PREREQUISITE GATE
// ============================================

/** All 5 required mapping categories for financial syncs */
const REQUIRED_MAPPING_CATEGORIES = [
  "labor_income",
  "materials_income",
  "service_income",
  "job_cost_expense",
  "subcontractor_expense",
];

/**
 * Get a specific account mapping for an org and category.
 * Returns the mapping if found, or throws a descriptive error.
 */
export async function getAccountMapping(
  orgId: string,
  category: string
): Promise<{ qboAccountId: string; qboAccountName: string; qboAccountType: string }> {
  const mapping = await prisma.qboAccountMap.findUnique({
    where: {
      orgId_category: { orgId, category },
    },
    select: {
      qboAccountId: true,
      qboAccountName: true,
      qboAccountType: true,
    },
  });

  if (!mapping) {
    throw new Error(
      `Account mapping required for "${category}" — configure in QBO Settings`
    );
  }

  return mapping;
}

/**
 * Check if all required account mappings are configured for an org.
 * Returns { complete: true, missing: [] } when all 5 categories are mapped.
 * Returns { complete: false, missing: [...] } when any are missing.
 */
export async function requireAccountMapping(
  orgId: string
): Promise<{ complete: boolean; missing: string[] }> {
  const mappings = await prisma.qboAccountMap.findMany({
    where: { orgId },
    select: { category: true },
  });

  const mappedCategories = new Set(mappings.map((m) => m.category));
  const missing = REQUIRED_MAPPING_CATEGORIES.filter(
    (cat) => !mappedCategories.has(cat)
  );

  return {
    complete: missing.length === 0,
    missing,
  };
}

// ============================================
// DISPLAYNAME COLLISION HANDLING
// ============================================

/**
 * Resolve an existing QBO entity by DisplayName/Name, or create a new one.
 * Implements VEND-02: query-before-create to avoid DisplayName collisions.
 *
 * Flow:
 * 1. Query QBO for entities matching displayName
 * 2. If found AND matchFn returns true: return existing entity (link, don't duplicate)
 * 3. If found AND matchFn returns false: retry create with " (SvcOps)" suffix
 * 4. If not found: create normally
 */
export async function resolveOrCreateQboEntity<T extends { Id: string }>(
  connection: QboConnection,
  entityType: string,
  displayName: string,
  matchFn: (existing: T) => boolean,
  createFn: (finalDisplayName: string) => Promise<T>
): Promise<{ entity: T; wasExisting: boolean }> {
  // Query for existing entity with same DisplayName
  const escapedName = displayName.replace(/'/g, "\\'");
  const existing = await queryEntities<T>(
    connection,
    `SELECT * FROM ${entityType} WHERE DisplayName = '${escapedName}'`,
    entityType
  );

  if (existing.length > 0) {
    // Check if any existing entity is the same record
    const match = existing.find(matchFn);
    if (match) {
      return { entity: match, wasExisting: true };
    }

    // Collision but no match — create with suffix
    const suffixedName = `${displayName} (SvcOps)`;
    const entity = await createFn(suffixedName);
    return { entity, wasExisting: false };
  }

  // No collision — create normally
  const entity = await createFn(displayName);
  return { entity, wasExisting: false };
}

// ============================================
// MATERIAL / LABOR RATE ITEM SYNC
// ============================================

/**
 * Sync a ServiceOps Material to QBO as a NonInventory Item.
 * Creates new item if not yet synced, updates if already synced.
 * Stores the QBO Item ID on the Material record.
 */
export async function syncMaterialToQbo(
  orgId: string,
  materialId: string
): Promise<{ success: boolean; qboItemId?: string; error?: string }> {
  const connection = await getActiveConnection(orgId);
  if (!connection) return { success: false, error: "No active QBO connection" };

  // Account mapping gate — materials need income account
  const accountMapping = await requireAccountMapping(orgId);
  if (!accountMapping.complete) {
    return { success: false, error: `Account mapping required. Missing: ${accountMapping.missing.join(", ")}` };
  }

  const material = await prisma.material.findFirst({ where: { id: materialId, orgId } });
  if (!material) return { success: false, error: "Material not found" };

  try {
    const incomeMapping = await getAccountMapping(orgId, "materials_income");
    let qboItemId = material.qboItemId;

    if (qboItemId) {
      // Update existing
      const existing = await getItem(connection, qboItemId);
      const payload = toQboItem(
        { name: material.name, description: material.manufacturer || undefined, unitCost: material.unitCost },
        "NonInventory",
        { value: incomeMapping.qboAccountId, name: incomeMapping.qboAccountName },
        existing
      );
      await updateItem(connection, qboItemId, payload);
    } else {
      // Create new with collision check
      const { entity } = await resolveOrCreateQboEntity<QboItem>(
        connection,
        "Item",
        material.name,
        (existing) => existing.Type === "NonInventory" && existing.Name === material.name,
        async (finalName) => {
          const payload = toQboItem(
            { name: finalName, description: material.manufacturer || undefined, unitCost: material.unitCost },
            "NonInventory",
            { value: incomeMapping.qboAccountId, name: incomeMapping.qboAccountName }
          );
          return createItem(connection, payload);
        }
      );
      qboItemId = entity.Id;

      await prisma.material.update({
        where: { id: materialId },
        data: { qboItemId },
      });
    }

    await prisma.qboSyncLog.create({
      data: { orgId, connectionId: connection.id, entityType: "item", entityId: materialId, qboEntityId: qboItemId, action: "push", status: "success" },
    });
    return { success: true, qboItemId: qboItemId ?? undefined };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await prisma.qboSyncLog.create({
      data: { orgId, connectionId: connection.id, entityType: "item", entityId: materialId, action: "push", status: "failed", errorMessage },
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Sync a ServiceOps LaborRate to QBO as a Service Item.
 * Creates new item if not yet synced, updates if already synced.
 * Stores the QBO Item ID on the LaborRate record.
 */
export async function syncLaborRateToQbo(
  orgId: string,
  laborRateId: string
): Promise<{ success: boolean; qboItemId?: string; error?: string }> {
  const connection = await getActiveConnection(orgId);
  if (!connection) return { success: false, error: "No active QBO connection" };

  const accountMapping = await requireAccountMapping(orgId);
  if (!accountMapping.complete) {
    return { success: false, error: `Account mapping required. Missing: ${accountMapping.missing.join(", ")}` };
  }

  const laborRate = await prisma.laborRate.findFirst({ where: { id: laborRateId, orgId } });
  if (!laborRate) return { success: false, error: "Labor rate not found" };

  try {
    const incomeMapping = await getAccountMapping(orgId, "labor_income");
    let qboItemId = laborRate.qboItemId;

    if (qboItemId) {
      const existing = await getItem(connection, qboItemId);
      const payload = toQboItem(
        { name: laborRate.name, description: laborRate.description, hourlyRate: laborRate.hourlyRate },
        "Service",
        { value: incomeMapping.qboAccountId, name: incomeMapping.qboAccountName },
        existing
      );
      await updateItem(connection, qboItemId, payload);
    } else {
      const { entity } = await resolveOrCreateQboEntity<QboItem>(
        connection,
        "Item",
        laborRate.name,
        (existing) => existing.Type === "Service" && existing.Name === laborRate.name,
        async (finalName) => {
          const payload = toQboItem(
            { name: finalName, description: laborRate.description, hourlyRate: laborRate.hourlyRate },
            "Service",
            { value: incomeMapping.qboAccountId, name: incomeMapping.qboAccountName }
          );
          return createItem(connection, payload);
        }
      );
      qboItemId = entity.Id;

      await prisma.laborRate.update({
        where: { id: laborRateId },
        data: { qboItemId },
      });
    }

    await prisma.qboSyncLog.create({
      data: { orgId, connectionId: connection.id, entityType: "item", entityId: laborRateId, qboEntityId: qboItemId, action: "push", status: "success" },
    });
    return { success: true, qboItemId: qboItemId ?? undefined };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await prisma.qboSyncLog.create({
      data: { orgId, connectionId: connection.id, entityType: "item", entityId: laborRateId, action: "push", status: "failed", errorMessage },
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Sync a ServiceOps customer to QBO.
 * Creates new customer if not yet synced, updates if already synced.
 */
export async function syncCustomerToQbo(
  orgId: string,
  customerId: string
): Promise<{ success: boolean; qboCustomerId?: string; error?: string }> {
  const connection = await getActiveConnection(orgId);
  if (!connection) {
    return { success: false, error: "No active QBO connection" };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, orgId },
  });

  if (!customer) {
    return { success: false, error: "Customer not found" };
  }

  try {
    let qboCustomerId = customer.qboCustomerId;

    if (qboCustomerId) {
      // Update existing QBO customer
      await updateCustomer(connection, qboCustomerId, {
        displayName: customer.name,
        email: customer.primaryEmail,
        phone: customer.primaryPhone,
      });
    } else {
      // Create new QBO customer with DisplayName collision handling
      const { entity: qboCustomer } = await resolveOrCreateQboEntity<QboCustomer>(
        connection,
        "Customer",
        customer.name,
        (existing) => {
          // Match on email if available
          if (customer.primaryEmail && existing.PrimaryEmailAddr?.Address) {
            return existing.PrimaryEmailAddr.Address.toLowerCase() === customer.primaryEmail.toLowerCase();
          }
          return false;
        },
        async (finalDisplayName) => {
          return createCustomer(connection, {
            displayName: finalDisplayName,
            email: customer.primaryEmail,
            phone: customer.primaryPhone,
            billingStreet1: customer.billingStreet1,
            billingCity: customer.billingCity,
            billingState: customer.billingState,
            billingPostalCode: customer.billingPostalCode,
          });
        }
      );

      qboCustomerId = qboCustomer.Id;

      // Store QBO customer ID on our customer record
      await prisma.customer.update({
        where: { id: customerId },
        data: { qboCustomerId },
      });
    }

    // Log success
    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "customer",
        entityId: customerId,
        qboEntityId: qboCustomerId,
        action: "push",
        status: "success",
      },
    });

    return { success: true, qboCustomerId: qboCustomerId ?? undefined };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    // Log failure
    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "customer",
        entityId: customerId,
        action: "push",
        status: "failed",
        errorMessage,
      },
    });

    return { success: false, error: errorMessage };
  }
}

// ============================================
// QUOTE -> ESTIMATE SYNC
// ============================================

/**
 * Sync a ServiceOps Quote to QBO as an Estimate.
 * Guards on quote status (must be SENT or APPROVED).
 * Cascade-syncs customer and materials as needed.
 */
export async function syncQuoteToQbo(
  orgId: string,
  quoteId: string
): Promise<{ success: boolean; qboEstimateId?: string; error?: string }> {
  const connection = await getActiveConnection(orgId);
  if (!connection) return { success: false, error: "No active QBO connection" };

  const accountMapping = await requireAccountMapping(orgId);
  if (!accountMapping.complete) {
    return { success: false, error: `Account mapping required. Missing: ${accountMapping.missing.join(", ")}` };
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, orgId },
    include: {
      customer: true,
      lineItems: { orderBy: { sortOrder: "asc" }, include: { material: true } },
    },
  });
  if (!quote) return { success: false, error: "Quote not found" };

  // Status guard: only sync SENT or APPROVED quotes
  if (quote.status !== "SENT" && quote.status !== "APPROVED") {
    return { success: false, error: `Quote must be SENT or APPROVED to sync (current: ${quote.status})` };
  }

  // Already synced — return existing
  if (quote.qboEstimateId) {
    return { success: true, qboEstimateId: quote.qboEstimateId };
  }

  try {
    // Ensure customer is synced first
    let qboCustomerId = quote.customer.qboCustomerId;
    if (!qboCustomerId) {
      const customerSync = await syncCustomerToQbo(orgId, quote.customerId);
      if (!customerSync.success || !customerSync.qboCustomerId) {
        throw new Error(`Failed to sync customer: ${customerSync.error}`);
      }
      qboCustomerId = customerSync.qboCustomerId;
    }

    // Cascade-sync materials on line items that have materialId but no qboItemId
    for (const lineItem of quote.lineItems) {
      if (lineItem.materialId && lineItem.material && !lineItem.material.qboItemId) {
        await syncMaterialToQbo(orgId, lineItem.materialId);
      }
    }

    // Re-fetch materials to get updated qboItemIds
    const freshLineItems = await prisma.quoteLineItem.findMany({
      where: { quoteId, orgId },
      orderBy: { sortOrder: "asc" },
      include: { material: true },
    });

    // Build estimate payload using mapper
    const estimatePayload = toQboEstimate(
      quote,
      freshLineItems,
      qboCustomerId,
    );

    // Add ItemRef on lines that have a synced material
    if (Array.isArray(estimatePayload.Line)) {
      for (let i = 0; i < estimatePayload.Line.length; i++) {
        const lineItem = freshLineItems[i];
        if (lineItem?.material?.qboItemId && estimatePayload.Line[i].SalesItemLineDetail) {
          estimatePayload.Line[i].SalesItemLineDetail!.ItemRef = { value: lineItem.material.qboItemId };
        }
      }
    }

    const qboEstimate = await createEstimate(connection, estimatePayload);

    await prisma.quote.update({
      where: { id: quoteId },
      data: { qboEstimateId: qboEstimate.Id, qboSyncedAt: new Date() },
    });

    await prisma.qboSyncLog.create({
      data: { orgId, connectionId: connection.id, entityType: "estimate", entityId: quoteId, qboEntityId: qboEstimate.Id, action: "push", status: "success" },
    });

    return { success: true, qboEstimateId: qboEstimate.Id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await prisma.qboSyncLog.create({
      data: { orgId, connectionId: connection.id, entityType: "estimate", entityId: quoteId, action: "push", status: "failed", errorMessage },
    });
    return { success: false, error: errorMessage };
  }
}

// ============================================
// INVOICE SYNC
// ============================================

/**
 * Sync a ServiceOps invoice to QBO.
 * Ensures the customer is synced first, then creates the invoice in QBO.
 * Resolves ItemRef per line item via materialUsage chain.
 * Adds LinkedTxn when invoice has a linked quote with a QBO Estimate.
 */
export async function syncInvoiceToQbo(
  orgId: string,
  invoiceId: string
): Promise<{ success: boolean; qboInvoiceId?: string; error?: string; missingCategories?: string[] }> {
  const connection = await getActiveConnection(orgId);
  if (!connection) {
    return { success: false, error: "No active QBO connection" };
  }

  // Prerequisite gate: require account mapping before financial sync
  const accountMapping = await requireAccountMapping(orgId);
  if (!accountMapping.complete) {
    return {
      success: false,
      error: `Account mapping required — configure in QBO Settings. Missing: ${accountMapping.missing.join(", ")}`,
      missingCategories: accountMapping.missing,
    };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, orgId },
    include: {
      customer: true,
      lineItems: {
        orderBy: { sortOrder: "asc" },
        include: {
          materialUsage: { include: { material: true } },
        },
      },
      quote: true, // For LinkedTxn resolution
    },
  });

  if (!invoice) {
    return { success: false, error: "Invoice not found" };
  }

  // Already synced
  if (invoice.qboInvoiceId) {
    return { success: true, qboInvoiceId: invoice.qboInvoiceId };
  }

  try {
    // Ensure customer is synced to QBO first
    let qboCustomerId = invoice.customer.qboCustomerId;
    if (!qboCustomerId) {
      const customerSync = await syncCustomerToQbo(orgId, invoice.customerId);
      if (!customerSync.success || !customerSync.qboCustomerId) {
        throw new Error(`Failed to sync customer: ${customerSync.error}`);
      }
      qboCustomerId = customerSync.qboCustomerId;
    }

    // Cascade-sync materials via materialUsage chain
    for (const item of invoice.lineItems) {
      if (item.materialUsageId && item.materialUsage?.materialId && item.materialUsage.material && !item.materialUsage.material.qboItemId) {
        await syncMaterialToQbo(orgId, item.materialUsage.materialId);
      }
    }

    // Re-fetch line items with fresh material data after cascade syncs
    const freshLineItems = await prisma.invoiceLineItem.findMany({
      where: { invoiceId, orgId },
      orderBy: { sortOrder: "asc" },
      include: {
        materialUsage: { include: { material: true } },
      },
    });

    // Build line items with ItemRef resolution
    const qboLines = freshLineItems.map((item) => {
      let itemRef: string | undefined;
      if (item.materialUsage?.material?.qboItemId) {
        itemRef = item.materialUsage.material.qboItemId;
      }
      return {
        description: item.description,
        amount: roundQboAmount(item.totalPrice),
        quantity: roundQboAmount(item.quantity),
        unitPrice: roundQboAmount(item.unitPrice),
        ...(itemRef ? { itemRef } : {}),
      };
    });

    // Resolve LinkedTxn from estimate (quote -> QBO estimate link)
    let linkedTxn: Array<{ TxnId: string; TxnType: string }> | undefined;
    if (invoice.quoteId && invoice.quote) {
      let qboEstimateId = invoice.quote.qboEstimateId;
      if (!qboEstimateId) {
        // Cascade-sync the quote as estimate first
        const quoteSync = await syncQuoteToQbo(orgId, invoice.quoteId);
        if (quoteSync.success && quoteSync.qboEstimateId) {
          qboEstimateId = quoteSync.qboEstimateId;
        }
      }
      if (qboEstimateId) {
        linkedTxn = [{ TxnId: qboEstimateId, TxnType: "Estimate" }];
      }
    }

    // Create invoice in QBO with ItemRef and LinkedTxn
    const qboInvoice = await createInvoice(connection, {
      customerRef: qboCustomerId,
      lineItems: qboLines,
      dueDate: invoice.dueDate
        ? invoice.dueDate.toISOString().split("T")[0]
        : undefined,
      docNumber: invoice.invoiceNumber,
      linkedTxn,
    });

    // Update our invoice with QBO ID
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        qboInvoiceId: qboInvoice.Id,
        qboSyncedAt: new Date(),
      },
    });

    // Update last sync time on connection
    await prisma.qboConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });

    // Log success
    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "invoice",
        entityId: invoiceId,
        qboEntityId: qboInvoice.Id,
        action: "push",
        status: "success",
      },
    });

    return { success: true, qboInvoiceId: qboInvoice.Id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "invoice",
        entityId: invoiceId,
        action: "push",
        status: "failed",
        errorMessage,
      },
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Handle a QBO webhook event for payment received.
 * Marks the corresponding ServiceOps invoice as PAID.
 */
export async function handleQboPaymentWebhook(payload: {
  eventNotifications?: Array<{
    realmId: string;
    dataChangeEvent?: {
      entities: Array<{
        name: string;
        id: string;
        operation: string;
      }>;
    };
  }>;
}): Promise<void> {
  if (!payload.eventNotifications) return;

  for (const notification of payload.eventNotifications) {
    const realmId = notification.realmId;
    const entities = notification.dataChangeEvent?.entities || [];

    // Find the connection for this realm
    const connection = await prisma.qboConnection.findFirst({
      where: { realmId, isActive: true },
    });

    if (!connection) continue;

    for (const entity of entities) {
      if (entity.name === "Payment" && entity.operation === "Create") {
        // A payment was created in QBO - check if it applies to one of our invoices
        // In a full implementation, we'd fetch the payment details from QBO
        // to find which invoice(s) it applies to. For now, log the event.
        await prisma.qboSyncLog.create({
          data: {
            orgId: connection.orgId,
            connectionId: connection.id,
            entityType: "payment",
            entityId: connection.orgId, // Placeholder - would be invoice ID after lookup
            qboEntityId: entity.id,
            action: "pull",
            status: "success",
            metadata: { operation: entity.operation, realmId },
          },
        });
      }

      if (entity.name === "Invoice" && entity.operation === "Update") {
        // An invoice was updated in QBO - could mean payment was applied
        // Find our local invoice by QBO ID
        const invoice = await prisma.invoice.findFirst({
          where: {
            orgId: connection.orgId,
            qboInvoiceId: entity.id,
          },
        });

        if (invoice && invoice.status !== "PAID") {
          // Log the event for now
          // Full implementation would fetch the QBO invoice to check balance
          await prisma.qboSyncLog.create({
            data: {
              orgId: connection.orgId,
              connectionId: connection.id,
              entityType: "invoice",
              entityId: invoice.id,
              qboEntityId: entity.id,
              action: "pull",
              status: "success",
              metadata: {
                operation: entity.operation,
                note: "Invoice updated in QBO - may indicate payment",
              },
            },
          });
        }
      }
    }
  }
}

// ============================================
// PAYMENT PROCESSING
// ============================================

/**
 * Process a QBO Payment webhook event.
 * Fetches the payment from QBO, matches to ServiceOps invoice(s),
 * marks PAID when the linked invoice has Balance=0.
 */
export async function processPaymentJob(
  orgId: string,
  qboPaymentId: string,
  realmId: string
): Promise<{ success: boolean; error?: string }> {
  const connection = await prisma.qboConnection.findFirst({
    where: { orgId, realmId, isActive: true },
  });
  if (!connection) return { success: false, error: `No active QBO connection for realm ${realmId}` };

  try {
    // Fetch payment details from QBO
    const payment = await getPayment(connection, qboPaymentId);

    // Extract linked invoice IDs from payment lines
    const linkedInvoiceIds: string[] = [];
    if (payment.Line) {
      for (const line of payment.Line) {
        if (line.LinkedTxn) {
          for (const txn of line.LinkedTxn) {
            if (txn.TxnType === "Invoice") {
              linkedInvoiceIds.push(txn.TxnId);
            }
          }
        }
      }
    }

    if (linkedInvoiceIds.length === 0) {
      await prisma.qboSyncLog.create({
        data: {
          orgId, connectionId: connection.id, entityType: "payment",
          entityId: orgId, qboEntityId: qboPaymentId, action: "pull",
          status: "success", metadata: { note: "Payment has no linked invoices" },
        },
      });
      return { success: true };
    }

    // For each linked invoice, check if it exists in ServiceOps and if balance is 0
    for (const qboInvoiceId of linkedInvoiceIds) {
      const invoice = await prisma.invoice.findFirst({
        where: { orgId, qboInvoiceId },
      });

      if (!invoice || invoice.status === "PAID") continue;

      // Fetch the invoice from QBO to check current balance
      const qboInvoice = await getInvoice(connection, qboInvoiceId);

      if (qboInvoice.Balance === 0) {
        // Fully paid — mark as PAID
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "PAID",
            paidAt: payment.TxnDate ? new Date(payment.TxnDate) : new Date(),
          },
        });

        await prisma.qboSyncLog.create({
          data: {
            orgId, connectionId: connection.id, entityType: "payment",
            entityId: invoice.id, qboEntityId: qboPaymentId, action: "pull",
            status: "success",
            metadata: {
              paymentAmount: payment.TotalAmt,
              paymentMethod: payment.PaymentMethodRef?.name || payment.PaymentMethodRef?.value || null,
              paymentDate: payment.TxnDate,
              invoiceBalance: qboInvoice.Balance,
            },
          },
        });
      } else {
        // Partial payment — log but don't change status
        await prisma.qboSyncLog.create({
          data: {
            orgId, connectionId: connection.id, entityType: "payment",
            entityId: invoice.id, qboEntityId: qboPaymentId, action: "pull",
            status: "success",
            metadata: {
              note: "Partial payment — invoice not fully paid",
              paymentAmount: payment.TotalAmt,
              remainingBalance: qboInvoice.Balance,
              paymentDate: payment.TxnDate,
            },
          },
        });
      }
    }

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await prisma.qboSyncLog.create({
      data: {
        orgId, connectionId: connection.id, entityType: "payment",
        entityId: orgId, qboEntityId: qboPaymentId, action: "pull",
        status: "failed", errorMessage,
      },
    });
    return { success: false, error: errorMessage };
  }
}
