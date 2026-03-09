import { describe, test } from "vitest";

describe("qbo-mapper", () => {
  describe("roundQboAmount — FOUND-03", () => {
    test.todo("rounds Prisma Decimal to 2 decimal places");
    test.todo("rounds plain number to 2 decimal places");
    test.todo("rounds string number to 2 decimal places");
    test.todo("handles edge cases: 0, negative, very small values");
  });

  describe("toQboCustomer — FOUND-08", () => {
    test.todo("builds create payload without existingQbo");
    test.todo("merges into existingQbo preserving unmanaged fields");
    test.todo("overrides email and phone when provided");
  });

  describe("fromQboCustomer — FOUND-08", () => {
    test.todo("extracts ServiceOps fields from QBO Customer");
    test.todo("returns null for missing optional fields");
  });

  describe("toQboInvoice — FOUND-08", () => {
    test.todo("maps invoice with line items using roundQboAmount");
    test.todo("includes CustomerRef");
  });

  describe("toQboEstimate — FOUND-08", () => {
    test.todo("maps quote to QBO Estimate with line items");
  });
});
