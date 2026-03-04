import { z, ZodSchema } from "zod";
import { NextRequest } from "next/server";

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns the typed data or throws a structured error.
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const messages = result.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`
    );
    throw new ValidationError("Validation failed", messages);
  }

  return result.data;
}

export class ValidationError extends Error {
  public readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
  }

  toResponse() {
    return Response.json(
      { error: this.message, issues: this.issues },
      { status: 400 }
    );
  }
}

// ── Common schemas ──────────────────────────────────────────────

export const emailSchema = z.string().email().max(320);

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchSchema = z.object({
  q: z.string().max(200).optional(),
  ...paginationSchema.shape,
});
