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
  getCustomer,
  voidInvoice,
  createEmployee,
  getEmployee,
  updateEmployee,
  createVendor,
  getVendor,
  updateVendor,
  createClass,
  queryClasses,
  getPreferences,
  createTimeActivity,
  createBill,
  createPurchase,
  createCreditMemo,
} from "./qbo-client";
import {
  toQboItem,
  toQboEstimate,
  fromQboCustomer,
  toQboEmployee,
  toQboVendor,
  toQboTimeActivity,
  toQboBill,
  toQboPurchase,
  toQboCreditMemo,
} from "./qbo-mapper";
import type { QboItem, QboCustomer, QboEmployee, QboVendor, QboRef, QboClass } from "./qbo-types";
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

    // Resolve ClassRef from quote's converted order type (if applicable)
    let classRef: QboRef | undefined;
    if (quote.convertedToOrderType) {
      const resolved = await resolveOrCreateQboClass(connection, orgId, quote.convertedToOrderType);
      classRef = resolved ?? undefined;
    }

    // Build estimate payload using mapper
    const estimatePayload = toQboEstimate(
      quote,
      freshLineItems,
      qboCustomerId,
    );

    // Apply ClassRef to estimate payload
    if (classRef) {
      (estimatePayload as Record<string, unknown>).ClassRef = { value: classRef.value, name: classRef.name };
    }

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

    // Resolve ClassRef from work order type
    let classRef: QboRef | undefined;
    if (invoice.workOrderId) {
      const workOrder = await prisma.workOrder.findFirst({
        where: { id: invoice.workOrderId, orgId },
        select: { orderType: true },
      });
      if (workOrder) {
        const resolved = await resolveOrCreateQboClass(connection, orgId, workOrder.orderType);
        classRef = resolved ?? undefined;
      }
    }

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

    // Create invoice in QBO with ItemRef, LinkedTxn, and ClassRef
    const qboInvoice = await createInvoice(connection, {
      customerRef: qboCustomerId,
      lineItems: qboLines,
      dueDate: invoice.dueDate
        ? invoice.dueDate.toISOString().split("T")[0]
        : undefined,
      docNumber: invoice.invoiceNumber,
      linkedTxn,
      classRef: classRef ? { value: classRef.value, name: classRef.name } : undefined,
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

// ============================================
// INBOUND CUSTOMER SYNC (SYNC-02)
// ============================================

/**
 * Process an inbound QBO customer into ServiceOps.
 * Handles create and update paths with field-ownership split:
 * - QBO wins: name, primaryEmail, primaryPhone, billing address fields
 * - ServiceOps wins: status, operational fields (not touched here)
 *
 * Lookup precedence:
 * 1. Match by qboCustomerId (strongest link)
 * 2. Fallback: match by primaryEmail (for pre-existing customers not yet linked)
 */
export async function processInboundCustomer(
  orgId: string,
  qboCustomer: QboCustomer,
  connectionId: string
): Promise<{ success: boolean; action: "created" | "updated" | "skipped"; error?: string }> {
  try {
    // Find existing customer by QBO ID first
    let existing = await prisma.customer.findFirst({
      where: { qboCustomerId: qboCustomer.Id, orgId },
    });

    // Fallback: match by email if QBO ID not found
    if (!existing && qboCustomer.PrimaryEmailAddr?.Address) {
      existing = await prisma.customer.findFirst({
        where: { primaryEmail: qboCustomer.PrimaryEmailAddr.Address, orgId },
      });
    }

    // Extract QBO-wins fields via pure mapper
    const fields = fromQboCustomer(qboCustomer);

    // Build metadata for logging — include qboActive flag if customer is inactive in QBO
    const metadataBase: Record<string, unknown> = { source: "qbo_cdc" };
    if (qboCustomer.Active === false) {
      metadataBase.qboActive = false; // Note only — ServiceOps wins on status
    }

    if (existing) {
      // Update path: apply QBO-wins fields, always set qboCustomerId link
      await prisma.customer.update({
        where: { id: existing.id },
        data: { ...fields, qboCustomerId: qboCustomer.Id },
      });

      await prisma.qboSyncLog.create({
        data: {
          orgId,
          connectionId,
          entityType: "customer",
          entityId: existing.id,
          qboEntityId: qboCustomer.Id,
          action: "pull",
          status: "success",
          metadata: { ...metadataBase, fieldsUpdated: Object.keys(fields) },
        },
      });

      return { success: true, action: "updated" };
    } else {
      // Create path: new customer record from QBO data
      // createdByUserId is nullable on Customer model — omit for CDC-created records
      const created = await prisma.customer.create({
        data: { orgId, qboCustomerId: qboCustomer.Id, ...fields },
      });

      await prisma.qboSyncLog.create({
        data: {
          orgId,
          connectionId,
          entityType: "customer",
          entityId: created.id,
          qboEntityId: qboCustomer.Id,
          action: "pull",
          status: "success",
          metadata: { ...metadataBase, action: "created_inbound" },
        },
      });

      return { success: true, action: "created" };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId,
        entityType: "customer",
        entityId: orgId,
        qboEntityId: qboCustomer.Id,
        action: "pull",
        status: "failed",
        errorMessage,
      },
    });
    return { success: false, action: "skipped", error: errorMessage };
  }
}

