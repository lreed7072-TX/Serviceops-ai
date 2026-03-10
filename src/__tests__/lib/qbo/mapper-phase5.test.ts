import { describe, it, expect } from "vitest";
import {
  toQboEmployee,
  toQboVendor,
  toQboTimeActivity,
  toQboBill,
  toQboPurchase,
  toQboCreditMemo,
  roundQboAmount,
} from "@/lib/qbo/qbo-mapper";

// ============================================
// toQboEmployee — pure mapper tests
// ============================================

describe("toQboEmployee", () => {
  it("maps user with name to QBO Employee", () => {
    const result = toQboEmployee({ name: "John Smith", email: "john@gps.com" });
    expect(result.DisplayName).toBe("John Smith");
    expect(result.GivenName).toBe("John");
    expect(result.FamilyName).toBe("Smith");
    expect(result.BillableTime).toBe(true);
    expect(result.PrimaryEmailAddr).toEqual({ Address: "john@gps.com" });
  });

  it("uses email prefix when name is null", () => {
    const result = toQboEmployee({ name: null, email: "jsmith@gps.com" });
    expect(result.DisplayName).toBe("jsmith");
    expect(result.GivenName).toBeUndefined();
    expect(result.BillableTime).toBe(true);
  });

  it("merges with existing QBO Employee", () => {
    const existing = { Id: "123", SyncToken: "0", DisplayName: "Old Name", Active: true } as any;
    const result = toQboEmployee({ name: "New Name", email: "new@gps.com" }, existing);
    expect(result.Id).toBe("123");
    expect(result.SyncToken).toBe("0");
    expect(result.DisplayName).toBe("New Name");
    expect(result.Active).toBe(true);
  });
});

// ============================================
// toQboVendor — pure mapper tests
// ============================================

describe("toQboVendor", () => {
  it("maps vendor with all fields", () => {
    const result = toQboVendor({
      name: "FlowServe Parts",
      companyName: "FlowServe Inc",
      email: "parts@flowserve.com",
      phone: "972-555-1234",
      address: "100 Main St",
      city: "Dallas",
      state: "TX",
      postalCode: "75001",
      tax1099: true,
    });
    expect(result.DisplayName).toBe("FlowServe Parts");
    expect(result.CompanyName).toBe("FlowServe Inc");
    expect(result.PrimaryEmailAddr).toEqual({ Address: "parts@flowserve.com" });
    expect(result.PrimaryPhone).toEqual({ FreeFormNumber: "972-555-1234" });
    expect(result.BillAddr).toEqual({
      Line1: "100 Main St",
      City: "Dallas",
      CountrySubDivisionCode: "TX",
      PostalCode: "75001",
    });
    expect(result.Vendor1099).toBe(true);
    expect(result.PrintOnCheckName).toBe("FlowServe Inc");
  });

  it("handles minimal vendor", () => {
    const result = toQboVendor({
      name: "Quick Parts LLC",
      tax1099: false,
    });
    expect(result.DisplayName).toBe("Quick Parts LLC");
    expect(result.PrimaryEmailAddr).toBeUndefined();
    expect(result.PrimaryPhone).toBeUndefined();
    expect(result.Vendor1099).toBe(false);
    expect(result.PrintOnCheckName).toBe("Quick Parts LLC");
  });

  it("merges with existing QBO Vendor", () => {
    const existing = {
      Id: "456",
      SyncToken: "2",
      DisplayName: "Old Vendor",
      AcctNum: "V-100",
    } as any;
    const result = toQboVendor(
      { name: "Updated Vendor", tax1099: false },
      existing
    );
    expect(result.Id).toBe("456");
    expect(result.SyncToken).toBe("2");
    expect(result.DisplayName).toBe("Updated Vendor");
    expect(result.AcctNum).toBe("V-100");
  });
});

// ============================================
// toQboTimeActivity — pure mapper tests
// ============================================

describe("toQboTimeActivity", () => {
  it("maps billable time entry with hours and minutes", () => {
    const result = toQboTimeActivity(
      { startedAt: new Date("2026-03-09T08:00:00Z"), accumulatedSeconds: 5400, notes: "Pump repair" },
      "emp-1",
      "cust-1"
    );
    expect(result.Hours).toBe(1);
    expect(result.Minutes).toBe(30);
    expect(result.BillableStatus).toBe("Billable");
    expect(result.EmployeeRef).toEqual({ value: "emp-1" });
    expect(result.CustomerRef).toEqual({ value: "cust-1" });
    expect(result.NameOf).toBe("Employee");
    expect(result.TxnDate).toBe("2026-03-09");
    expect(result.Description).toBe("Pump repair");
  });

  it("maps non-billable time entry", () => {
    const result = toQboTimeActivity(
      { startedAt: new Date("2026-03-09T08:00:00Z"), accumulatedSeconds: 3600, notes: null },
      "emp-2",
      "cust-2",
      { billable: false }
    );
    expect(result.BillableStatus).toBe("NotBillable");
    expect(result.Description).toBeUndefined();
  });

  it("includes ClassRef and ItemRef", () => {
    const result = toQboTimeActivity(
      { startedAt: new Date("2026-03-09T08:00:00Z"), accumulatedSeconds: 7200, notes: null },
      "emp-3",
      "cust-3",
      { classRef: { value: "cls-1", name: "Work Order" }, qboItemId: "item-99" }
    );
    expect(result.ClassRef).toEqual({ value: "cls-1", name: "Work Order" });
    expect(result.ItemRef).toEqual({ value: "item-99" });
  });
});

