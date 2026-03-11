import { describe, it, expect } from "vitest";
import { toQboPurchaseOrder } from "@/lib/qbo/qbo-mapper";

describe("toQboPurchaseOrder", () => {
  const basePO = {
    poNumber: "PO-00001",
    notes: "Test purchase order",
    expectedDate: new Date("2026-04-01"),
    totalAmount: 1500.5,
  };

  const baseLines = [
    {
      description: "Widget A",
      quantity: 10,
      unitPrice: 100.0,
      amount: 1000.0,
      material: { name: "Widget A", qboItemId: "qbo-item-1" },
    },
    {
      description: "Custom part",
      quantity: 5,
      unitPrice: 100.1,
      amount: 500.5,
      material: null,
    },
  ];

  it("maps PO header fields correctly", () => {
    const result = toQboPurchaseOrder(basePO, baseLines, "qbo-vendor-1");
    expect(result.DocNumber).toBe("PO-00001");
    expect(result.VendorRef).toEqual({ value: "qbo-vendor-1" });
    expect(result.Memo).toBe("Test purchase order");
    expect(result.DueDate).toBe("2026-04-01");
  });

  it("maps line items with ItemBasedExpenseLineDetail", () => {
    const result = toQboPurchaseOrder(basePO, baseLines, "qbo-vendor-1");
    expect(result.Line).toHaveLength(2);
    expect(result.Line![0].DetailType).toBe("ItemBasedExpenseLineDetail");
    expect(result.Line![0].Amount).toBe(1000.0);
    expect(result.Line![0].Description).toBe("Widget A");
  });

  it("includes ItemRef when material has qboItemId", () => {
    const result = toQboPurchaseOrder(basePO, baseLines, "qbo-vendor-1");
    expect(result.Line![0].ItemBasedExpenseLineDetail?.ItemRef).toEqual({
      value: "qbo-item-1",
      name: "Widget A",
    });
  });

  it("uses fallback ItemRef when material is null", () => {
    const result = toQboPurchaseOrder(basePO, baseLines, "qbo-vendor-1");
    // When material is null, mapper uses { value: "", name: line.description }
    expect(result.Line![1].ItemBasedExpenseLineDetail?.ItemRef).toEqual({
      value: "",
      name: "Custom part",
    });
  });

  it("applies ClassRef when provided", () => {
    const result = toQboPurchaseOrder(basePO, baseLines, "qbo-vendor-1", {
      classRef: { value: "class-1", name: "Purchase" },
    });
    expect(result.ClassRef).toEqual({ value: "class-1", name: "Purchase" });
  });

  it("applies DepartmentRef when provided", () => {
    const result = toQboPurchaseOrder(basePO, baseLines, "qbo-vendor-1", {
      departmentRef: { value: "dept-1", name: "Site A" },
    });
    expect(result.DepartmentRef).toEqual({ value: "dept-1", name: "Site A" });
  });

  it("omits ClassRef and DepartmentRef when not provided", () => {
    const result = toQboPurchaseOrder(basePO, baseLines, "qbo-vendor-1");
    expect(result.ClassRef).toBeUndefined();
    expect(result.DepartmentRef).toBeUndefined();
  });

  it("rounds monetary values to 2 decimal places", () => {
    const lines = [
      {
        description: "Precision test",
        quantity: 3,
        unitPrice: 33.333,
        amount: 99.999,
        material: null,
      },
    ];
    const result = toQboPurchaseOrder(basePO, lines, "qbo-vendor-1");
    expect(result.Line![0].Amount).toBe(100.0);
    expect(result.Line![0].ItemBasedExpenseLineDetail?.UnitPrice).toBe(33.33);
  });

  it("handles PO with no notes or expectedDate", () => {
    const minimal = {
      poNumber: "PO-MIN",
      notes: null,
      expectedDate: null,
      totalAmount: null,
    };
    const result = toQboPurchaseOrder(minimal, baseLines, "qbo-vendor-1");
    expect(result.Memo).toBeUndefined();
    expect(result.DueDate).toBeUndefined();
  });

  it("sets sequential line Ids", () => {
    const result = toQboPurchaseOrder(basePO, baseLines, "qbo-vendor-1");
    expect(result.Line![0].Id).toBe("1");
    expect(result.Line![1].Id).toBe("2");
  });
});
