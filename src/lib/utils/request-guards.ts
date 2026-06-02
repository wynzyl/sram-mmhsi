/**
 * Request validation guard utilities.
 *
 * These utilities consolidate common request validation patterns used across
 * action files (void requests, discount requests, cancellation requests).
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Minimal interface for a request with status field.
 * Covers void requests, discount requests, cancellation requests, etc.
 */
export interface RequestWithStatus {
  status: string;
}

/**
 * Interface for a request with status and requestedBy fields.
 */
export interface RequestWithRequester extends RequestWithStatus {
  requestedBy: string;
}

/**
 * Action type for error message formatting.
 */
export type RequestAction =
  | "approve"
  | "reject"
  | "cancel"
  | "withdraw"
  | "process";

// ─── Guard Functions ───────────────────────────────────────────────────────────

/**
 * Assert that a request is in pending status.
 *
 * Throws a descriptive error if the request is not pending.
 * Error message varies based on the action being attempted.
 *
 * @param request - The request to validate
 * @param action - The action being attempted (for error message)
 * @throws Error if request is not pending
 *
 * @example
 * ```typescript
 * const request = await lockVoidRequest(tx, requestId);
 * assertRequestIsPending(request, "approve");
 * // Continue with approval...
 * ```
 */
export function assertRequestIsPending<T extends RequestWithStatus>(
  request: T,
  action: RequestAction
): asserts request is T & { status: "pending" } {
  if (request.status !== "pending") {
    throw new Error(
      `Cannot ${action} a ${request.status} request. Only pending requests can be ${action}ed.`
    );
  }
}

/**
 * Validate that a request is pending without throwing.
 *
 * Returns an error message if validation fails, or null if valid.
 * Useful for server actions that need to return form state errors.
 *
 * @param request - The request to validate
 * @returns Error message or null
 *
 * @example
 * ```typescript
 * const error = validateRequestIsPending(request);
 * if (error) {
 *   return { message: error };
 * }
 * ```
 */
export function validateRequestIsPending<T extends RequestWithStatus>(
  request: T
): string | null {
  if (request.status !== "pending") {
    return `This request has already been ${request.status}.`;
  }
  return null;
}

/**
 * Assert that a user is not approving/rejecting their own request.
 *
 * Throws a descriptive error if the current user is the same as the requester.
 * Used to enforce separation of duties for request approval workflows.
 *
 * @param requestedBy - User ID who created the request
 * @param currentUserId - User ID attempting the action
 * @param action - The action being attempted (for error message)
 * @throws Error if same user
 *
 * @example
 * ```typescript
 * guardAgainstSelfAction(request.requestedBy, session.userId, "approve");
 * // Continue with approval...
 * ```
 */
export function guardAgainstSelfAction(
  requestedBy: string,
  currentUserId: string,
  action: RequestAction
): void {
  if (requestedBy === currentUserId) {
    const actionVerb = action === "approve" ? "approval" : `${action}ion`;
    const alternative =
      action === "reject"
        ? "Use the cancel/withdraw option instead, or have another administrator review it."
        : "Another administrator must handle this request.";
    throw new Error(`Self-${actionVerb} is not allowed. ${alternative}`);
  }
}

/**
 * Validate both pending status and self-action in one call.
 *
 * Convenience function that combines assertRequestIsPending and guardAgainstSelfAction.
 *
 * @param request - The request to validate
 * @param currentUserId - User ID attempting the action
 * @param action - The action being attempted
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * validateRequestForDecision(request, session.userId, "approve");
 * // Continue with decision...
 * ```
 */
export function validateRequestForDecision<T extends RequestWithRequester>(
  request: T,
  currentUserId: string,
  action: RequestAction
): void {
  assertRequestIsPending(request, action);
  guardAgainstSelfAction(request.requestedBy, currentUserId, action);
}
