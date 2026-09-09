// Shared server-side helpers so every API route reports errors the same
// way, and validates its body the same way, instead of each route.ts
// re-inventing its own try/catch + shape.

import { NextResponse } from "next/server";
import type { ZodError, ZodSchema } from "zod";

export interface ApiErrorBody {
  error: string;
  issues?: { path: string; message: string }[];
}

export function apiError(message: string, status: number, zodError?: ZodError): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { error: message };
  if (zodError) {
    body.issues = zodError.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  }
  return NextResponse.json(body, { status });
}

/** Logs the underlying error server-side and returns a generic 500 to the client. */
export function apiInternalError(context: string, err: unknown): NextResponse<ApiErrorBody> {
  console.error(`${context} failed:`, err);
  return apiError("Something went wrong on our end. Please try again.", 500);
}

export type ParsedBody<T> = { data: T; error?: undefined } | { data?: undefined; error: NextResponse<ApiErrorBody> };

/**
 * Reads a request body as JSON and validates it against a zod schema in one
 * step. Callers do `const parsed = await parseJsonBody(request, schema); if
 * (parsed.error) return parsed.error;` and get a fully-typed `parsed.data`
 * afterwards — the JSON.parse failure, the "wrong shape" failure, and the
 * "right shape but violates a rule" failure (e.g. a negative amount) all
 * collapse into the same 400 response shape.
 */
export async function parseJsonBody<T>(request: Request, schema: ZodSchema<T>): Promise<ParsedBody<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { error: apiError("Invalid JSON body.", 400) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const firstMessage = result.error.issues[0]?.message ?? "Invalid request body.";
    return { error: apiError(firstMessage, 400, result.error) };
  }
  return { data: result.data };
}
