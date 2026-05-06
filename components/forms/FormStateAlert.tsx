import type { BaseFormState } from "@/lib/validators/common-schemas";

/**
 * Standardized alert component for displaying form state messages.
 * Replaces 20+ manual alert blocks across all forms.
 *
 * @param state - Form state object with message, errors, and success flag
 */
export function FormStateAlert<T>({ state }: { state: BaseFormState<T> }) {
  // Form-level errors (_form key)
  const formErrors = state.errors?._form;

  // Success message
  if (state.success && state.message) {
    return (
      <div
        className="rounded-md bg-green-50 border border-green-200 p-4 mb-4"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm font-medium text-green-800">{state.message}</p>
        </div>
      </div>
    );
  }

  // Error messages
  const hasErrors = formErrors || state.message;
  if (!hasErrors) return null;

  return (
    <div
      className="rounded-md bg-red-50 border border-red-200 p-4 mb-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          {state.message && (
            <p className="text-sm font-medium text-red-800">{state.message}</p>
          )}
          {formErrors && (
            <p className="text-sm font-medium text-red-800">
              {formErrors.join(" ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Variant for custom alert styles (e.g., cashier-specific layouts).
 * Allows custom className while preserving structure.
 *
 * @param state - Form state object
 * @param className - Custom CSS classes to apply
 */
export function FormStateAlertCustom<T>({
  state,
  className,
}: {
  state: BaseFormState<T>;
  className?: string;
}) {
  const formErrors = state.errors?._form;
  const hasErrors = formErrors || state.message;

  if (!hasErrors && !state.success) return null;

  return (
    <div className={className} role={state.success ? "status" : "alert"}>
      {state.message && <p>{state.message}</p>}
      {formErrors && <p>{formErrors.join(" ")}</p>}
    </div>
  );
}