/**
 * Wrapper called by the cron flush dispatcher for CDC customer events.
 * Fetches the QBO customer by ID and delegates to processInboundCustomer().
 */
export async function processCdcCustomerPull(
  orgId: string,
  qboCustomerId: string,
  realmId: string
): Promise<{ success: boolean; error?: string }> {
  const connection = await prisma.qboConnection.findFirst({
    where: { orgId, realmId, isActive: true },
  });
  if (!connection) return { success: false, error: `No active QBO connection for realm ${realmId}` };

  try {
    const qboCustomer = await getCustomer(connection, qboCustomerId);
    const result = await processInboundCustomer(orgId, qboCustomer, connection.id);
    return { success: result.success, error: result.error };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "customer",
        entityId: orgId,
        qboEntityId: qboCustomerId,
        action: "pull",
        status: "failed",
        errorMessage,
      },
    });
    return { success: false, error: errorMessage };
  }
}

// ============================================
// INBOUND INVOICE CHANGE DETECTION (PAY-02)
// ============================================

/**
 * Process a CDC Invoice change event from QBO.
 * Detects voids, full payments, and partial payments.
 *
 * Detection order (in priority):
 * 1. Void: status === "Voided" → mark CANCELED (no-op if already CANCELED)
 * 2. Full payment: Balance === 0 → mark PAID with paidAt (no-op if already PAID)
 * 3. Partial payment: 0 < Balance < TotalAmt → log only, no status change
 * 4. No change: self-originated CDC entity — return success
 *
 * Uses string literal "CANCELED" / "PAID" which match Prisma InvoiceStatus enum values.
 */
export async function processCdcInvoiceChange(
  orgId: string,
  qboInvoiceId: string,
  realmId: string
): Promise<{ success: boolean; error?: string }> {
  const connection = await prisma.qboConnection.findFirst({
    where: { orgId, realmId, isActive: true },
  });
  if (!connection) return { success: false, error: `No active QBO connection for realm ${realmId}` };

  try {
    // Fetch current invoice state from QBO (includes status and Balance)
    const qboInvoice = await getInvoice(connection, qboInvoiceId);

    // Find matching ServiceOps invoice
    const invoice = await prisma.invoice.findFirst({
      where: { orgId, qboInvoiceId },
    });

    if (!invoice) {
      // QBO invoice not tracked in ServiceOps — log and return success
      await prisma.qboSyncLog.create({
        data: {
          orgId,
          connectionId: connection.id,
          entityType: "invoice",
          entityId: orgId,
          qboEntityId: qboInvoiceId,
          action: "pull",
          status: "success",
          metadata: { source: "qbo_cdc", note: "Invoice not found in ServiceOps — skipped" },
        },
      });
      return { success: true };
    }

    // 1. Void detection
    if (qboInvoice.status === "Voided") {
      if (invoice.status === "CANCELED") {
        return { success: true }; // No-op: already in correct state
      }

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "CANCELED" },
      });

      await prisma.qboSyncLog.create({
        data: {
          orgId,
          connectionId: connection.id,
          entityType: "invoice",
          entityId: invoice.id,
          qboEntityId: qboInvoiceId,
          action: "pull",
          status: "success",
          metadata: { source: "qbo_cdc", voided: true },
        },
      });

      return { success: true };
    }

    // 2. Full payment detection
    if (qboInvoice.Balance === 0) {
      if (invoice.status === "PAID") {
        return { success: true }; // No-op: already in correct state
      }

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAID", paidAt: new Date() },
      });

      await prisma.qboSyncLog.create({
        data: {
          orgId,
          connectionId: connection.id,
          entityType: "invoice",
          entityId: invoice.id,
          qboEntityId: qboInvoiceId,
          action: "pull",
          status: "success",
          metadata: { source: "qbo_cdc", fullyPaid: true, balance: 0 },
        },
      });

      return { success: true };
    }

    // 3. Partial payment detection
    if (qboInvoice.Balance > 0 && qboInvoice.Balance < qboInvoice.TotalAmt) {
      await prisma.qboSyncLog.create({
        data: {
          orgId,
          connectionId: connection.id,
          entityType: "invoice",
          entityId: invoice.id,
          qboEntityId: qboInvoiceId,
          action: "pull",
          status: "success",
          metadata: {
            source: "qbo_cdc",
            remainingBalance: qboInvoice.Balance,
            note: "Partial payment",
          },
        },
      });

      return { success: true };
    }

    // 4. No change (self-originated CDC entity or no actionable diff)
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "invoice",
        entityId: orgId,
        qboEntityId: qboInvoiceId,
        action: "pull",
        status: "failed",
        errorMessage,
      },
    });
    return { success: false, error: errorMessage };
  }
}

