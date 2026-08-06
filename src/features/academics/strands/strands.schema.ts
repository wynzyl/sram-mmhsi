import { z } from "zod";
import { uuidSchema, type BaseFormState } from "@/lib/validators/common-schemas";
import { TRACK_CATEGORIES, type TrackCategory } from "@/lib/constants/track-categories";

// ─── Create Strand (Track) Schema ─────────────────────────────────────────────

export const createStrandSchema = z.object({
  /** Full track code (e.g., "STEM", "TVL-ICT", "MAHS") - admin-defined TEXT */
  code: z
    .string()
    .trim()
    .min(1, "Track code is required")
    .max(20, "Track code is too long")
    .regex(
      /^[A-Z][A-Z0-9-]*$/,
      "Code must start with a letter and contain only uppercase letters, numbers, and hyphens"
    ),
  /** Short code for UI badges (e.g., "STEM", "ICT" for TVL-ICT) */
  shortCode: z
    .string()
    .trim()
    .min(1, "Short code is required")
    .max(10, "Short code is too long")
    .regex(
      /^[A-Z][A-Z0-9]*$/,
      "Short code must contain only uppercase letters and numbers"
    ),
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().trim().max(500, "Description is too long").optional(),
  /** Track category: academic, tvl, or specialized */
  trackCategory: z.enum(TRACK_CATEGORIES, {
    message: "Please select a valid track category",
  }),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});

export type CreateStrandInput = z.infer<typeof createStrandSchema>;

export type CreateStrandFormState = BaseFormState<CreateStrandInput> & {
  strandId?: string;
};

// ─── Update Strand (Track) Schema ─────────────────────────────────────────────

export const updateStrandSchema = z.object({
  id: uuidSchema,
  /** Code can be updated (admin-managed text, not enum) */
  code: z
    .string()
    .trim()
    .min(1, "Track code is required")
    .max(20, "Track code is too long")
    .regex(
      /^[A-Z][A-Z0-9-]*$/,
      "Code must start with a letter and contain only uppercase letters, numbers, and hyphens"
    ),
  shortCode: z
    .string()
    .trim()
    .min(1, "Short code is required")
    .max(10, "Short code is too long")
    .regex(
      /^[A-Z][A-Z0-9]*$/,
      "Short code must contain only uppercase letters and numbers"
    ),
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().trim().max(500, "Description is too long").nullable().optional(),
  trackCategory: z.enum(TRACK_CATEGORIES, {
    message: "Please select a valid track category",
  }),
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
 * Track (strand) view - includes all fields for display.
 */
export interface StrandView {
  id: string;
  /** Full track code (e.g., "STEM", "TVL-ICT", "MAHS") */
  code: string;
  /** Short code for UI badges (e.g., "STEM", "ICT") */
  shortCode: string;
  name: string;
  description: string | null;
  /** Track category: academic, tvl, or specialized */
  trackCategory: TrackCategory;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Count of subjects owned by this track (direct ownership) */
  subjectCount?: number;
  /** Count of active enrollments with this track */
  enrollmentCount?: number;
  /** Count of sections assigned to this track */
  sectionCount?: number;
}

/**
 * Track option for dropdown - minimal info for selection.
 */
export interface StrandOption {
  id: string;
  code: string;
  name: string;
  /** Short code for UI badges */
  shortCode: string;
  trackCategory: TrackCategory;
  isActive: boolean;
}

/**
 * Track category groups for UI display (grouped by category)
 */
export interface StrandsByCategory {
  academic: StrandOption[];
  tvl: StrandOption[];
  specialized: StrandOption[];
}
