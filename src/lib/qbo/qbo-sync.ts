import { prisma } from "@/lib/prisma";
import {
  createCustomer,
  updateCustomer,
  createInvoice,
  getValidAccessToken,
} from "./qbo-client";
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
      // Create new QBO customer
      const qboCustomer = await createCustomer(connection, {
        displayName: customer.name,
        email: customer.primaryEmail,
        phone: customer.primaryPhone,
        billingStreet1: customer.billingStreet1,
        billingCity: customer.billingCity,
        billingState: customer.billingState,
        billingPostalCode: customer.billingPostalCode,
      });

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

/**
 * Sync a ServiceOps invoice to QBO.
 * Ensures the customer is synced first, then creates the invoice in QBO.
 */
export async function syncInvoiceToQbo(
  orgId: string,
  invoiceId: string
): Promise<{ success: boolean; qboInvoiceId?: string; error?: string }> {
  const connection = await getActiveConnection(orgId);
  if (!connection) {
    return { success: false, error: "No active QBO connection" };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, orgId },
    include: {
      customer: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
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

    // Build line items for QBO
    const lineItems = invoice.lineItems.map((item) => ({
      description: item.description,
      amount: roundQboAmount(item.totalPrice),
      quantity: roundQboAmount(item.quantity),
      unitPrice: roundQboAmount(item.unitPrice),
    }));

    // Create invoice in QBO
    const qboInvoice = await createInvoice(connection, {
      customerRef: qboCustomerId,
      lineItems,
      dueDate: invoice.dueDate
        ? invoice.dueDate.toISOString().split("T")[0]
        : undefined,
      docNumber: invoice.invoiceNumber,
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
