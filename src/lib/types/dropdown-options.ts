/**
 * Shared Dropdown Option Types
 *
 * Generic types for select/dropdown components to avoid duplication
 * across feature schemas.
 */

/**
 * Generic dropdown option for select components.
 * Use this for simple value/label pairs in dropdowns.
 *
 * @example
 * const options: SelectOption[] = [
 *   { value: "uuid-1", label: "Option A" },
 *   { value: "uuid-2", label: "Option B" },
 * ];
 */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Teacher/staff option for assignment dropdowns.
 * Extends SelectOption with additional context.
 */
export interface StaffSelectOption extends SelectOption {
  /** Optional email for display or search */
  email?: string;
  /** Optional role for filtering */
  role?: string;
}
