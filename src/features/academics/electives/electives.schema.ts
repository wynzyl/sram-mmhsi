import type { ShsStrandCode } from "@/lib/constants/strands";

// ─── Elective Subject View Types ──────────────────────────────────────────────

/**
 * Elective subject with strand associations and enrollment statistics.
 */
export interface ElectiveSubjectView {
  id: string;
  code: string;
  name: string;
  units: string;
  curriculumId: string;
  curriculumName: string;
  gradeLevelId: string;
  gradeLevelName: string;
  /** Strands this elective is available to */
  strands: ElectiveStrandAssociation[];
  /** Number of sections offering this subject */
  sectionOfferingCount: number;
  /** Number of students enrolled in this subject */
  studentEnrollmentCount: number;
}

/**
 * Strand association for an elective subject.
 */
export interface ElectiveStrandAssociation {
  strandId: string;
  strandCode: ShsStrandCode;
  strandName: string;
  /** Whether this subject is required for this strand (vs optional) */
  isStrandCore: boolean;
}

/**
 * Elective subjects grouped by strand for the tabbed view.
 */
export interface ElectivesByStrand {
  strand: {
    id: string;
    code: ShsStrandCode;
    name: string;
  };
  subjects: ElectiveSubjectView[];
}

/**
 * Query parameters for elective subjects.
 */
export interface ElectiveSubjectQueryParams {
  curriculumId?: string;
  schoolYearId?: string;
  strandId?: string;
  gradeLevelId?: string;
}
