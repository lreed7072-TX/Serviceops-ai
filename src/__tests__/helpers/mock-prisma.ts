import { vi } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * Get the mocked prisma instance for configuring return values.
 * Usage:
 *   const mockPrisma = getMockPrisma();
 *   vi.mocked(mockPrisma.workOrder.findMany).mockResolvedValue([...]);
 */
export function getMockPrisma() {
  return vi.mocked(prisma, true);
}

/**
 * Reset all mock implementations on prisma.
 */
export function resetPrismaMocks() {
  const mock = getMockPrisma();
  for (const model of Object.values(mock)) {
    if (typeof model === "object" && model !== null) {
      for (const method of Object.values(model)) {
        if (typeof method === "function" && "mockReset" in method) {
          (method as ReturnType<typeof vi.fn>).mockReset();
        }
      }
    }
  }
}
