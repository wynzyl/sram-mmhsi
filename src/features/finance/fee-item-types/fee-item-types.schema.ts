import { z } from "zod";
import type { BaseFormState } from "@/lib/validators/common-schemas";

const FEE_ITEM_CATEGORIES = ["tuition", "fees", "materials", "discount", "other"] as const;

export const CreateFeeItemTypeSchema = z.object({
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(20, "Code must be at most 20 characters")
    .toUpperCase()
    .regex(/^[A-Z0-9_]+$/, "Code may only contain letters, numbers, and underscores"),
  name: z.string().min(2, "Name must be at least 2 characters").max(80, "Name too long"),
  category: z.enum(FEE_ITEM_CATEGORIES, { message: "Select a valid category" }),
  isDiscount: z.coerce.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
});

export const UpdateFeeItemTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, "Name must be at least 2 characters").max(80, "Name too long").optional(),
  category: z.enum(FEE_ITEM_CATEGORIES).optional(),
  isDiscount: z.coerce.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const ToggleFeeItemTypeSchema = z.object({
  id: z.string().uuid(),
  isActive: z.coerce.boolean(),
});

export type CreateFeeItemTypeInput = z.infer<typeof CreateFeeItemTypeSchema>;
export type UpdateFeeItemTypeInput = z.infer<typeof UpdateFeeItemTypeSchema>;

export type CreateFeeItemTypeFormState = BaseFormState<CreateFeeItemTypeInput> & {
  typeId?: string;
};

export type UpdateFeeItemTypeFormState = BaseFormState<UpdateFeeItemTypeInput> & {
  typeId?: string;
};

export type ToggleFeeItemTypeFormState = BaseFormState<{ id: string; isActive: boolean }>;

export const FEE_ITEM_CATEGORY_LABELS: Record<typeof FEE_ITEM_CATEGORIES[number], string> = {
  tuition: "Tuition",
  fees: "Fees",
  materials: "Materials",
  discount: "Discount",
  other: "Other",
};

export const FEE_ITEM_CATEGORIES_LIST = FEE_ITEM_CATEGORIES;
