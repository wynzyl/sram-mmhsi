import { z } from "zod";
import { uuidSchema, type BaseFormState } from "@/lib/validators/common-schemas";
import { TERM_OFFERINGS, type TermOffering } from "@/lib/constants/term-offerings";

// ─── Generate Subject Offerings Schema ────────────────────────────────────────

export const generateSubjectOfferingsSchema = z.object({
  sectionId: uuidSchema,
  schoolYearId: uuidSchema,
});

export type GenerateSubjectOfferingsInput = z.infer<typeof generateSubjectOfferingsSchema>;

export type GenerateSubjectOfferingsFormState = BaseFormState<GenerateSubjectOfferingsInput> & {
  createdCount?: number;
  skippedCount?: number;
};

// ─── Assign Teacher Schema ────────────────────────────────────────────────────

export const assignTeacherSchema = z.object({
  subjectOfferingId: uuidSchema,
  teacherId: uuidSchema.nullable().optional(),
});

export type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;

export type AssignTeacherFormState = BaseFormState<AssignTeacherInput>;

// ─── Delete Subject Offering Schema ───────────────────────────────────────────

export const deleteSubjectOfferingSchema = z.object({
  id: uuidSchema,
});

export type DeleteSubjectOfferingInput = z.infer<typeof deleteSubjectOfferingSchema>;

export type DeleteSubjectOfferingFormState = BaseFormState<DeleteSubjectOfferingInput>;

// ─── Delete All Subject Offerings Schema ──────────────────────────────────────

export const deleteAllSubjectOfferingsSchema = z.object({
  sectionId: uuidSchema,
  schoolYearId: uuidSchema,
});

export type DeleteAllSubjectOfferingsInput = z.infer<typeof deleteAllSubjectOfferingsSchema>;

export type DeleteAllSubjectOfferingsFormState = BaseFormState<DeleteAllSubjectOfferingsInput> & {
  deletedCount?: number;
};

// ─── Add Manual Subject Offering Schema ───────────────────────────────────────

/** Zod schema for term offering validation */
export const termOfferingSchema = z.enum(TERM_OFFERINGS);

export const addManualSubjectOfferingSchema = z.object({
  sectionId: uuidSchema,
  schoolYearId: uuidSchema,
  subjectId: uuidSchema,
  sourceCurriculumId: uuidSchema,
  strandId: uuidSchema.nullable().optional(),
  sequenceOrder: z.coerce.number().int().nonnegative().optional(),
  /** Term when this subject is offered (SHS only) - defaults to full year */
  termOffered: termOfferingSchema.optional().default("full_year"),
});

export type AddManualSubjectOfferingInput = z.infer<typeof addManualSubjectOfferingSchema>;

export type AddManualSubjectOfferingFormState = BaseFormState<AddManualSubjectOfferingInput>;

// ─── Available Subjects Lookup Schema ─────────────────────────────────────────

/**
 * Args for the manual-offering subject lookup. These arrive from a client
 * component and are compared against uuid columns, so they must be parsed
 * before reaching the query.
 */
export const availableSubjectsForManualOfferingSchema = z.object({
  curriculumId: uuidSchema,
  gradeLevelId: uuidSchema,
  sectionId: uuidSchema,
  schoolYearId: uuidSchema,
});

export type AvailableSubjectsForManualOfferingInput = z.infer<
  typeof availableSubjectsForManualOfferingSchema
>;

// ─── Update Offering Track Schema ────────────────────────────────────────────

/**
 * Preprocessor for nullable UUID fields from form data.
 * Converts empty strings and "null" string literals to actual null values.
 */
const nullableUuidPreprocess = (val: unknown) => {
  if (val === "" || val === "null" || val === null || val === undefined) {
    return null;
  }
  return val;
};

/**
 * Schema for updating the track (strand) assignment of a subject offering.
 * Setting strandId to null means "All Tracks" (core behavior).
 */
export const updateOfferingTrackSchema = z.object({
  id: uuidSchema,
  /** Strand ID for track-specific assignment, or null for "All Tracks" */
  strandId: z.preprocess(nullableUuidPreprocess, uuidSchema.nullable()),
});

export type UpdateOfferingTrackInput = z.infer<typeof updateOfferingTrackSchema>;

export type UpdateOfferingTrackFormState = BaseFormState<UpdateOfferingTrackInput>;

// ─── View Types ───────────────────────────────────────────────────────────────

/**
 * Subject offering view - includes joined section, subject, and teacher data.
 */
export interface SubjectOfferingView {
  id: string;
  sectionId: string;
  sectionName: string;
  gradeLevelId: string;
  gradeLevelName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectUnits: string;
  isCore: boolean;
  schoolYearId: string;
  schoolYearLabel: string;
  teacherId: string | null;
  teacherName: string | null;
  strandId: string | null;
  strandCode: string | null;
  /** Term when this subject is offered (SHS only) */
  termOffered: TermOffering;
  isActive: boolean;
  sequenceOrder: number;
  createdAt: Date;
  /** Count of students enrolled in this offering */
  studentCount?: number;
}

/**
 * Subject for generating offerings - from curriculum.
 */
export interface SubjectForOffering {
  id: string;
  code: string;
  name: string;
  units: string;
  isCore: boolean;
  gradeLevelId: string;
  gradeLevelName: string;
  sequenceOrder: number;
  /** Strands this subject is available to (for electives) */
  strandIds?: string[];
}

/**
 * Teacher option for assignment dropdown.
 */
export interface TeacherOption {
  id: string;
  name: string;
  email: string;
}

// ─── Manual Subject Offering Types ────────────────────────────────────────────

/**
 * Curriculum option for manual subject offering picker.
 */
export interface CurriculumForSubjectPicker {
  id: string;
  name: string;
  version: number;
  subjectCount: number;
}

/**
 * Subject available for manual offering (from any published curriculum).
 */
export interface SubjectForManualOffering {
  id: string;
  code: string;
  name: string;
  units: string;
  isCore: boolean;
  curriculumId: string;
  curriculumName: string;
  sequenceOrder: number;
  /** Strand associations for SHS electives */
  strandAssociations: Array<{ strandId: string; strandCode: string }>;
}
