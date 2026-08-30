"use client";

import { useEffect, useCallback, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

// ============================================================================
// Types
// ============================================================================

interface ModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal content */
  children: ReactNode;
  /** Size variant - default is 'md' (28rem), 'lg' is 44rem, 'sm' is 20rem */
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional class name for the dialog container */
  className?: string;
  /** Whether clicking the backdrop closes the modal (default: true) */
  closeOnBackdropClick?: boolean;
  /** Whether pressing Escape closes the modal (default: true) */
  closeOnEscape?: boolean;
  /** ARIA label for the modal (required for accessibility) */
  "aria-labelledby"?: string;
  /** ARIA description for the modal */
  "aria-describedby"?: string;
}

interface ModalHeaderProps {
  children: ReactNode;
  /** Optional kicker text (small label above title) */
  kicker?: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Whether to show the close button (default: true) */
  showCloseButton?: boolean;
  /** Close handler - required if showCloseButton is true */
  onClose?: () => void;
  className?: string;
}

interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

// ============================================================================
// Size mappings
// ============================================================================

const sizeClasses = {
  sm: "max-w-sm", // 24rem
  md: "max-w-md", // 28rem (matches fin-modal-dialog)
  lg: "max-w-2xl", // 44rem (matches fin-detail-modal-dialog)
  xl: "max-w-4xl", // 56rem
} as const;

// ============================================================================
// Modal Component
// ============================================================================

/**
 * Reusable modal component with backdrop, escape key handling, and body scroll lock.
 *
 * @example
 * ```tsx
 * <Modal open={isOpen} onClose={() => setIsOpen(false)} aria-labelledby="modal-title">
 *   <ModalHeader onClose={() => setIsOpen(false)} kicker="Finance">
 *     <h2 id="modal-title">Modal Title</h2>
 *   </ModalHeader>
 *   <ModalBody>
 *     <p>Modal content here</p>
 *   </ModalBody>
 *   <ModalFooter>
 *     <Button onClick={() => setIsOpen(false)}>Close</Button>
 *   </ModalFooter>
 * </Modal>
 * ```
 */
export function Modal({
  open,
  onClose,
  children,
  size = "md",
  className,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  // Focus trap: focus the dialog when it opens
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [open]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdropClick, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={cn(
          "w-full max-h-[calc(100vh-2rem)] overflow-y-auto",
          "bg-[var(--card)] border border-[var(--border)] rounded-lg",
          "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]",
          "outline-none",
          sizeClasses[size],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Modal Header
// ============================================================================

export function ModalHeader({
  children,
  kicker,
  subtitle,
  showCloseButton = true,
  onClose,
  className,
}: ModalHeaderProps) {
  return (
    <div
      className={cn(
        "flex justify-between items-start gap-4 p-5 border-b border-[var(--border)]",
        className
      )}
    >
      <div>
        {kicker && (
          <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
            {kicker}
          </p>
        )}
        <div className="text-lg font-semibold text-[var(--foreground)]">
          {children}
        </div>
        {subtitle && (
          <p className="text-[0.8125rem] text-[var(--muted-foreground)] mt-1.5">
            {subtitle}
          </p>
        )}
      </div>
      {showCloseButton && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex items-center justify-center w-8 h-8 text-xl text-[var(--muted-foreground)] bg-transparent border-none rounded cursor-pointer shrink-0 transition-colors hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Modal Body
// ============================================================================

export function ModalBody({ children, className }: ModalBodyProps) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

// ============================================================================
// Modal Footer
// ============================================================================

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "flex justify-end gap-2 px-5 pb-5 pt-2",
        "border-t border-[var(--border)] mt-2",
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default Modal;