// ============================================
// OUTBOUND VOID (PAY-02)
// ============================================

/**
 * Void a QBO invoice when the corresponding ServiceOps invoice is CANCELED.
 * Fetches a fresh SyncToken before voiding (ServiceOps does not store SyncToken).
 * Guards against voiding an already-voided invoice to prevent double-void errors.
 * The existing retry infrastructure in qbo-queue handles stale SyncToken errors.
 */
export async function processVoidInvoiceInQbo(
  orgId: string,
  invoiceId: string
): Promise<{ success: boolean; error?: string }> {
  const connection = await getActiveConnection(orgId);
  if (!connection) return { success: false, error: "No active QBO connection" };

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, orgId },
    });

    if (!invoice) return { success: false, error: "Invoice not found" };

    if (!invoice.qboInvoiceId) {
      return { success: false, error: "Invoice not synced to QBO" };
    }

    // Fetch fresh SyncToken — required for QBO void operation
    const qboInvoice = await getInvoice(connection, invoice.qboInvoiceId);

    // Guard: already voided in QBO — skip to prevent double-void error (Risk 7)
    if (qboInvoice.status === "Voided") {
      await prisma.qboSyncLog.create({
        data: {
          orgId,
          connectionId: connection.id,
          entityType: "invoice",
          entityId: invoiceId,
          qboEntityId: invoice.qboInvoiceId,
          action: "void",
          status: "success",
          metadata: { note: "Already voided in QBO — skipped" },
        },
      });
      return { success: true };
    }

    // Void the invoice in QBO using fresh SyncToken
    await voidInvoice(connection, invoice.qboInvoiceId, qboInvoice.SyncToken);

    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "invoice",
        entityId: invoiceId,
        qboEntityId: invoice.qboInvoiceId,
        action: "void",
        status: "success",
        metadata: { source: "serviceops_cancel" },
      },
    });

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "invoice",
        entityId: invoiceId,
        action: "void",
        status: "failed",
        errorMessage,
      },
    });
    return { success: false, error: errorMessage };
  }
}

// ============================================
// VENDOR SYNC (VEND-01)
// ============================================

/**
 * Sync a ServiceOps Vendor to QBO.
 * Creates new vendor if not yet synced, updates if already synced.
 * Uses DisplayName collision handling for new vendors.
 */
