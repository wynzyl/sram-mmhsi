import { z } from "zod";
import type { BaseFormState } from "@/lib/validators/common-schemas";

// ─── Create Portal Account ─────────────────────────────────────────────────────

export const createPortalAccountSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
});

export type CreatePortalAccountInput = z.infer<typeof createPortalAccountSchema>;
export type CreatePortalAccountFormState = BaseFormState<CreatePortalAccountInput> & {
  accountId?: string;
  /** Plaintext password for display (only shown on creation) */
  initialPassword?: string;
};

// ─── Reset Portal Password ─────────────────────────────────────────────────────

export const resetPortalPasswordSchema = z.object({
  portalAccountId: z.string().uuid("Invalid portal account ID"),
});

export type ResetPortalPasswordInput = z.infer<typeof resetPortalPasswordSchema>;
export type ResetPortalPasswordFormState = BaseFormState<ResetPortalPasswordInput> & {
  /** Plaintext password for display (only shown after reset) */
  newPassword?: string;
};

// ─── Toggle Portal Account Status ───────────────────────────────────────────────

export const togglePortalAccountStatusSchema = z.object({
  portalAccountId: z.string().uuid("Invalid portal account ID"),
  isActive: z.boolean(),
});

export type TogglePortalAccountStatusInput = z.infer<typeof togglePortalAccountStatusSchema>;
export type TogglePortalAccountStatusFormState = BaseFormState<TogglePortalAccountStatusInput>;

// ─── Change Portal Password ─────────────────────────────────────────────────────

/**
 * Schema for portal users changing their own password.
 * Used during forced password change flow after first login.
 */
export const changePortalPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePortalPasswordInput = z.infer<typeof changePortalPasswordSchema>;
export type ChangePortalPasswordFormState = BaseFormState<ChangePortalPasswordInput>;

// ─── Portal Account Info ─────────────────────────────────────────────────────────

/** Portal account info for display on student detail page */
export type PortalAccountInfo = {
  id: string;
  username: string;
  email: string | null;
  isActive: boolean;
  forcePasswordChange: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};
