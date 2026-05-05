"use client";

import { useActionState, type MouseEvent } from "react";
import type { BaseFormState } from "@/lib/validators/common-schemas";

export type ConfirmActionButtonProps = {
  /** Server action to execute on confirmation */
  action: (prevState: BaseFormState, formData: FormData) => Promise<BaseFormState>;
  /** Confirmation message shown in confirm dialog */
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
};

/**
 * Reusable confirmation button that executes a server action after user confirms.
 * Consolidates the pattern used in DeleteSubjectButton, LockGradesButton, RemoveAssignmentButton.
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
}: ConfirmActionButtonProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!confirm(confirmMessage)) {
      e.preventDefault();
    }
  };

  // Call onSuccess callback if action succeeded
  if (state.success && onSuccess) {
    onSuccess();
  }

  const variantClasses = {
    danger: "text-red-600 hover:text-red-900",
    primary: "text-indigo-600 hover:text-indigo-900",
    secondary: "text-gray-600 hover:text-gray-900",
  };

  const buttonClassName = `${variantClasses[variant]} disabled:opacity-50 transition-colors ${className ?? ""}`.trim();

  return (
    <form action={formAction} className="inline">
      {Object.entries(hiddenFields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <button
        type="submit"
        disabled={isPending}
        className={buttonClassName}
        onClick={handleClick}
      >
        {isPending ? loadingLabel : label}
      </button>
      {state.errors?._form && (
        <span className="text-red-600 text-xs block mt-1">{state.errors._form[0]}</span>
      )}
    </form>
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
}: ConfirmActionButtonProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!confirm(confirmMessage)) {
      e.preventDefault();
    }
  };

  if (state.success && onSuccess) {
    onSuccess();
  }

  const variantClasses = {
    danger: "bg-red-600 hover:bg-red-700 text-white",
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white",
    secondary: "bg-gray-600 hover:bg-gray-700 text-white",
  };

  const buttonClassName = `w-full py-2 px-4 rounded-md font-medium disabled:opacity-50 transition-colors ${variantClasses[variant]} ${className ?? ""}`.trim();

  return (
    <form action={formAction}>
      {Object.entries(hiddenFields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <button
        type="submit"
        disabled={isPending}
        className={buttonClassName}
        onClick={handleClick}
      >
        {isPending ? loadingLabel : label}
      </button>
      {state.errors?._form && (
        <p className="text-red-600 text-sm mt-2">{state.errors._form[0]}</p>
      )}
    </form>
  );
}