export async function syncVendorToQbo(
  orgId: string,
  vendorId: string
): Promise<{ success: boolean; qboVendorId?: string; error?: string }> {
  try {
    const connection = await getActiveConnection(orgId);
    if (!connection) return { success: false, error: "No active QBO connection" };

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, orgId },
    });
    if (!vendor) return { success: false, error: "Vendor not found" };

    let qboVendor;

    if (vendor.qboVendorId) {
      // Update existing
      const existing = await getVendor(connection, vendor.qboVendorId);
      const payload = toQboVendor(vendor, existing);
      qboVendor = await updateVendor(connection, vendor.qboVendorId, payload);
    } else {
      // Create — use collision handling
      const { entity } = await resolveOrCreateQboEntity<QboVendor>(
        connection,
        "Vendor",
        vendor.name,
        (existing) =>
          !!vendor.email &&
          existing.PrimaryEmailAddr?.Address?.toLowerCase() === vendor.email.toLowerCase(),
        () => createVendor(connection, toQboVendor(vendor))
      );
      qboVendor = entity;
    }

    await prisma.vendor.update({
      where: { id: vendorId },
      data: { qboVendorId: qboVendor.Id, qboSyncedAt: new Date() },
    });

    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "vendor",
        entityId: vendorId,
        qboEntityId: qboVendor.Id,
        action: "push",
        status: "success",
      },
    });

    return { success: true, qboVendorId: qboVendor.Id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const conn = await getActiveConnection(orgId);
      if (conn) {
        await prisma.qboSyncLog.create({
          data: {
            orgId,
            connectionId: conn.id,
            entityType: "vendor",
            entityId: vendorId,
            action: "push",
            status: "failed",
            errorMessage: message,
          },
        });
      }
    } catch {}
    return { success: false, error: message };
  }
}

// ============================================
// EMPLOYEE SYNC (TIME-01)
// ============================================

/**
 * Sync a ServiceOps TECH user to QBO as an Employee.
 * Only users with role=TECH are eligible.
 * Uses DisplayName collision handling for new employees.
 */
export async function syncEmployeeToQbo(
  orgId: string,
  userId: string
): Promise<{ success: boolean; qboEmployeeId?: string; error?: string }> {
  try {
    const connection = await getActiveConnection(orgId);
    if (!connection) return { success: false, error: "No active QBO connection" };

    const user = await prisma.user.findFirst({
      where: { id: userId, orgId, role: "TECH" },
    });
    if (!user) return { success: false, error: "User not found or not a TECH role" };

    let qboEmployee;

    if (user.qboEmployeeId) {
      // Update existing
      const existing = await getEmployee(connection, user.qboEmployeeId);
      const payload = toQboEmployee(user, existing);
      qboEmployee = await updateEmployee(connection, user.qboEmployeeId, payload);
    } else {
      // Create — use collision handling
      const displayName = user.name ?? user.email.split("@")[0];
      const { entity } = await resolveOrCreateQboEntity<QboEmployee>(
        connection,
        "Employee",
        displayName,
        (existing) =>
          existing.PrimaryEmailAddr?.Address?.toLowerCase() === user.email.toLowerCase(),
        () => createEmployee(connection, toQboEmployee(user))
      );
      qboEmployee = entity;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { qboEmployeeId: qboEmployee.Id },
    });

    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "employee",
        entityId: userId,
        qboEntityId: qboEmployee.Id,
        action: "push",
        status: "success",
      },
    });

    return { success: true, qboEmployeeId: qboEmployee.Id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const conn = await getActiveConnection(orgId);
      if (conn) {
        await prisma.qboSyncLog.create({
          data: {
            orgId,
            connectionId: conn.id,
            entityType: "employee",
            entityId: userId,
            action: "push",
            status: "failed",
            errorMessage: message,
          },
        });
      }
    } catch {}
    return { success: false, error: message };
  }
}

// ============================================
// TIME ENTRY → TIME ACTIVITY SYNC (TIME-02)
// ============================================

/**
 * Sync a ServiceOps TimeEntry to QBO as a TimeActivity.
 * Cascade-syncs employee and customer as needed.
 * PM-generated WOs (sourceWorkflowId set) are non-billable.
 * Uses class tracking when enabled.
 */
