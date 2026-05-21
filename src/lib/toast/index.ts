/**
 * Toast notification utilities
 *
 * Wrapper functions for Sonner toast library providing consistent API
 * for success, error, warning, and info notifications across the app.
 */
import { toast } from "sonner";

/**
 * Show a success toast notification
 */
export const showSuccess = (message: string) => toast.success(message);

/**
 * Show an error toast notification
 */
export const showError = (message: string) => toast.error(message);

/**
 * Show a warning toast notification
 */
export const showWarning = (message: string) => toast.warning(message);

/**
 * Show an info toast notification
 */
export const showInfo = (message: string) => toast.info(message);

/**
 * Show a loading toast that can be updated
 * @returns toast id for updating/dismissing
 */
export const showLoading = (message: string) => toast.loading(message);

/**
 * Dismiss a specific toast or all toasts
 * @param toastId - Optional toast id to dismiss specific toast
 */
export const dismissToast = (toastId?: string | number) => toast.dismiss(toastId);

/**
 * Show a promise-based toast that updates based on promise state
 */
export const showPromise = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  }
) => toast.promise(promise, messages);
