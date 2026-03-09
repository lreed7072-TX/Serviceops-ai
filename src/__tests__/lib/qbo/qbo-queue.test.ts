import { describe, test } from "vitest";

describe("qbo-queue", () => {
  describe("enqueue — FOUND-09", () => {
    test.todo("creates a QboSyncJob with status=pending");
    test.todo("sets default priority=5 and maxAttempts=3");
  });

  describe("claimBatch — FOUND-09", () => {
    test.todo("claims pending jobs in priority then FIFO order");
    test.todo("uses FOR UPDATE SKIP LOCKED for atomic claiming");
  });

  describe("complete — FOUND-09", () => {
    test.todo("sets status=completed and clears lock fields");
  });

  describe("fail — FOUND-09", () => {
    test.todo("increments attempts and resets to pending for retry");
    test.todo("promotes to dead_letter when attempts >= maxAttempts");
  });

  describe("resetStaleLocks — FOUND-09", () => {
    test.todo("resets claimed jobs older than STALE_LOCK_SECONDS");
  });

  describe("getDeadLetters — FOUND-09", () => {
    test.todo("returns dead_letter jobs for org ordered by createdAt desc");
  });

  describe("requeueDeadLetter — FOUND-09", () => {
    test.todo("resets dead_letter job to pending with attempts=0");
  });
});