export async function syncTimeEntryToQbo(
  orgId: string,
  timeEntryId: string
): Promise<{ success: boolean; qboTimeActivityId?: string; error?: string }> {
  try {
    const connection = await getActiveConnection(orgId);
    if (!connection) return { success: false, error: "No active QBO connection" };

    const timeEntry = await prisma.timeEntry.findFirst({
      where: { id: timeEntryId, orgId },
      include: {
        user: true,
        workOrder: {
          include: { customer: true },
        },
      },
    });
    if (!timeEntry) return { success: false, error: "Time entry not found" };

    // Guard: must be STOPPED
    if (timeEntry.status !== "STOPPED") {
      return { success: false, error: "TimeEntry must be STOPPED to sync" };
    }

    // Guard: user must be TECH
    if (timeEntry.user.role !== "TECH") {
      return { success: false, error: "Only TECH users sync as QBO employees" };
    }

    // Already synced guard
    if (timeEntry.qboTimeActivityId) {
      return { success: true, qboTimeActivityId: timeEntry.qboTimeActivityId };
    }

    // Cascade employee sync
    let qboEmployeeId = timeEntry.user.qboEmployeeId;
    if (!qboEmployeeId) {
      const empResult = await syncEmployeeToQbo(orgId, timeEntry.userId);
      if (!empResult.success) {
        return { success: false, error: `Employee sync failed: ${empResult.error}` };
      }
      qboEmployeeId = empResult.qboEmployeeId!;
    }

    // Cascade customer sync
    const customer = timeEntry.workOrder.customer;
    let qboCustomerId = customer.qboCustomerId;
    if (!qboCustomerId) {
      const custResult = await syncCustomerToQbo(orgId, customer.id);
      if (!custResult.success) {
        return { success: false, error: `Customer sync failed: ${custResult.error}` };
      }
      // Re-fetch for qboCustomerId
      const refreshed = await prisma.customer.findFirst({
        where: { id: customer.id, orgId },
        select: { qboCustomerId: true },
      });
      qboCustomerId = refreshed?.qboCustomerId ?? null;
    }
    if (!qboCustomerId) {
      return { success: false, error: "Customer QBO sync failed to produce qboCustomerId" };
    }

    // Billable classification: PM-generated WOs are non-billable
    const billable = !timeEntry.workOrder.sourceWorkflowId;

    // Class tracking
    const classRef = await resolveOrCreateQboClass(connection, orgId, timeEntry.workOrder.orderType);

    // Build payload
    const payload = toQboTimeActivity(
      timeEntry,
      qboEmployeeId,
      qboCustomerId,
      { classRef: classRef ?? undefined, billable }
    );

    const result = await createTimeActivity(connection, payload);

    // Store qboTimeActivityId
    await prisma.timeEntry.update({
      where: { id: timeEntryId },
      data: { qboTimeActivityId: result.Id },
    });

    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "timeActivity",
        entityId: timeEntryId,
        qboEntityId: result.Id,
        action: "push",
        status: "success",
      },
    });

    return { success: true, qboTimeActivityId: result.Id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const conn = await getActiveConnection(orgId);
      if (conn) {
        await prisma.qboSyncLog.create({
          data: {
            orgId,
            connectionId: conn.id,
            entityType: "timeActivity",
            entityId: timeEntryId,
            action: "push",
            status: "failed",
            errorMessage: message,
          },
        });
      }
    } catch {}
    return { success: false, error: message };
  }
}

// ============================================
// EXPENSE SYNC — BILL / PURCHASE (EXP-01)
// ============================================

/**
 * Sync a ServiceOps StockMovement (PURCHASE) to QBO as a Bill or Purchase.
 * Bill path: vendor is linked → create Bill with vendor reference.
 * Purchase path: no vendor → create Purchase (cash/check expense).
 * Uses account mapping for expense categorization.
 */
