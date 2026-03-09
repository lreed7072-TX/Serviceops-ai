import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing anything that uses it
vi.mock("@/lib/prisma", () => ({
  prisma: {
    qboConnection: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    qboAccountMap: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create a mock connection object that matches QboConnection shape
const mockConnection = {
  id: "conn-1",
  orgId: "org-1",
  realmId: "123456789",
  accessToken: "valid-access-token",
  refreshToken: "valid-refresh-token",
  accessTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  refreshTokenExpiry: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
  isActive: true,
  companyName: "Test Company",
  connectedAt: new Date(),
  lastSyncAt: null,
  refreshInProgress: false,
  refreshLockedAt: null,
};

// Helper to create a mock fetch Response
function mockFetchResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("qbo-client", () => {
  describe("getValidAccessToken — FOUND-01 CAS mutex", () => {
    test.todo("returns cached token when not expired");
    test.todo("acquires CAS lock and refreshes when token expired");
    test.todo("waits and polls when another instance holds the lock");
    test.todo("clears stale lock after 30 seconds and retries");
    test.todo("clears lock on refresh failure");
  });

  describe("updateCustomer — FOUND-02 sparse update fix", () => {
    test.todo("spreads existing QBO entity before applying ServiceOps fields");
    test.todo("preserves unmanaged QBO fields (BillAddr, SalesTermRef, etc.)");
    test.todo("overrides only ServiceOps-managed fields");
  });

  describe("qboRequest — FOUND-04 minorversion", () => {
    test.todo("appends minorversion=75 to URLs without query params");
    test.todo("appends minorversion=75 to URLs with existing query params");
  });

  // ============================================
  // PHASE 2 — FOUND-10 CLIENT EXTENSIONS
  // ============================================

  describe("batchRequest — FOUND-10", () => {
    test("throws if operations array exceeds 30 items", async () => {
      const { batchRequest } = await import("@/lib/qbo/qbo-client");
      const ops = Array.from({ length: 31 }, (_, i) => ({
        bId: `bid-${i}`,
        operation: "create" as const,
        Customer: { DisplayName: `Customer ${i}` },
      }));

      await expect(batchRequest(mockConnection as any, ops)).rejects.toThrow(
        "QBO batch limit is 30 operations, received 31"
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("returns empty array for empty operations", async () => {
      const { batchRequest } = await import("@/lib/qbo/qbo-client");
      const result = await batchRequest(mockConnection as any, []);
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("sends single POST to batch endpoint with all operations", async () => {
      const { batchRequest } = await import("@/lib/qbo/qbo-client");

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          BatchItemResponse: [
            { bId: "bid-1", Customer: { Id: "100", DisplayName: "Acme" } },
            { bId: "bid-2", Customer: { Id: "101", DisplayName: "Globex" } },
          ],
        })
      );

      const ops = [
        { bId: "bid-1", operation: "create" as const, Customer: { DisplayName: "Acme" } },
        { bId: "bid-2", operation: "create" as const, Customer: { DisplayName: "Globex" } },
      ];

      const result = await batchRequest(mockConnection as any, ops);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, fetchOpts] = mockFetch.mock.calls[0];
      expect(url).toContain("/batch");
      expect(url).toContain("minorversion=75");
      expect(fetchOpts.method).toBe("POST");
      expect(result).toHaveLength(2);
      expect(result[0].bId).toBe("bid-1");
    });

    test("returns Fault items without throwing — per-op errors are not exceptions", async () => {
      const { batchRequest } = await import("@/lib/qbo/qbo-client");

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          BatchItemResponse: [
            { bId: "bid-1", Customer: { Id: "100" } },
            {
              bId: "bid-2",
              Fault: {
                Error: [{ Message: "Stale Object Error", code: "5010" }],
                type: "ValidationFault",
              },
            },
          ],
        })
      );

      const ops = [
        { bId: "bid-1", operation: "create" as const, Customer: { DisplayName: "Acme" } },
        { bId: "bid-2", operation: "update" as const, Customer: { Id: "99", SyncToken: "0" } },
      ];

      const result = await batchRequest(mockConnection as any, ops);
      expect(result).toHaveLength(2);
      expect(result[0].Fault).toBeUndefined();
      expect(result[1].Fault).toBeDefined();
      expect(result[1].Fault?.Error[0].Message).toBe("Stale Object Error");
    });
  });

  describe("queryEntities — FOUND-10", () => {
    test("URL-encodes the IQL string and extracts entity array", async () => {
      const { queryEntities } = await import("@/lib/qbo/qbo-client");

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          QueryResponse: {
            Account: [
              { Id: "1", Name: "Services", AccountType: "Income" },
              { Id: "2", Name: "Materials", AccountType: "Income" },
            ],
            startPosition: 1,
            maxResults: 2,
          },
        })
      );

      const result = await queryEntities(
        mockConnection as any,
        "SELECT * FROM Account WHERE Active = true",
        "Account"
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("query?query=");
      expect(url).toContain(encodeURIComponent("SELECT * FROM Account WHERE Active = true"));
      expect(url).toContain("minorversion=75");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ Id: "1", Name: "Services", AccountType: "Income" });
    });

    test("returns empty array when QueryResponse has no matching entity key", async () => {
      const { queryEntities } = await import("@/lib/qbo/qbo-client");

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          QueryResponse: { startPosition: 1, maxResults: 0 },
        })
      );

      const result = await queryEntities(
        mockConnection as any,
        "SELECT * FROM Account WHERE Active = true AND Name = 'Nonexistent'",
        "Account"
      );

      expect(result).toEqual([]);
    });
  });

  describe("cdcRequest — FOUND-10", () => {
    test("joins entities with comma and formats changedSince as ISO string", async () => {
      const { cdcRequest } = await import("@/lib/qbo/qbo-client");

      const mockCdcResponse = {
        CDCResponse: [
          {
            QueryResponse: [
              { Customer: [{ Id: "63" }], startPosition: 1, maxResults: 1 },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockCdcResponse));

      const since = new Date("2024-01-15T10:00:00.000Z");
      const result = await cdcRequest(
        mockConnection as any,
        ["Customer", "Invoice", "Payment"],
        since
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("cdc?entities=Customer,Invoice,Payment");
      expect(url).toContain("changedSince=");
      expect(url).toContain("minorversion=75");
      expect(result.CDCResponse).toBeDefined();
    });
  });

  describe("voidInvoice — FOUND-10", () => {
    test("POSTs to invoice?operation=void with Id and SyncToken only", async () => {
      const { voidInvoice } = await import("@/lib/qbo/qbo-client");

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          Invoice: { Id: "129", status: "Voided" },
        })
      );

      const result = await voidInvoice(mockConnection as any, "129", "3");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, fetchOpts] = mockFetch.mock.calls[0];
      expect(url).toContain("invoice?operation=void");
      expect(url).not.toContain("invoice/129"); // Not invoice/<id>
      expect(fetchOpts.method).toBe("POST");

      const body = JSON.parse(fetchOpts.body);
      expect(body).toEqual({ Id: "129", SyncToken: "3" });
      expect(Object.keys(body)).toHaveLength(2); // Only Id + SyncToken

      expect(result).toEqual({ Id: "129", status: "Voided" });
    });
  });

  describe("sendInvoiceEmail — FOUND-10", () => {
    test("POSTs to invoice/<id>/send with Content-Type: application/octet-stream", async () => {
      const { sendInvoiceEmail } = await import("@/lib/qbo/qbo-client");

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          Invoice: {
            Id: "42",
            SyncToken: "5",
            EmailStatus: "EmailSent",
            TotalAmt: 500,
            Balance: 500,
            CustomerRef: { value: "1" },
            Line: [],
          },
        })
      );

      const result = await sendInvoiceEmail(mockConnection as any, "42");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, fetchOpts] = mockFetch.mock.calls[0];
      expect(url).toContain("invoice/42/send");
      expect(url).not.toContain("sendTo=");
      expect(fetchOpts.headers["Content-Type"]).toBe("application/octet-stream");
      expect(result.EmailStatus).toBe("EmailSent");
    });

    test("appends sendTo query param when email override provided", async () => {
      const { sendInvoiceEmail } = await import("@/lib/qbo/qbo-client");

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          Invoice: {
            Id: "42",
            SyncToken: "5",
            EmailStatus: "EmailSent",
            TotalAmt: 500,
            Balance: 500,
            CustomerRef: { value: "1" },
            Line: [],
          },
        })
      );

      await sendInvoiceEmail(mockConnection as any, "42", "custom@example.com");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("invoice/42/send");
      expect(url).toContain("sendTo=custom%40example.com");
    });
  });
});
