import { z } from "zod";
import { uuidSchema, type BaseFormState } from "@/lib/validators/common-schemas";

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
