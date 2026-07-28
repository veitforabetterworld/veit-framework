/**
 * Client-facing API errors with an explicit HTTP status.
 * Routes must map status via `instanceof HttpError` — never by parsing message text.
 */
export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}

export function badRequest(message: string, options?: { cause?: unknown }): HttpError {
  return new HttpError(400, message, options);
}

export function forbidden(message: string, options?: { cause?: unknown }): HttpError {
  return new HttpError(403, message, options);
}

export function notFound(message: string, options?: { cause?: unknown }): HttpError {
  return new HttpError(404, message, options);
}

export function conflict(message: string, options?: { cause?: unknown }): HttpError {
  return new HttpError(409, message, options);
}

export function tooManyRequests(message: string, options?: { cause?: unknown }): HttpError {
  return new HttpError(429, message, options);
}

export function internalError(message: string, options?: { cause?: unknown }): HttpError {
  return new HttpError(500, message, options);
}

/** Resolve HTTP status + client message from a thrown value. */
export function toRouteError(
  err: unknown,
  fallbackMessage: string,
): { status: number; message: string } {
  if (err instanceof HttpError) {
    return { status: err.statusCode, message: err.message };
  }
  return { status: 500, message: fallbackMessage };
}