export async function syncExpenseToQbo(
  orgId: string,
  stockMovementId: string
): Promise<{ success: boolean; qboExpenseId?: string; error?: string }> {
  try {
    const connection = await getActiveConnection(orgId);
    if (!connection) return { success: false, error: "No active QBO connection" };

    // Account mapping gate
    const accountMapping = await requireAccountMapping(orgId);

    const movement = await prisma.stockMovement.findFirst({
      where: { id: stockMovementId, orgId },
      include: {
        material: {
          include: { vendor: true },
        },
      },
    });
    if (!movement) return { success: false, error: "Stock movement not found" };

    // Guard: must be PURCHASE
    if (movement.movementType !== "PURCHASE") {
      return { success: false, error: "Only PURCHASE movements sync as expenses" };
    }

    // Guard: totalCost must exist
    if (!movement.totalCost || Number(movement.totalCost) === 0) {
      return { success: false, error: "No cost on movement — skipping" };
    }

    // Already synced guard
    if (movement.qboBillId || movement.qboPurchaseId) {
      return {
        success: true,
        qboExpenseId: movement.qboBillId || movement.qboPurchaseId || undefined,
      };
    }

    // Determine expense account category
    const expenseCategory =
      movement.material.vendor?.vendorType === "SUBCONTRACTOR"
        ? "subcontractor_expense"
        : "job_cost_expense";
    const expenseMapping = await getAccountMapping(orgId, expenseCategory);
    const expenseAccountRef = { value: expenseMapping.qboAccountId, name: expenseMapping.qboAccountName ?? undefined };

    // Class tracking — attempt to resolve from linked work orders
    let classRef: QboRef | null = null;
    // StockMovement doesn't directly link to WO, so classRef stays undefined for now
    // Could be enhanced to trace through material usage → task → WO in a future iteration

    if (movement.material.vendorId && movement.material.vendor) {
      // BILL path — vendor is linked
      const vendor = movement.material.vendor;

      // Cascade vendor sync
      let qboVendorId = vendor.qboVendorId;
      if (!qboVendorId) {
        const vendorResult = await syncVendorToQbo(orgId, vendor.id);
        if (!vendorResult.success) {
          return { success: false, error: `Vendor sync failed: ${vendorResult.error}` };
        }
        qboVendorId = vendorResult.qboVendorId!;
      }

      const payload = toQboBill(
        movement,
        movement.material,
        qboVendorId,
        expenseAccountRef,
        { classRef: classRef ?? undefined }
      );

      const bill = await createBill(connection, payload);

      await prisma.stockMovement.update({
        where: { id: stockMovementId },
        data: { qboBillId: bill.Id },
      });

      await prisma.qboSyncLog.create({
        data: {
          orgId,
          connectionId: connection.id,
          entityType: "expense",
          entityId: stockMovementId,
          qboEntityId: bill.Id,
          action: "push",
          status: "success",
          metadata: { type: "bill" },
        },
      });

      return { success: true, qboExpenseId: bill.Id };
    } else {
      // PURCHASE path — no vendor
      const payload = toQboPurchase(
        movement,
        movement.material,
        expenseAccountRef,
        { classRef: classRef ?? undefined }
      );

      const purchase = await createPurchase(connection, payload);

      await prisma.stockMovement.update({
        where: { id: stockMovementId },
        data: { qboPurchaseId: purchase.Id },
      });

      await prisma.qboSyncLog.create({
        data: {
          orgId,
          connectionId: connection.id,
          entityType: "expense",
          entityId: stockMovementId,
          qboEntityId: purchase.Id,
          action: "push",
          status: "success",
          metadata: { type: "purchase" },
        },
      });

      return { success: true, qboExpenseId: purchase.Id };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const conn = await getActiveConnection(orgId);
      if (conn) {
        await prisma.qboSyncLog.create({
          data: {
            orgId,
            connectionId: conn.id,
            entityType: "expense",
            entityId: stockMovementId,
            action: "push",
            status: "failed",
            errorMessage: message,
          },
        });
      }
    } catch {}
    return { success: false, error: message };
  }
}

// ============================================
// CREDIT MEMO SYNC (QUOT-03)
// ============================================

/**
 * Sync a credit memo to QBO for a previously-synced invoice.
 * Requires the invoice to already have a qboInvoiceId.
 * Cascade-syncs customer as needed. Uses class tracking from WO.
 */
