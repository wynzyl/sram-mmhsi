"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import type { BaseFormState } from "@/lib/validators/common-schemas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type ConfirmActionButtonProps = {
  /** Server action to execute on confirmation */
  action: (prevState: BaseFormState, formData: FormData) => Promise<BaseFormState>;
  /** Confirmation message shown in dialog */
  confirmMessage: string;
  /** Hidden form fields to submit (e.g., { studentId: "123", reason: "test" }) */
  hiddenFields: Record<string, string>;
  /** Button label (default state) */
  label: string;
  /** Button label (loading state) */
  loadingLabel: string;
  /** Button variant (affects styling) */
  variant?: "danger" | "primary" | "secondary";
  /** Additional CSS classes */
  className?: string;
  /** Callback after successful action */
  onSuccess?: () => void;
  /** Optional title for the dialog (defaults to "Confirm Action") */
  dialogTitle?: string;
};

/**
 * Reusable confirmation button that executes a server action after user confirms.
 * Uses AlertDialog instead of browser confirm() for a polished UX.
 *
 * @example
 * ```tsx
 * <ConfirmActionButton
 *   action={deleteSubjectAction}
 *   confirmMessage="Are you sure you want to delete this subject?"
 *   hiddenFields={{ subjectId: subject.id }}
 *   label="Delete"
 *   loadingLabel="Deleting..."
 *   variant="danger"
 * />
 * ```
 */
export function ConfirmActionButton({
  action,
  confirmMessage,
  hiddenFields,
  label,
  loadingLabel,
  variant = "danger",
  className,
  onSuccess,
  dialogTitle = "Confirm Action",
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(action, {});
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state.success && onSuccess) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  const variantClasses = {
    danger: "text-destructive hover:text-destructive/80",
    primary: "text-primary hover:text-primary/80",
    secondary: "text-muted-foreground hover:text-foreground",
  };

  const buttonClassName = `${variantClasses[variant]} disabled:opacity-50 transition-colors font-medium ${className ?? ""}`.trim();

  const handleConfirm = () => {
    const formData = new FormData();
    Object.entries(hiddenFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    startTransition(() => {
      formAction(formData);
    });
    setOpen(false);
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={isPending}
            className={buttonClassName}
          >
            {isPending ? loadingLabel : label}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={variant === "danger" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.errors?._form && (
        <span className="mt-1 block text-xs text-destructive">
          {state.errors._form[0]}
        </span>
      )}
      {state.message && !state.success && (
        <span className="mt-1 block text-xs text-destructive">
          This item cannot be deleted!
        </span>
      )}
    </>
  );
}

/**
 * Inline confirm button variant (smaller, fits in table cells).
 *
 * @example
 * ```tsx
 * <InlineConfirmButton
 *   action={removeAssignmentAction}
 *   confirmMessage="Remove this teacher assignment?"
 *   hiddenFields={{ assignmentId: assignment.id }}
 *   label="Remove"
 *   loadingLabel="Removing..."
 *   variant="danger"
 * />
 * ```
 */
export function InlineConfirmButton(props: ConfirmActionButtonProps) {
  return (
    <ConfirmActionButton
      {...props}
      className={`text-xs ${props.className ?? ""}`}
    />
  );
}

/**
 * Full-width confirm button variant (for modals, forms).
 *
 * @example
 * ```tsx
 * <BlockConfirmButton
 *   action={deleteEnrollmentAction}
 *   confirmMessage="Are you sure you want to delete this enrollment?"
 *   hiddenFields={{ enrollmentId }}
 *   label="Delete Enrollment"
 *   loadingLabel="Deleting..."
 *   variant="danger"
 * />
 * ```
 */
export function BlockConfirmButton({
  action,
  confirmMessage,
  hiddenFields,
  label,
  loadingLabel,
  variant = "danger",
  className,
  onSuccess,
  dialogTitle = "Confirm Action",
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(action, {});
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state.success && onSuccess) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  const handleConfirm = () => {
    const formData = new FormData();
    Object.entries(hiddenFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    startTransition(() => {
      formAction(formData);
    });
    setOpen(false);
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant={variant}
            disabled={isPending}
            className={`w-full ${className ?? ""}`}
          >
            {isPending ? loadingLabel : label}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={variant === "danger" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.errors?._form && (
        <p className="mt-2 text-sm text-destructive">{state.errors._form[0]}</p>
      )}
      {state.message && !state.success && (
        <p className="mt-2 text-sm text-destructive">
          This item cannot be deleted!
        </p>
      )}
    </>
  );
}
