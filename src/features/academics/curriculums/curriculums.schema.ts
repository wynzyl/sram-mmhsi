import { z } from "zod";
import type { BaseFormState } from "@/lib/validators/common-schemas";
import { TERM_OFFERINGS } from "@/lib/constants/term-offerings";

// ─── Curriculum Status ──────────────────────────────────────────────────────

export const CURRICULUM_STATUSES = ["draft", "published", "archived"] as const;
export type CurriculumStatus = (typeof CURRICULUM_STATUSES)[number];

export const CURRICULUM_STATUS_LABELS: Record<CurriculumStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

// ─── Curriculum Create/Update ───────────────────────────────────────────────

export const CreateCurriculumSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters.")
    .max(100, "Name must be 100 characters or less."),
  description: z.string().max(500, "Description must be 500 characters or less.").optional(),
});

export type CreateCurriculumInput = z.infer<typeof CreateCurriculumSchema>;
export type CreateCurriculumFormState = BaseFormState<CreateCurriculumInput> & {
  curriculumId?: string;
};

export const UpdateCurriculumMetaSchema = z.object({
  curriculumId: z.string().uuid("Curriculum ID is required."),
  name: z
    .string()
    .min(3, "Name must be at least 3 characters.")
    .max(100, "Name must be 100 characters or less."),
  description: z.string().max(500, "Description must be 500 characters or less.").optional(),
});

export type UpdateCurriculumMetaInput = z.infer<typeof UpdateCurriculumMetaSchema>;
export type UpdateCurriculumMetaFormState = BaseFormState<UpdateCurriculumMetaInput>;

// ─── Curriculum Clone ───────────────────────────────────────────────────────

export const CloneCurriculumSchema = z.object({
  sourceCurriculumId: z.string().uuid("Source curriculum ID is required."),
  name: z
    .string()
    .min(3, "Name must be at least 3 characters.")
    .max(100, "Name must be 100 characters or less.")
    .optional(),
});

export type CloneCurriculumInput = z.infer<typeof CloneCurriculumSchema>;
export type CloneCurriculumFormState = BaseFormState<CloneCurriculumInput> & {
  curriculumId?: string;
};

// ─── Curriculum Publish ─────────────────────────────────────────────────────

export const PublishCurriculumSchema = z
  .object({
    curriculumId: z.string().uuid("Curriculum ID is required."),
    /** Optional: Grade level IDs to adopt this curriculum for on publish */
    adoptForGradeLevels: z.array(z.string().uuid()).optional(),
    /** School year ID for adoption (required if adoptForGradeLevels is provided) */
    schoolYearId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    // A school year is required whenever grade levels are selected for adoption.
    if (
      data.adoptForGradeLevels &&
      data.adoptForGradeLevels.length > 0 &&
      !data.schoolYearId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["schoolYearId"],
        message: "A school year is required to adopt this curriculum.",
      });
    }
  });

export type PublishCurriculumInput = z.infer<typeof PublishCurriculumSchema>;
export type PublishCurriculumFormState = BaseFormState<PublishCurriculumInput>;

// ─── Curriculum Archive ─────────────────────────────────────────────────────

export const ArchiveCurriculumSchema = z.object({
  curriculumId: z.string().uuid("Curriculum ID is required."),
  confirmName: z.string().min(1, "Please confirm by typing the curriculum name."),
});

export type ArchiveCurriculumInput = z.infer<typeof ArchiveCurriculumSchema>;
export type ArchiveCurriculumFormState = BaseFormState<ArchiveCurriculumInput>;

// ─── Subject Management (within Curriculum) ────────────────────────────────

/**
 * Strand association for a subject.
 * Links an elective subject to a strand with an optional "required for strand" flag.
 */
export const StrandAssociationSchema = z.object({
  strandId: z.string().uuid("Strand ID is required."),
  /** If true, this subject is required for students in this strand */
  isStrandCore: z.boolean().optional().default(false),
});

export type StrandAssociation = z.infer<typeof StrandAssociationSchema>;