export async function syncCreditMemoToQbo(
  orgId: string,
  invoiceId: string
): Promise<{ success: boolean; qboCreditMemoId?: string; error?: string }> {
  try {
    const connection = await getActiveConnection(orgId);
    if (!connection) return { success: false, error: "No active QBO connection" };

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, orgId },
      include: { customer: true, lineItems: true, workOrder: true },
    });
    if (!invoice) return { success: false, error: "Invoice not found" };

    // Guard: must be synced to QBO
    if (!invoice.qboInvoiceId) {
      return { success: false, error: "Invoice must be synced to QBO before issuing credit memo" };
    }

    // Already synced guard
    if (invoice.qboCreditMemoId) {
      return { success: true, qboCreditMemoId: invoice.qboCreditMemoId };
    }

    // Cascade customer sync
    let qboCustomerId = invoice.customer.qboCustomerId;
    if (!qboCustomerId) {
      const custResult = await syncCustomerToQbo(orgId, invoice.customerId);
      if (!custResult.success) {
        return { success: false, error: `Customer sync failed: ${custResult.error}` };
      }
      const refreshed = await prisma.customer.findFirst({
        where: { id: invoice.customerId, orgId },
        select: { qboCustomerId: true },
      });
      qboCustomerId = refreshed?.qboCustomerId ?? null;
    }
    if (!qboCustomerId) {
      return { success: false, error: "Customer QBO sync failed" };
    }

    // Class tracking from work order
    let classRef: QboRef | undefined;
    if (invoice.workOrder) {
      const resolved = await resolveOrCreateQboClass(connection, orgId, invoice.workOrder.orderType);
      classRef = resolved ?? undefined;
    }

    const payload = toQboCreditMemo(
      invoice,
      invoice.lineItems,
      qboCustomerId,
      invoice.qboInvoiceId,
      { classRef }
    );

    const result = await createCreditMemo(connection, payload);

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { qboCreditMemoId: result.Id },
    });

    await prisma.qboSyncLog.create({
      data: {
        orgId,
        connectionId: connection.id,
        entityType: "creditMemo",
        entityId: invoiceId,
        qboEntityId: result.Id,
        action: "push",
        status: "success",
      },
    });

    return { success: true, qboCreditMemoId: result.Id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const conn = await getActiveConnection(orgId);
      if (conn) {
        await prisma.qboSyncLog.create({
          data: {
            orgId,
            connectionId: conn.id,
            entityType: "creditMemo",
            entityId: invoiceId,
            action: "push",
            status: "failed",
            errorMessage: message,
          },
        });
      }
    } catch {}
    return { success: false, error: message };
  }
}

// ============================================
// QBO CLASS TRACKING
// ============================================

/**
 * Resolve or auto-create a QBO Class for an OrderType.
 * Caches mappings in qboClassMap table.
 * Returns null if class tracking is disabled or on any error
 * (class tracking failure must NEVER block a sync).
 */
export async function resolveOrCreateQboClass(
  connection: QboConnection,
  orgId: string,
  orderType: string
): Promise<QboRef | null> {
  try {
    // Check if class tracking is enabled
    if (!connection.classTrackingEnabled) {
      return null;
    }

    // Check cache
    const existing = await prisma.qboClassMap.findUnique({
      where: { orgId_orderType: { orgId, orderType } },
    });
    if (existing) {
      return { value: existing.qboClassId, name: existing.qboClassName };
    }

    // Auto-create QBO Class
    const classNameMap: Record<string, string> = {
      WORK_ORDER: "Work Order",
      SALES_ORDER: "Sales Order",
      PROJECT: "Project",
      MAINTENANCE: "Maintenance",
    };
    const className = classNameMap[orderType] || orderType;

    const qboClass = await createClass(connection, { Name: className });

    // Cache the mapping
    await prisma.qboClassMap.upsert({
      where: { orgId_orderType: { orgId, orderType } },
      create: {
        orgId,
        orderType,
        qboClassId: qboClass.Id,
        qboClassName: className,
      },
      update: {
        qboClassId: qboClass.Id,
        qboClassName: className,
      },
    });

    return { value: qboClass.Id, name: className };
  } catch (err) {
    // Class tracking failure must NEVER block a sync
    console.error(`[qbo-sync] Failed to resolve QBO class for ${orderType}:`, err);
    return null;
  }
}

// ============================================
// QBO PREFERENCES CACHE
// ============================================

/**
 * Fetch QBO company preferences and cache class/location tracking flags.
 * Called after OAuth connect and periodically to keep flags current.
 */
export async function fetchAndCachePreferences(
  connection: QboConnection
): Promise<{ classTrackingEnabled: boolean; locationTrackingEnabled: boolean }> {
  const prefs = await getPreferences(connection);

  const classTrackingEnabled =
    prefs.AccountingInfoPrefs?.ClassTrackingPerTxn === true ||
    prefs.AccountingInfoPrefs?.ClassTrackingPerTxnLine === true;

  const locationTrackingEnabled =
    prefs.AccountingInfoPrefs?.TrackDepartments === true;

  await prisma.qboConnection.update({
    where: { id: connection.id },
    data: {
      classTrackingEnabled,
      locationTrackingEnabled,
      preferencesLastCheckedAt: new Date(),
    },
  });

  return { classTrackingEnabled, locationTrackingEnabled };
}
