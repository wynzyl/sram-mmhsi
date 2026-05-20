import { z } from "zod";
import type { BaseFormState } from "@/lib/validators/common-schemas";

export const LoginSchema = z.object({
  username: z
    .string({ error: "Username or email is required." })
    .min(1, { error: "Username or email is required." })
    .trim()
    // Must match createUser / DB: usernames and emails are stored lowercased
    .toLowerCase(),
  password: z
    .string({ error: "Password is required." })
    .min(1, { error: "Password is required." }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export type LoginFormState = BaseFormState<LoginInput> | undefined;

// ─── Change Password Schema ─────────────────────────────────────────────────

export const ChangePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Current password is required." })
      .min(1, { error: "Current password is required." }),
    newPassword: z
      .string({ error: "New password is required." })
      .min(8, { error: "Password must be at least 8 characters." })
      .regex(/[A-Z]/, { error: "Password must contain at least one uppercase letter." })
      .regex(/[a-z]/, { error: "Password must contain at least one lowercase letter." })
      .regex(/[0-9]/, { error: "Password must contain at least one number." }),
    confirmPassword: z
      .string({ error: "Please confirm your new password." })
      .min(1, { error: "Please confirm your new password." }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password.",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export type ChangePasswordFormState = BaseFormState<ChangePasswordInput> | undefined;
