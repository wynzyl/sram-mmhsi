/**
 * Client-side error reporting utility.
 * This module can be used in client components (error boundaries).
 *
 * Note: This uses console logging by default. For production,
 * you would replace this with a client-side monitoring SDK
 * like Sentry Browser SDK.
 */

/**
 * Report an error from a client component.
 * Safe to use in "use client" components.
 *
 * @param error - Error object
 * @param context - Additional context
 */
export function reportClientError(
  error: Error & { digest?: string },
  context: {
    source: "global" | "admin" | "staff" | "portal";
    pathname?: string;
  }
): void {
  // In production, this would integrate with a client-side monitoring SDK
  // For now, we log with structured data that could be picked up by log aggregators

  const errorData = {
    source: `[${context.source.toUpperCase()}Error]`,
    message: error.message,
    digest: error.digest,
    pathname: context.pathname ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };

  console.error(errorData.source, errorData);

  // If a global error handler is set (e.g., Sentry), it would be called here
  if (typeof window !== "undefined" && (window as unknown as { __SRAMS_ERROR_HANDLER__?: (error: Error, data: typeof errorData) => void }).__SRAMS_ERROR_HANDLER__) {
    (window as unknown as { __SRAMS_ERROR_HANDLER__: (error: Error, data: typeof errorData) => void }).__SRAMS_ERROR_HANDLER__(error, errorData);
  }
}

/**
 * Set up a global error handler for client-side errors.
 * Call this during app initialization to integrate with external monitoring.
 *
 * @param handler - Error handler function
 *
 * @example
 * ```typescript
 * // In app initialization:
 * import * as Sentry from "@sentry/nextjs";
 *
 * setGlobalErrorHandler((error, data) => {
 *   Sentry.captureException(error, {
 *     tags: { source: data.source },
 *     extra: data,
 *   });
 * });
 * ```
 */
export function setGlobalErrorHandler(
  handler: (error: Error, data: { source: string; message: string; digest?: string; pathname?: string }) => void
): void {
  if (typeof window !== "undefined") {
    (window as unknown as { __SRAMS_ERROR_HANDLER__: typeof handler }).__SRAMS_ERROR_HANDLER__ = handler;
  }
}
