import { z } from "zod";
import { ROLES } from "@/lib/constants/roles";
import type { BaseFormState } from "./common-schemas";

// ─── Helper Schemas ──────────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
  .regex(/[0-9]/, "Password must contain at least one number.");

// ─── Create User Schema ──────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required.")
    .email("Invalid email format.")
    .trim()
    .toLowerCase(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(50, "Username cannot exceed 50 characters.")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, hyphens, and underscores."
    )
    .trim()
    .toLowerCase(),
  password: passwordSchema,
  role: z.enum(
    [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN,
      ROLES.REGISTRAR,
      ROLES.FINANCE_OFFICER,
      ROLES.CASHIER,
      ROLES.TEACHER,
      ROLES.STUDENT,
      ROLES.PARENT_GUARDIAN,
    ] as const,
    { message: "Role is required." }
  ),
  forcePasswordChange: z.boolean().default(true),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export type CreateUserFormState = BaseFormState<CreateUserInput> & {
  userId?: string;
};

// ─── Update User Schema ──────────────────────────────────────────────────────

export const UpdateUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID."),
  email: z
    .string()
    .min(1, "Email is required.")
    .email("Invalid email format.")
    .trim()
    .toLowerCase(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(50, "Username cannot exceed 50 characters.")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, hyphens, and underscores."
    )
    .trim()
    .toLowerCase(),
  role: z.enum(
    [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN,
      ROLES.REGISTRAR,
      ROLES.FINANCE_OFFICER,
      ROLES.CASHIER,
      ROLES.TEACHER,
      ROLES.STUDENT,
      ROLES.PARENT_GUARDIAN,
    ] as const,
    { message: "Role is required." }
  ),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export type UpdateUserFormState = BaseFormState<UpdateUserInput>;

// ─── Reset Password Schema ───────────────────────────────────────────────────

export const ResetPasswordSchema = z.object({
  userId: z.string().uuid("Invalid user ID."),
  newPassword: passwordSchema,
  forcePasswordChange: z.boolean().default(true),
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export type ResetPasswordFormState = BaseFormState<ResetPasswordInput>;

// ─── Toggle User Status Schema ───────────────────────────────────────────────

export const ToggleUserStatusSchema = z.object({
  userId: z.string().uuid("Invalid user ID."),
  isActive: z.boolean(),
});

export type ToggleUserStatusInput = z.infer<typeof ToggleUserStatusSchema>;

export type ToggleUserStatusFormState = BaseFormState<ToggleUserStatusInput>;