export const AddSubjectToCurriculumSchema = z.object({
  curriculumId: z.string().uuid("Curriculum ID is required."),
  name: z.string().min(2, "Name must be at least 2 characters."),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters.")
    .max(20, "Code must be 20 characters or less.")
    .toUpperCase(),
  description: z.string().max(500).optional(),
  gradeLevelId: z.string().uuid("Grade level is required."),
  /**
   * Direct track ownership for SHS subjects (Grade 11-12).
   * When set, this subject belongs exclusively to this track.
   * Required for SHS subjects; should be null/undefined for non-SHS.
   */
  strandId: z.string().uuid("Track is required for SHS subjects.").optional(),
  /**
   * Term when this subject is offered (SHS only).
   * Defaults to "full_year" if not specified.
   */
  termOffered: z.enum(TERM_OFFERINGS).optional().default("full_year"),
  units: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Units must be a valid number (e.g., 1.0, 1.5)")
    .transform((v) => v)
    .optional(),
  sequenceOrder: z.coerce.number().int().min(0).optional(),
  /**
   * Whether this is a core/required subject (used for non-SHS subjects).
   * For SHS, all subjects belong to a track (via strandId) instead.
   */
  isCore: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  /**
   * @deprecated Use strandId for direct track ownership instead.
   * Strand associations for SHS elective subjects (legacy junction table approach).
   */
  strandAssociations: z.string().optional(),
});

export type AddSubjectToCurriculumInput = z.infer<typeof AddSubjectToCurriculumSchema>;
export type AddSubjectToCurriculumFormState = BaseFormState<AddSubjectToCurriculumInput> & {
  subjectId?: string;
};

export const UpdateSubjectInCurriculumSchema = z.object({
  subjectId: z.string().uuid("Subject ID is required."),
  name: z.string().min(2, "Name must be at least 2 characters.").optional(),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters.")
    .max(20, "Code must be 20 characters or less.")
    .toUpperCase()
    .optional(),
  description: z.string().max(500).optional(),
  gradeLevelId: z.string().uuid().optional(),
  /**
   * Direct track ownership for SHS subjects (Grade 11-12).
   * When set, this subject belongs exclusively to this track.
   */
  strandId: z.string().uuid().optional().nullable(),
  /**
   * Term when this subject is offered (SHS only).
   */
  termOffered: z.enum(TERM_OFFERINGS).optional(),
  units: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Units must be a valid number")
    .transform((v) => v)
    .optional(),
  sequenceOrder: z.coerce.number().int().min(0).optional(),
  /**
   * Whether this is a core/required subject (used for non-SHS subjects).
   */
  isCore: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  /**
   * @deprecated Use strandId for direct track ownership instead.
   */
  strandAssociations: z.string().optional(),
});

export type UpdateSubjectInCurriculumInput = z.infer<typeof UpdateSubjectInCurriculumSchema>;
export type UpdateSubjectInCurriculumFormState = BaseFormState<UpdateSubjectInCurriculumInput>;

export const DeleteSubjectFromCurriculumSchema = z.object({
  subjectId: z.string().uuid("Subject ID is required."),
});

export type DeleteSubjectFromCurriculumInput = z.infer<typeof DeleteSubjectFromCurriculumSchema>;
export type DeleteSubjectFromCurriculumFormState = BaseFormState<DeleteSubjectFromCurriculumInput>;

export const RestoreSubjectInCurriculumSchema = z.object({
  subjectId: z.string().uuid("Subject ID is required."),
});

export type RestoreSubjectInCurriculumInput = z.infer<typeof RestoreSubjectInCurriculumSchema>;
export type RestoreSubjectInCurriculumFormState = BaseFormState<RestoreSubjectInCurriculumInput>;

export const ReorderSubjectsSchema = z.object({
  curriculumId: z.string().uuid("Curriculum ID is required."),
  gradeLevelId: z.string().uuid("Grade level ID is required."),
  /** Array of subject IDs in the new order */
  subjectOrder: z.array(z.string().uuid()),
});

export type ReorderSubjectsInput = z.infer<typeof ReorderSubjectsSchema>;
export type ReorderSubjectsFormState = BaseFormState<ReorderSubjectsInput>;

// ─── Curriculum Adoption ────────────────────────────────────────────────────

export const UpdateAdoptionSchema = z.object({
  schoolYearId: z.string().uuid("School year is required."),
  gradeLevelId: z.string().uuid("Grade level is required."),
  curriculumId: z.string().uuid("Curriculum is required."),
});

export type UpdateAdoptionInput = z.infer<typeof UpdateAdoptionSchema>;
export type UpdateAdoptionFormState = BaseFormState<UpdateAdoptionInput>;
