import { useState, useCallback } from "react";

/**
 * State and handlers for inline confirmation UI patterns.
 *
 * Use this hook when you need a confirm/cancel flow that appears inline
 * (e.g., in table cells) instead of a modal dialog.
 */
export interface UseInlineConfirmReturn {
  /** Whether the confirmation UI is currently visible */
  isConfirming: boolean;
  /** Current value of the optional input field */
  inputValue: string;
  /** Show the confirmation UI */
  showConfirm: () => void;
  /** Hide the confirmation UI (cancel) */
  hideConfirm: () => void;
  /** Update the input value */
  setInputValue: (value: string) => void;
  /** Reset all state (useful after successful action) */
  reset: () => void;
}

/**
 * Hook for managing inline confirmation state.
 *
 * @param initialValue - Optional initial value for the input field
 * @returns State and handlers for inline confirmation UI
 *
 * @example
 * ```tsx
 * function DeleteButton({ onDelete }: { onDelete: () => void }) {
 *   const confirm = useInlineConfirm();
 *
 *   if (!confirm.isConfirming) {
 *     return <button onClick={confirm.showConfirm}>Delete</button>;
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={() => { onDelete(); confirm.reset(); }}>
 *         Confirm
 *       </button>
 *       <button onClick={confirm.hideConfirm}>Cancel</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With input field (e.g., for reason/remarks)
 * ```tsx
 * function VoidButton({ onVoid }: { onVoid: (reason: string) => void }) {
 *   const confirm = useInlineConfirm();
 *
 *   if (!confirm.isConfirming) {
 *     return <button onClick={confirm.showConfirm}>Request Void</button>;
 *   }
 *
 *   return (
 *     <div>
 *       <input
 *         value={confirm.inputValue}
 *         onChange={(e) => confirm.setInputValue(e.target.value)}
 *         placeholder="Reason"
 *       />
 *       <button onClick={() => { onVoid(confirm.inputValue); confirm.reset(); }}>
 *         Submit
 *       </button>
 *       <button onClick={confirm.hideConfirm}>Cancel</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useInlineConfirm(initialValue = ""): UseInlineConfirmReturn {
  const [isConfirming, setIsConfirming] = useState(false);
  const [inputValue, setInputValue] = useState(initialValue);

  const showConfirm = useCallback(() => {
    setIsConfirming(true);
  }, []);

  const hideConfirm = useCallback(() => {
    setIsConfirming(false);
    setInputValue(initialValue);
  }, [initialValue]);

  const reset = useCallback(() => {
    setIsConfirming(false);
    setInputValue(initialValue);
  }, [initialValue]);

  return {
    isConfirming,
    inputValue,
    showConfirm,
    hideConfirm,
    setInputValue,
    reset,
  };
}
