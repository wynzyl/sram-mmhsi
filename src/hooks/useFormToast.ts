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
 *   onSuccess: () => router.push(`/staff/students/${state.studentId}`)
 * });
 * ```
 */
export function useFormToast<T extends BaseFormState>(
  state: T,
  options?: UseFormToastOptions
) {
  // Track previous state to prevent duplicate toasts
  const prevStateRef = useRef<T | null>(null);

  useEffect(() => {
    // Skip if state hasn't changed (reference equality check)
    if (prevStateRef.current === state) {
      return;
    }

    // Skip empty initial state
    if (!state.success && !state.message && !state.errors) {
      prevStateRef.current = state;
      return;
    }

    // Success case
    if (state.success) {
      const message = options?.successMessage || state.message;
      if (message) {
        showSuccess(message);
      }
      options?.onSuccess?.();
    }
    // Error case: explicit message without success
    else if (state.message && !state.success) {
      const message = options?.errorMessage || state.message;
      showError(message);
      options?.onError?.();
    }
    // Error case: form-level errors (not field-level)
    else if (state.errors?._form) {
      const formErrors = state.errors._form;
      if (Array.isArray(formErrors) && formErrors.length > 0) {
        const message = options?.errorMessage || formErrors.join(" ");
        showError(message);
        options?.onError?.();
      }
    }

    prevStateRef.current = state;
  }, [state, options]);
}
