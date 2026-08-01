"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody } from "./Modal";
import { Button } from "@/components/ui/button";
import { useFormToast } from "@/hooks/useFormToast";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Base form state shape that all action states must extend
 */
interface BaseFormState {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

interface FormDialogProps<TState extends BaseFormState> {
  /**
   * Whether the dialog is open
   */
  open: boolean;
  /**
   * Callback when dialog should close
   */
  onClose: () => void;
  /**
   * Dialog title
   */
  title: string;
  /**
   * Optional kicker text (small label above title, e.g., "Finance · Discounts")
   */
  kicker?: string;
  /**
   * Optional subtitle/description below the title
   */
  subtitle?: string;
  /**
   * Server action to call on form submission
   */
  action: (prevState: Awaited<TState>, formData: FormData) => TState | Promise<TState>;
  /**
   * Initial state for the action
   */
  initialState: Awaited<TState>;
  /**
   * Success message to show in toast on successful submission
   */
  successMessage: string;
  /**
   * Optional callback after successful submission (called before onClose)
   */
  onSuccess?: () => void;
  /**
   * Whether to refresh the page after successful submission
   * @default false
   */
  refreshOnSuccess?: boolean;
  /**
   * Render function for form content. Receives current state and pending status.
   */
  children: (state: TState, isPending: boolean) => React.ReactNode;
  /**
   * Submit button label
   * @default "Submit"
   */
  submitLabel?: string;
  /**
   * Submit button label while pending
   * @default "Submitting..."
   */
  pendingLabel?: string;
  /**
   * Cancel button label
   * @default "Cancel"
   */
  cancelLabel?: string;
  /**
   * Modal size variant
   * @default "md"
   */
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * Optional ARIA label ID for accessibility
   */
  ariaLabelId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Generic form dialog component that handles:
 * - Modal wrapper with consistent styling
 * - Form with useActionState integration
 * - Toast notifications on success/error via useFormToast
 * - Standard cancel/submit button layout
 * - Optional page refresh after success
 *
 * @example
 * ```tsx
 * <FormDialog
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Create Item"
 *   kicker="Inventory"
 *   action={createItemAction}
 *   initialState={{}}
 *   successMessage="Item created successfully"
 *   submitLabel="Create"
 *   pendingLabel="Creating..."
 * >
 *   {(state, isPending) => (
 *     <>
 *       <input type="hidden" name="someId" value={id} />
 *       <TextInputField
 *         label="Name"
 *         name="name"
 *         required
 *         error={state.errors?.name}
 *       />
 *     </>
 *   )}
 * </FormDialog>
 * ```
 */
export function FormDialog<TState extends BaseFormState>({
  open,
  onClose,
  title,
  kicker,
  subtitle,
  action,
  initialState,
  successMessage,
  onSuccess,
  refreshOnSuccess = false,
  children,
  submitLabel = "Submit",
  pendingLabel = "Submitting...",
  cancelLabel = "Cancel",
  size = "md",
  ariaLabelId,
}: FormDialogProps<TState>) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [state, formAction, isPending] = useActionState(action, initialState);

  // Handle toast and success callback
  useFormToast(state, {
    successMessage,
    onSuccess: () => {
      onSuccess?.();
      onClose();
      if (refreshOnSuccess) {
        startTransition(() => {
          router.refresh();
        });
      }
    },
  });

  const labelId = ariaLabelId ?? `form-dialog-title-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={size}
      aria-labelledby={labelId}
    >
      <ModalHeader onClose={onClose} kicker={kicker} subtitle={subtitle}>
        <h2 id={labelId}>{title}</h2>
      </ModalHeader>

      <ModalBody>
        <form action={formAction} className="space-y-4">
          {children(state, isPending)}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
            >
              {cancelLabel}
            </Button>
            <Button type="submit" variant="primary" loading={isPending}>
              {isPending ? pendingLabel : submitLabel}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}

// ─── Convenience Types ────────────────────────────────────────────────────────

/**
 * Helper type for form state with field errors
 */
export type FormDialogState<TFieldErrors = Record<string, string[]>> = {
  success?: boolean;
  message?: string;
  errors?: TFieldErrors;
};
