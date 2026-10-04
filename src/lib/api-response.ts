/**
 * JSON response envelope for the `/api/v1` routes (TRD section 35.6).
 *
 * Every response uses one shape, so a client can parse any endpoint the same way:
 *
 *   success  { "data": {...}, "error": null }
 *   failure  { "data": null, "error": { "code", "message", "fields"? } }
 *
 * Two rules this module exists to enforce:
 *
 * 1. An unexpected exception still produces this envelope. `apiHandler` catches
 *    everything, so a bug returns `INTERNAL` with a generic message instead of an
 *    HTML error page or a stack trace. Internal detail goes to the server log.
 * 2. Nothing secret reaches the client. Messages here are written to be shown to a
 *    user as-is, so they never interpolate a driver error or a query.
 */

import { ZodError } from "zod";

export const API_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Status is derived from the code so the two can never drift apart. */
const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export type ApiErrorBody = {
  code: ApiErrorCode;
  message: string;
  /** Per-field messages. Only present for VALIDATION_ERROR. */
  fields?: Record<string, string>;
};

/**
 * An error that is safe to return to the client.
 *
 * Anything thrown that is NOT an ApiError is treated as a bug: logged in full,
 * reported to the client as a bare INTERNAL.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = STATUS_BY_CODE[code];
  }
}

/** Shorthand for the two errors a route raises most often. */
export const unauthenticated = () =>
  new ApiError("UNAUTHENTICATED", "Sign in to continue.");

export const notFound = (message = "Not found.") =>
  new ApiError("NOT_FOUND", message);

export function ok(data: unknown, init?: ResponseInit): Response {
  return Response.json({ data, error: null }, init);
}

export function fail(error: ApiError): Response {
  const body: ApiErrorBody = { code: error.code, message: error.message };

  if (error.fields && Object.keys(error.fields).length > 0) {
    body.fields = error.fields;
  }

  return Response.json({ data: null, error: body }, { status: error.status });
}

/** Flattens a ZodError into `{ "items.0.quantity": "..." }` form. */
function fieldsFromZod(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    // A bare top-level issue has an empty path; give it a usable key.
    fields[path === "" ? "_" : path] = issue.message;
  }

  return fields;
}

/**
 * Wraps a route handler so every path returns the envelope.
 *
 * A handler returns a Response it built with `ok`/`fail`, or throws. Anything
 * thrown becomes a typed error response. This is what stops a stack trace or an
 * HTML error page from ever reaching an API client.
 *
 * The second argument is forwarded untouched, so the wrapper stays transparent to
 * whatever Next passes a route: a dynamic segment's `params`, for instance. Routes
 * that need nothing simply omit it.
 */
export function apiHandler<Context = unknown>(
  handler: (request: Request, context: Context) => Promise<Response>,
): (request: Request, context: Context) => Promise<Response> {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return fail(error);
      }

      if (error instanceof ZodError) {
        return fail(
          new ApiError(
            "VALIDATION_ERROR",
            "Some of the details you entered are not valid.",
            fieldsFromZod(error),
          ),
        );
      }

      // A genuine bug. Log it here, where the stack trace is still available, and
      // tell the client nothing about the internals.
      console.error("[api] unhandled error", error);

      return fail(
        new ApiError(
          "INTERNAL",
          "Something went wrong on our side. Please try again.",
        ),
      );
    }
  };
}

/** Parses a JSON body, rejecting a malformed one as a validation error. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Expected a JSON request body.");
  }
}
