import { z } from "zod";
import { uuidSchema, type BaseFormState } from "@/lib/validators/common-schemas";
import { SHS_STRAND_CODES, type ShsStrandCode } from "@/lib/constants/strands";

// ─── Create Strand Schema ─────────────────────────────────────────────────────

export const createStrandSchema = z.object({
  code: z.enum(SHS_STRAND_CODES, {
    message: "Please select a valid strand code",
  }),
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().trim().max(500, "Description is too long").optional(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});

export type CreateStrandInput = z.infer<typeof createStrandSchema>;

export type CreateStrandFormState = BaseFormState<CreateStrandInput> & {
  strandId?: string;
};

// ─── Update Strand Schema ─────────────────────────────────────────────────────

export const updateStrandSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().trim().max(500, "Description is too long").nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean(),
});

export type UpdateStrandInput = z.infer<typeof updateStrandSchema>;

export type UpdateStrandFormState = BaseFormState<UpdateStrandInput>;

// ─── Delete Strand Schema ─────────────────────────────────────────────────────

export const deleteStrandSchema = z.object({
  id: uuidSchema,
});

export type DeleteStrandInput = z.infer<typeof deleteStrandSchema>;

export type DeleteStrandFormState = BaseFormState<DeleteStrandInput>;

// ─── View Types ───────────────────────────────────────────────────────────────

/**
 * Strand view - includes all fields for display.
 */
export interface StrandView {
  id: string;
  code: ShsStrandCode;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Count of subjects associated with this strand */
  subjectCount?: number;
  /** Count of active enrollments with this strand */
  enrollmentCount?: number;
}

/**
 * Strand option for dropdown - minimal info for selection.
 */
export interface StrandOption {
  id: string;
  code: ShsStrandCode;
  name: string;
  shortName: string;
  isActive: boolean;
}