// ============================================
// toQboBill — pure mapper tests
// ============================================

describe("toQboBill", () => {
  it("maps stock movement to QBO Bill", () => {
    const result = toQboBill(
      { totalCost: 250.5, unitCost: 50.1, quantity: 5, reference: "PO-100", notes: null, createdAt: new Date("2026-03-09T12:00:00Z") },
      { name: "Bearing Kit" },
      "vendor-1",
      { value: "acct-exp-1", name: "Job Cost Expense" }
    );
    expect(result.VendorRef).toEqual({ value: "vendor-1" });
    expect(result.TxnDate).toBe("2026-03-09");
    expect(result.DocNumber).toBe("PO-100");
    expect(result.Line).toHaveLength(1);
    expect(result.Line![0].Amount).toBe(roundQboAmount(250.5));
    expect(result.Line![0].DetailType).toBe("AccountBasedExpenseLineDetail");
    expect(result.Line![0].AccountBasedExpenseLineDetail?.AccountRef).toEqual({ value: "acct-exp-1", name: "Job Cost Expense" });
  });

  it("includes ClassRef on line", () => {
    const result = toQboBill(
      { totalCost: 100, unitCost: 100, quantity: 1, reference: null, notes: null, createdAt: new Date("2026-03-09T12:00:00Z") },
      { name: "Seal Kit" },
      "vendor-2",
      { value: "acct-exp-1" },
      { classRef: { value: "cls-2", name: "Maintenance" } }
    );
    expect(result.Line![0].AccountBasedExpenseLineDetail?.ClassRef).toEqual({ value: "cls-2", name: "Maintenance" });
  });
});

// ============================================
// toQboPurchase — pure mapper tests
// ============================================

describe("toQboPurchase", () => {
  it("maps stock movement to QBO Purchase", () => {
    const result = toQboPurchase(
      { totalCost: 75.25, reference: "RCV-200", notes: null, createdAt: new Date("2026-03-08T10:00:00Z") },
      { name: "O-Ring Set" },
      { value: "acct-exp-2", name: "Job Costs" }
    );
    expect(result.PaymentType).toBe("Cash");
    expect(result.AccountRef).toEqual({ value: "acct-exp-2", name: "Job Costs" });
    expect(result.Line).toHaveLength(1);
    expect(result.Line![0].Amount).toBe(roundQboAmount(75.25));
    expect(result.DocNumber).toBe("RCV-200");
  });

  it("formats TxnDate as YYYY-MM-DD", () => {
    const result = toQboPurchase(
      { totalCost: 50, reference: null, notes: null, createdAt: new Date("2026-12-25T23:59:59Z") },
      { name: "Gasket" },
      { value: "acct-1" }
    );
    expect(result.TxnDate).toBe("2026-12-25");
    expect(result.DocNumber).toBeUndefined();
  });
});

// ============================================
// toQboCreditMemo — pure mapper tests
// ============================================

describe("toQboCreditMemo", () => {
  it("maps invoice to CreditMemo with LinkedTxn", () => {
    const result = toQboCreditMemo(
      { total: 500, invoiceNumber: "INV-001", notes: "Refund for damaged goods" },
      [
        { description: "Pump Seal", totalPrice: 250, quantity: 2, unitPrice: 125 },
        { description: "Labor", totalPrice: 250, quantity: 2.5, unitPrice: 100 },
      ],
      "cust-qbo-1",
      "inv-qbo-1"
    );
    expect(result.CustomerRef).toEqual({ value: "cust-qbo-1" });
    expect(result.LinkedTxn).toEqual([{ TxnId: "inv-qbo-1", TxnType: "Invoice" }]);
    expect(result.DocNumber).toBe("CM-INV-001");
    expect(result.CustomerMemo).toEqual({ value: "Refund for damaged goods" });
  });

  it("maps line items with correct amounts", () => {
    const result = toQboCreditMemo(
      { total: 375.999, invoiceNumber: "INV-002", notes: null },
      [
        { description: "Part A", totalPrice: 125.333, quantity: 1, unitPrice: 125.333 },
        { description: "Part B", totalPrice: 250.666, quantity: 2, unitPrice: 125.333 },
      ],
      "cust-qbo-2",
      "inv-qbo-2"
    );
    expect(result.Line).toHaveLength(2);
    expect(result.Line![0].Amount).toBe(roundQboAmount(125.333));
    expect(result.Line![1].Amount).toBe(roundQboAmount(250.666));
    expect(result.Line![0].SalesItemLineDetail?.UnitPrice).toBe(roundQboAmount(125.333));
    expect(result.CustomerMemo).toBeUndefined();
  });
});
