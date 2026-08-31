"use client";

import { useEffect, useRef } from "react";
import { showSuccess, showError } from "@/lib/toast";
import type { BaseFormState } from "@/lib/validators/common-schemas";

type UseFormToastOptions = {
  /** Custom success message (overrides state.message) */
  successMessage?: string;
  /** Callback to run after showing success toast */
  onSuccess?: () => void;
  /** Custom error message (overrides state.message) */
  errorMessage?: string;
  /** Callback to run after showing error toast */
  onError?: () => void;
};

/**
 * Hook that automatically shows toast notifications based on form state changes.
 *
 * Shows success toast when state.success is true.
 * Shows error toast when state.message exists without success, or when state.errors._form exists.
 *
 * Field-level errors (state.errors.fieldName) are NOT shown as toasts - they should
 * remain inline below form fields for better UX.
 *
 * @example
 * ```tsx
 * const [state, action, isPending] = useActionState(createStudent, {});
 *
 * useFormToast(state, {
 *   successMessage: "Student created successfully",
 *   onSuccess: () => router.push(`/staff/students/${state.studentRef}`)
 * });
 * ```
 */
export function useFormToast<T extends BaseFormState>(
  state: T,
  options?: UseFormToastOptions
) {
  // Track the last processed state values to avoid duplicate toasts
  const lastStateRef = useRef<{
    success?: boolean;
    message?: string;
    formErrors: string | null;
  } | null>(null);

  // Store callbacks in refs to avoid re-running effect when they change
  // Using useRef with initializer - callbacks are read inside useEffect only
  const callbacksRef = useRef(options);

  // Update ref in an effect to comply with React rules (no ref writes during render)
  useEffect(() => {
    callbacksRef.current = options;
  });

  // Stringify form-level errors so we have a stable primitive for the effect's
  // dependency array — object references on state.errors change every render.
  const currentFormErrors = state.errors?._form
    ? JSON.stringify(state.errors._form)
    : null;

  useEffect(() => {
    const lastState = lastStateRef.current;

    // Determine if anything actually changed
    const isNewState =
      lastState === null ||
      lastState.success !== state.success ||
      lastState.message !== state.message ||
      lastState.formErrors !== currentFormErrors;

    if (!isNewState) {
      return;
    }

    // Skip empty initial state
    if (!state.success && !state.message && !state.errors) {
      lastStateRef.current = {
        success: state.success,
        message: state.message,
        formErrors: currentFormErrors,
      };
      return;
    }

    const opts = callbacksRef.current;

    // Success case
    if (state.success) {
      const message = opts?.successMessage || state.message;
      if (message) {
        showSuccess(message);
      }
      opts?.onSuccess?.();
    }
    // Error case: explicit message without success
    else if (state.message && !state.success) {
      const message = opts?.errorMessage || state.message;
      showError(message);
      opts?.onError?.();
    }
    // Error case: form-level errors (not field-level)
    else if (state.errors?._form) {
      const formErrors = state.errors._form;
      if (Array.isArray(formErrors) && formErrors.length > 0) {
        const message = opts?.errorMessage || formErrors.join(" ");
        showError(message);
        opts?.onError?.();
      }
    }

    lastStateRef.current = {
      success: state.success,
      message: state.message,
      formErrors: currentFormErrors,
    };
  // state.errors (the object) is intentionally excluded — it would change reference
  // every render. We track form-level error changes via the stringified
  // currentFormErrors primitive instead. The early-return read of state.errors is
  // covered transitively (it only matters when other tracked deps are also empty).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.message, currentFormErrors]);
}
