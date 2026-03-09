import { describe, test } from "vitest";

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
});
