/**
 * Integration Tests: Academics Module
 *
 * Tests the complete integration of:
 * - Section creation and validation
 * - Adviser assignment
 * - Subject offerings and teacher assignment
 * - Grade entry validation
 * - Grade sheet workflow (state machine)
 * - Sequential period validation
 *
 * These tests verify business logic integration WITHOUT database access,
 * using actual schemas and calculation functions with realistic fixtures.
 */

import { describe, expect, it } from "vitest";

// Schemas
import {
  createSectionSchema,
  updateSectionSchema,
  copySectionsSchema,
  type SectionView,
  type StudentInSection,
} from "../sections/sections.schema";
import {
  assignAdviserSchema,
  removeAdviserSchema,
  type AdviserView,
  type TeacherOption,
  type SectionOption,
} from "../advisers/advisers.schema";
import {
  generateSubjectOfferingsSchema,
  assignTeacherSchema,
  deleteSubjectOfferingSchema,
  addManualSubjectOfferingSchema,
  updateOfferingTrackSchema,
  type SubjectOfferingView,
} from "../subject-offerings/subject-offerings.schema";
import {
  CreateGradeSheetSchema,
  SaveGradeSheetEntriesSchema,
  SubmitGradeSheetSchema,
  ReturnGradeSheetSchema,
  ApproveGradeSheetSchema,
  PublishGradeSheetSchema,
  LockGradeSheetSchema,
  UnlockGradeSheetSchema,
  type GradeSheetView,
  type GradeSheetEntryView,
} from "../grades/grades.schema";

// Constants
import {
  GRADING_PERIODS,
  QUARTERLY_PERIODS,
  TRIMESTER_PERIODS,
  GRADE_SHEET_STATUSES,
  GRADE_APPROVAL_ACTIONS,
  getGradeRemarks,
  validateGradeRemarks,
  type GradingPeriod,
  type GradeSheetStatus,
} from "@/lib/constants/grading-periods";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_2 = "550e8400-e29b-41d4-a716-446655440001";
const VALID_UUID_3 = "550e8400-e29b-41d4-a716-446655440002";

/** Create a mock section view */
const createSectionView = (overrides?: Partial<SectionView>): SectionView => ({
  id: VALID_UUID,
  name: "Section A",
  gradeLevelId: VALID_UUID_2,
  gradeLevelName: "Grade 7",
  gradeLevelOrder: 7,
  schoolYearId: VALID_UUID_3,
  schoolYearLabel: "2026-2027",
  isActiveYear: true,
  createdAt: new Date("2026-06-01"),
  enrollmentCount: 30,
  assignmentCount: 8,
  ...overrides,
});

/** Create a mock adviser view */
const createAdviserView = (overrides?: Partial<AdviserView>): AdviserView => ({
  id: VALID_UUID,
  sectionId: VALID_UUID_2,
  sectionName: "Section A",
  gradeLevelId: VALID_UUID_3,
  gradeLevelName: "Grade 7",
  gradeLevelOrder: 7,
  userId: "550e8400-e29b-41d4-a716-446655440010",
  userName: "Juan Dela Cruz",
  userEmail: "juan.delacruz@school.edu",
  schoolYearId: VALID_UUID_3,
  schoolYearLabel: "2026-2027",
  isActiveYear: true,
  createdAt: new Date("2026-06-01"),
  ...overrides,
});

/** Create a mock subject offering view */
const createSubjectOfferingView = (
  overrides?: Partial<SubjectOfferingView>
): SubjectOfferingView => ({
  id: VALID_UUID,
  sectionId: VALID_UUID_2,
  sectionName: "Section A",
  gradeLevelId: VALID_UUID_3,
  gradeLevelName: "Grade 7",
  subjectId: "550e8400-e29b-41d4-a716-446655440020",
  subjectCode: "MATH7",
  subjectName: "Mathematics 7",
  subjectUnits: "1.0",
  isCore: true,
  schoolYearId: VALID_UUID_3,
  schoolYearLabel: "2026-2027",
  teacherId: null,
  teacherName: null,
  strandId: null,
  strandCode: null,
  termOffered: "full_year",
  isActive: true,
  sequenceOrder: 1,
  createdAt: new Date("2026-06-01"),
  studentCount: 30,
  ...overrides,
});

/** Create a mock grade sheet view */
const createGradeSheetView = (
  overrides?: Partial<GradeSheetView>
): GradeSheetView => ({
  id: VALID_UUID,
  sectionId: VALID_UUID_2,
  sectionName: "Section A",
  gradeLevelId: VALID_UUID_3,
  gradeLevelName: "Grade 7",
  gradeLevelOrder: 7,
  schoolYearId: "550e8400-e29b-41d4-a716-446655440030",
  schoolYearLabel: "2026-2027",
  adviserId: "550e8400-e29b-41d4-a716-446655440010",
  adviserName: "Juan Dela Cruz",
  gradingPeriod: "Q1",
  status: "draft",
  submittedAt: null,
  principalApprovedAt: null,
  publishedAt: null,
  lockedAt: null,
  returnedAt: null,
  returnRemarks: null,
  createdAt: new Date("2026-06-01"),
  ...overrides,
});

/** Create mock grade sheet entries */
const createGradeEntries = (
  count: number,
  withGrades: boolean = true
): GradeSheetEntryView[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `entry-${i + 1}`,
    gradeSheetId: VALID_UUID,
    studentId: `student-${i + 1}`,
    studentRef: `2026-${String(i + 1).padStart(5, "0")}`,
    studentName: `Student ${i + 1}`,
    subjectId: `subject-${(i % 8) + 1}`,
    subjectName: `Subject ${(i % 8) + 1}`,
    subjectCode: `SUBJ${(i % 8) + 1}`,
    grade: withGrades ? String(75 + (i % 26)) : null, // 75-100
    remarks: withGrades ? getGradeRemarks(75 + (i % 26)) : null,
    studentSubjectEnrollmentId: `sse-${i + 1}`,
  }));

// ─────────────────────────────────────────────────────────────────────────────
// Section Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Section Schema Validation", () => {
  describe("createSectionSchema", () => {
    it("validates a valid section creation input", () => {
      const input = {
        name: "Section A",
        gradeLevelId: VALID_UUID,
        schoolYearId: VALID_UUID_2,
      };

      const result = createSectionSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Section A");
        expect(result.data.gradeLevelId).toBe(VALID_UUID);
      }
    });

    it("rejects empty section name", () => {
      const input = {
        name: "",
        gradeLevelId: VALID_UUID,
        schoolYearId: VALID_UUID_2,
      };

      const result = createSectionSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("rejects section name exceeding 100 characters", () => {
      const input = {
        name: "A".repeat(101),
        gradeLevelId: VALID_UUID,
        schoolYearId: VALID_UUID_2,
      };

      const result = createSectionSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find((i) =>
          i.path.includes("name")
        );
        expect(nameError?.message).toContain("100 characters");
      }
    });

    it("rejects invalid grade level UUID", () => {
      const input = {
        name: "Section A",
        gradeLevelId: "not-a-uuid",
        schoolYearId: VALID_UUID_2,
      };

      const result = createSectionSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("trims whitespace from section name", () => {
      const input = {
        name: "  Section A  ",
        gradeLevelId: VALID_UUID,
        schoolYearId: VALID_UUID_2,
      };

      const result = createSectionSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Section A");
      }
    });
  });

  describe("updateSectionSchema", () => {
    it("validates a valid section update input", () => {
      const input = {
        id: VALID_UUID,
        name: "Section B",
        gradeLevelId: VALID_UUID_2,
        schoolYearId: VALID_UUID_3,
      };

      const result = updateSectionSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("requires section ID for updates", () => {
      const input = {
        name: "Section B",
        gradeLevelId: VALID_UUID_2,
        schoolYearId: VALID_UUID_3,
      };

      const result = updateSectionSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("copySectionsSchema", () => {
    it("validates copy sections input", () => {
      const input = {
        sourceSchoolYearId: VALID_UUID,
        targetSchoolYearId: VALID_UUID_2,
      };

      const result = copySectionsSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("requires both source and target school year", () => {
      const input = {
        sourceSchoolYearId: VALID_UUID,
      };

      const result = copySectionsSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Adviser Assignment Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Adviser Assignment Schema Validation", () => {
  describe("assignAdviserSchema", () => {
    it("validates a valid adviser assignment input", () => {
      const input = {
        sectionId: VALID_UUID,
        userId: VALID_UUID_2,
        schoolYearId: VALID_UUID_3,
      };

      const result = assignAdviserSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("requires all three IDs", () => {
      const input = {
        sectionId: VALID_UUID,
        userId: VALID_UUID_2,
        // Missing schoolYearId
      };

      const result = assignAdviserSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("rejects invalid user UUID", () => {
      const input = {
        sectionId: VALID_UUID,
        userId: "invalid-uuid",
        schoolYearId: VALID_UUID_3,
      };

      const result = assignAdviserSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("removeAdviserSchema", () => {
    it("validates remove adviser input", () => {
      const input = { id: VALID_UUID };

      const result = removeAdviserSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("requires adviser assignment ID", () => {
      const input = {};

      const result = removeAdviserSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Subject Offering Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Subject Offering Schema Validation", () => {
  describe("generateSubjectOfferingsSchema", () => {
    it("validates generate offerings input", () => {
      const input = {
        sectionId: VALID_UUID,
        schoolYearId: VALID_UUID_2,
      };

      const result = generateSubjectOfferingsSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });

  describe("assignTeacherSchema", () => {
    it("validates teacher assignment input", () => {
      const input = {
        subjectOfferingId: VALID_UUID,
        teacherId: VALID_UUID_2,
      };

      const result = assignTeacherSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("allows null teacher ID (unassign)", () => {
      const input = {
        subjectOfferingId: VALID_UUID,
        teacherId: null,
      };

      const result = assignTeacherSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.teacherId).toBeNull();
      }
    });
  });

  describe("addManualSubjectOfferingSchema", () => {
    it("validates manual subject offering input", () => {
      const input = {
        sectionId: VALID_UUID,
        schoolYearId: VALID_UUID_2,
        subjectId: VALID_UUID_3,
        sourceCurriculumId: "550e8400-e29b-41d4-a716-446655440004",
        strandId: null,
        sequenceOrder: 1,
        termOffered: "full_year",
      };

      const result = addManualSubjectOfferingSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("accepts SHS term offerings", () => {
      const terms = ["full_year", "first_semester", "second_semester"] as const;

      for (const term of terms) {
        const input = {
          sectionId: VALID_UUID,
          schoolYearId: VALID_UUID_2,
          subjectId: VALID_UUID_3,
          sourceCurriculumId: "550e8400-e29b-41d4-a716-446655440004",
          termOffered: term,
        };

        const result = addManualSubjectOfferingSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it("defaults termOffered to full_year", () => {
      const input = {
        sectionId: VALID_UUID,
        schoolYearId: VALID_UUID_2,
        subjectId: VALID_UUID_3,
        sourceCurriculumId: "550e8400-e29b-41d4-a716-446655440004",
        // No termOffered provided
      };

      const result = addManualSubjectOfferingSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.termOffered).toBe("full_year");
      }
    });
  });

  describe("updateOfferingTrackSchema", () => {
    it("validates track update with strand ID", () => {
      const input = {
        id: VALID_UUID,
        strandId: VALID_UUID_2,
      };

      const result = updateOfferingTrackSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("accepts null strand ID for 'All Tracks'", () => {
      const input = {
        id: VALID_UUID,
        strandId: null,
      };

      const result = updateOfferingTrackSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strandId).toBeNull();
      }
    });

    it("converts empty string to null for strandId", () => {
      const input = {
        id: VALID_UUID,
        strandId: "",
      };

      const result = updateOfferingTrackSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strandId).toBeNull();
      }
    });

    it("converts 'null' string to null for strandId", () => {
      const input = {
        id: VALID_UUID,
        strandId: "null",
      };

      const result = updateOfferingTrackSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strandId).toBeNull();
      }
    });
  });

  describe("deleteSubjectOfferingSchema", () => {
    it("validates delete offering input", () => {
      const input = { id: VALID_UUID };

      const result = deleteSubjectOfferingSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grade Entry Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Grade Entry Schema Validation", () => {
  describe("CreateGradeSheetSchema", () => {
    it("validates grade sheet creation input", () => {
      const input = {
        sectionId: VALID_UUID,
        schoolYearId: VALID_UUID_2,
        gradingPeriod: "Q1",
      };

      const result = CreateGradeSheetSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("accepts all valid grading periods", () => {
      for (const period of GRADING_PERIODS) {
        const input = {
          sectionId: VALID_UUID,
          schoolYearId: VALID_UUID_2,
          gradingPeriod: period,
        };

        const result = CreateGradeSheetSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid grading period", () => {
      const input = {
        sectionId: VALID_UUID,
        schoolYearId: VALID_UUID_2,
        gradingPeriod: "Q5",
      };

      const result = CreateGradeSheetSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("SaveGradeSheetEntriesSchema", () => {
    it("validates grade entries with valid grades", () => {
      const input = {
        gradeSheetId: VALID_UUID,
        entries: [
          { studentId: VALID_UUID_2, subjectId: VALID_UUID_3, grade: 85 },
          { studentId: VALID_UUID_2, subjectId: "550e8400-e29b-41d4-a716-446655440004", grade: 90 },
        ],
      };

      const result = SaveGradeSheetEntriesSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("accepts empty string grades (not yet entered)", () => {
      const input = {
        gradeSheetId: VALID_UUID,
        entries: [
          { studentId: VALID_UUID_2, subjectId: VALID_UUID_3, grade: "" },
        ],
      };

      const result = SaveGradeSheetEntriesSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("accepts null grades", () => {
      const input = {
        gradeSheetId: VALID_UUID,
        entries: [
          { studentId: VALID_UUID_2, subjectId: VALID_UUID_3, grade: null },
        ],
      };

      const result = SaveGradeSheetEntriesSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("rejects grades below 60", () => {
      const input = {
        gradeSheetId: VALID_UUID,
        entries: [
          { studentId: VALID_UUID_2, subjectId: VALID_UUID_3, grade: 59 },
        ],
      };

      const result = SaveGradeSheetEntriesSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const gradeError = result.error.issues.find((i) =>
          i.message.includes("Minimum grade")
        );
        expect(gradeError).toBeDefined();
      }
    });

    it("rejects grades above 100", () => {
      const input = {
        gradeSheetId: VALID_UUID,
        entries: [
          { studentId: VALID_UUID_2, subjectId: VALID_UUID_3, grade: 101 },
        ],
      };

      const result = SaveGradeSheetEntriesSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("accepts remarks up to 500 characters", () => {
      const input = {
        gradeSheetId: VALID_UUID,
        entries: [
          {
            studentId: VALID_UUID_2,
            subjectId: VALID_UUID_3,
            grade: 85,
            remarks: "A".repeat(500),
          },
        ],
      };

      const result = SaveGradeSheetEntriesSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("rejects remarks exceeding 500 characters", () => {
      const input = {
        gradeSheetId: VALID_UUID,
        entries: [
          {
            studentId: VALID_UUID_2,
            subjectId: VALID_UUID_3,
            grade: 85,
            remarks: "A".repeat(501),
          },
        ],
      };

      const result = SaveGradeSheetEntriesSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("SubmitGradeSheetSchema", () => {
    it("validates submit grade sheet input", () => {
      const input = { gradeSheetId: VALID_UUID };

      const result = SubmitGradeSheetSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grade Approval Workflow Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Grade Approval Workflow Schemas", () => {
  describe("ReturnGradeSheetSchema", () => {
    it("validates return with remarks", () => {
      const input = {
        gradeSheetId: VALID_UUID,
        remarks: "Please review Math grades for Student A",
      };

      const result = ReturnGradeSheetSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("requires remarks when returning", () => {
      const input = {
        gradeSheetId: VALID_UUID,
        remarks: "",
      };

      const result = ReturnGradeSheetSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const remarksError = result.error.issues.find((i) =>
          i.path.includes("remarks")
        );
        expect(remarksError?.message).toContain("required");
      }
    });

    it("limits remarks to 1000 characters", () => {
      const input = {
        gradeSheetId: VALID_UUID,
        remarks: "A".repeat(1001),
      };

      const result = ReturnGradeSheetSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("ApproveGradeSheetSchema", () => {
    it("validates approve input", () => {
      const input = { gradeSheetId: VALID_UUID };

      const result = ApproveGradeSheetSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });

  describe("PublishGradeSheetSchema", () => {
    it("validates publish input", () => {
      const input = { gradeSheetId: VALID_UUID };

      const result = PublishGradeSheetSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });

  describe("LockGradeSheetSchema", () => {
    it("validates lock input", () => {
      const input = { gradeSheetId: VALID_UUID };

      const result = LockGradeSheetSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });

  describe("UnlockGradeSheetSchema", () => {
    it("validates unlock with reason", () => {
      const input = {
        gradeSheetId: VALID_UUID,
        reason: "Error discovered in Math grades after publication",
      };

      const result = UnlockGradeSheetSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("requires reason when unlocking", () => {
      const input = {
        gradeSheetId: VALID_UUID,
        reason: "",
      };

      const result = UnlockGradeSheetSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grade Sheet State Machine Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Grade Sheet State Machine", () => {
  /**
   * Simulates state transition validation.
   * Returns true if the transition is valid, false otherwise.
   */
  const isValidTransition = (
    from: GradeSheetStatus,
    action: (typeof GRADE_APPROVAL_ACTIONS)[number]
  ): { valid: boolean; to?: GradeSheetStatus } => {
    const transitions: Record<
      GradeSheetStatus,
      Partial<Record<(typeof GRADE_APPROVAL_ACTIONS)[number], GradeSheetStatus>>
    > = {
      draft: {
        submit: "submitted",
      },
      submitted: {
        principal_return: "returned",
        principal_approve: "principal_approved",
      },
      returned: {
        submit: "submitted", // Adviser resubmits
      },
      principal_approved: {
        publish: "published",
      },
      published: {
        lock: "locked",
      },
      locked: {
        unlock: "published",
      },
    };

    const nextStatus = transitions[from]?.[action];
    return nextStatus
      ? { valid: true, to: nextStatus }
      : { valid: false };
  };

  describe("Valid Transitions", () => {
    it("allows draft → submitted (adviser submit)", () => {
      const result = isValidTransition("draft", "submit");
      expect(result.valid).toBe(true);
      expect(result.to).toBe("submitted");
    });

    it("allows submitted → returned (principal return)", () => {
      const result = isValidTransition("submitted", "principal_return");
      expect(result.valid).toBe(true);
      expect(result.to).toBe("returned");
    });

    it("allows submitted → principal_approved (principal approve)", () => {
      const result = isValidTransition("submitted", "principal_approve");
      expect(result.valid).toBe(true);
      expect(result.to).toBe("principal_approved");
    });

    it("allows returned → submitted (adviser resubmit)", () => {
      const result = isValidTransition("returned", "submit");
      expect(result.valid).toBe(true);
      expect(result.to).toBe("submitted");
    });

    it("allows principal_approved → published (publish)", () => {
      const result = isValidTransition("principal_approved", "publish");
      expect(result.valid).toBe(true);
      expect(result.to).toBe("published");
    });

    it("allows published → locked (lock)", () => {
      const result = isValidTransition("published", "lock");
      expect(result.valid).toBe(true);
      expect(result.to).toBe("locked");
    });

    it("allows locked → published (unlock)", () => {
      const result = isValidTransition("locked", "unlock");
      expect(result.valid).toBe(true);
      expect(result.to).toBe("published");
    });
  });

  describe("Invalid Transitions", () => {
    it("rejects draft → principal_approved (skip submit)", () => {
      const result = isValidTransition("draft", "principal_approve");
      expect(result.valid).toBe(false);
    });

    it("rejects draft → published (skip approval)", () => {
      const result = isValidTransition("draft", "publish");
      expect(result.valid).toBe(false);
    });

    it("rejects submitted → published (skip principal approval)", () => {
      const result = isValidTransition("submitted", "publish");
      expect(result.valid).toBe(false);
    });

    it("rejects submitted → locked (skip publish)", () => {
      const result = isValidTransition("submitted", "lock");
      expect(result.valid).toBe(false);
    });

    it("rejects returned → principal_approved (must resubmit first)", () => {
      const result = isValidTransition("returned", "principal_approve");
      expect(result.valid).toBe(false);
    });

    it("rejects principal_approved → locked (skip publish)", () => {
      const result = isValidTransition("principal_approved", "lock");
      expect(result.valid).toBe(false);
    });

    it("rejects locked → draft (cannot go back to draft)", () => {
      const result = isValidTransition("locked", "submit");
      expect(result.valid).toBe(false);
    });
  });

  describe("Full Workflow Path", () => {
    it("completes happy path: draft → submitted → approved → published → locked", () => {
      let status: GradeSheetStatus = "draft";

      // Adviser submits
      let result = isValidTransition(status, "submit");
      expect(result.valid).toBe(true);
      status = result.to!;
      expect(status).toBe("submitted");

      // Principal approves
      result = isValidTransition(status, "principal_approve");
      expect(result.valid).toBe(true);
      status = result.to!;
      expect(status).toBe("principal_approved");

      // Finance publishes
      result = isValidTransition(status, "publish");
      expect(result.valid).toBe(true);
      status = result.to!;
      expect(status).toBe("published");

      // Admin locks
      result = isValidTransition(status, "lock");
      expect(result.valid).toBe(true);
      status = result.to!;
      expect(status).toBe("locked");
    });

    it("handles return and resubmit flow", () => {
      let status: GradeSheetStatus = "submitted";

      // Principal returns
      let result = isValidTransition(status, "principal_return");
      expect(result.valid).toBe(true);
      status = result.to!;
      expect(status).toBe("returned");

      // Adviser fixes and resubmits
      result = isValidTransition(status, "submit");
      expect(result.valid).toBe(true);
      status = result.to!;
      expect(status).toBe("submitted");

      // Principal approves this time
      result = isValidTransition(status, "principal_approve");
      expect(result.valid).toBe(true);
      status = result.to!;
      expect(status).toBe("principal_approved");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sequential Period Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Sequential Period Validation", () => {
  /**
   * Check if a period can be submitted based on previous periods' status.
   * Returns true if all previous periods are in approved/published/locked status.
   */
  const canSubmitPeriod = (
    period: GradingPeriod,
    periodStatuses: Map<GradingPeriod, GradeSheetStatus>
  ): { canSubmit: boolean; blockedBy?: GradingPeriod } => {
    const quarterOrder: GradingPeriod[] = ["Q1", "Q2", "Q3", "Q4"];
    const trimesterOrder: GradingPeriod[] = ["T1", "T2", "T3"];

    const isQuarter = period.startsWith("Q");
    const order = isQuarter ? quarterOrder : trimesterOrder;
    const currentIndex = order.indexOf(period);

    // First period can always be submitted
    if (currentIndex === 0) {
      return { canSubmit: true };
    }

    // Check all previous periods
    for (let i = 0; i < currentIndex; i++) {
      const prevPeriod = order[i];
      const prevStatus = periodStatuses.get(prevPeriod);

      // Previous period must be approved, published, or locked
      const approvedStatuses: GradeSheetStatus[] = [
        "principal_approved",
        "published",
        "locked",
      ];

      if (!prevStatus || !approvedStatuses.includes(prevStatus)) {
        return { canSubmit: false, blockedBy: prevPeriod };
      }
    }

    return { canSubmit: true };
  };

  describe("Quarterly Period Sequence", () => {
    it("allows Q1 submission without prerequisites", () => {
      const statuses = new Map<GradingPeriod, GradeSheetStatus>();

      const result = canSubmitPeriod("Q1", statuses);

      expect(result.canSubmit).toBe(true);
    });

    it("allows Q2 submission when Q1 is approved", () => {
      const statuses = new Map<GradingPeriod, GradeSheetStatus>([
        ["Q1", "principal_approved"],
      ]);

      const result = canSubmitPeriod("Q2", statuses);

      expect(result.canSubmit).toBe(true);
    });

    it("blocks Q2 submission when Q1 is still draft", () => {
      const statuses = new Map<GradingPeriod, GradeSheetStatus>([
        ["Q1", "draft"],
      ]);

      const result = canSubmitPeriod("Q2", statuses);

      expect(result.canSubmit).toBe(false);
      expect(result.blockedBy).toBe("Q1");
    });

    it("blocks Q2 submission when Q1 is submitted (not yet approved)", () => {
      const statuses = new Map<GradingPeriod, GradeSheetStatus>([
        ["Q1", "submitted"],
      ]);

      const result = canSubmitPeriod("Q2", statuses);

      expect(result.canSubmit).toBe(false);
      expect(result.blockedBy).toBe("Q1");
    });

    it("allows Q3 submission when Q1 and Q2 are approved", () => {
      const statuses = new Map<GradingPeriod, GradeSheetStatus>([
        ["Q1", "published"],
        ["Q2", "principal_approved"],
      ]);

      const result = canSubmitPeriod("Q3", statuses);

      expect(result.canSubmit).toBe(true);
    });

    it("blocks Q3 when Q2 is not approved (even if Q1 is)", () => {
      const statuses = new Map<GradingPeriod, GradeSheetStatus>([
        ["Q1", "locked"],
        ["Q2", "submitted"],
      ]);

      const result = canSubmitPeriod("Q3", statuses);

      expect(result.canSubmit).toBe(false);
      expect(result.blockedBy).toBe("Q2");
    });

    it("allows Q4 submission when all previous periods are approved", () => {
      const statuses = new Map<GradingPeriod, GradeSheetStatus>([
        ["Q1", "locked"],
        ["Q2", "published"],
        ["Q3", "principal_approved"],
      ]);

      const result = canSubmitPeriod("Q4", statuses);

      expect(result.canSubmit).toBe(true);
    });

    it("blocks Q4 when any previous period is not approved", () => {
      const statuses = new Map<GradingPeriod, GradeSheetStatus>([
        ["Q1", "locked"],
        ["Q2", "returned"], // Returned means needs resubmission
        ["Q3", "principal_approved"],
      ]);

      const result = canSubmitPeriod("Q4", statuses);

      expect(result.canSubmit).toBe(false);
      expect(result.blockedBy).toBe("Q2");
    });
  });

  describe("Trimester Period Sequence", () => {
    it("allows T1 submission without prerequisites", () => {
      const statuses = new Map<GradingPeriod, GradeSheetStatus>();

      const result = canSubmitPeriod("T1", statuses);

      expect(result.canSubmit).toBe(true);
    });

    it("allows T2 when T1 is approved", () => {
      const statuses = new Map<GradingPeriod, GradeSheetStatus>([
        ["T1", "principal_approved"],
      ]);

      const result = canSubmitPeriod("T2", statuses);

      expect(result.canSubmit).toBe(true);
    });

    it("blocks T2 when T1 is not approved", () => {
      const statuses = new Map<GradingPeriod, GradeSheetStatus>([
        ["T1", "draft"],
      ]);

      const result = canSubmitPeriod("T2", statuses);

      expect(result.canSubmit).toBe(false);
      expect(result.blockedBy).toBe("T1");
    });

    it("allows T3 when T1 and T2 are approved", () => {
      const statuses = new Map<GradingPeriod, GradeSheetStatus>([
        ["T1", "locked"],
        ["T2", "published"],
      ]);

      const result = canSubmitPeriod("T3", statuses);

      expect(result.canSubmit).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DepEd Grade Remarks Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("DepEd Grade Remarks", () => {
  describe("getGradeRemarks", () => {
    it("returns 'Did Not Meet Expectations' for grades below 75", () => {
      expect(getGradeRemarks(60)).toBe("Did Not Meet Expectations");
      expect(getGradeRemarks(74)).toBe("Did Not Meet Expectations");
      expect(getGradeRemarks(0)).toBe("Did Not Meet Expectations");
    });

    it("returns 'Fairly Satisfactory' for grades 75-79", () => {
      expect(getGradeRemarks(75)).toBe("Fairly Satisfactory");
      expect(getGradeRemarks(77)).toBe("Fairly Satisfactory");
      expect(getGradeRemarks(79)).toBe("Fairly Satisfactory");
    });

    it("returns 'Satisfactory' for grades 80-84", () => {
      expect(getGradeRemarks(80)).toBe("Satisfactory");
      expect(getGradeRemarks(82)).toBe("Satisfactory");
      expect(getGradeRemarks(84)).toBe("Satisfactory");
    });

    it("returns 'Very Satisfactory' for grades 85-89", () => {
      expect(getGradeRemarks(85)).toBe("Very Satisfactory");
      expect(getGradeRemarks(87)).toBe("Very Satisfactory");
      expect(getGradeRemarks(89)).toBe("Very Satisfactory");
    });

    it("returns 'Outstanding' for grades 90 and above", () => {
      expect(getGradeRemarks(90)).toBe("Outstanding");
      expect(getGradeRemarks(95)).toBe("Outstanding");
      expect(getGradeRemarks(100)).toBe("Outstanding");
    });
  });

  describe("validateGradeRemarks", () => {
    it("accepts matching remarks", () => {
      expect(validateGradeRemarks(90, "Outstanding")).toBe(true);
      expect(validateGradeRemarks(85, "Very Satisfactory")).toBe(true);
      expect(validateGradeRemarks(80, "Satisfactory")).toBe(true);
      expect(validateGradeRemarks(75, "Fairly Satisfactory")).toBe(true);
      expect(validateGradeRemarks(70, "Did Not Meet Expectations")).toBe(true);
    });

    it("accepts null/undefined remarks (server will auto-set)", () => {
      expect(validateGradeRemarks(90, null)).toBe(true);
      expect(validateGradeRemarks(90, undefined)).toBe(true);
      expect(validateGradeRemarks(90, "")).toBe(true);
    });

    it("rejects mismatched remarks", () => {
      expect(validateGradeRemarks(90, "Satisfactory")).toBe(false);
      expect(validateGradeRemarks(75, "Outstanding")).toBe(false);
      expect(validateGradeRemarks(60, "Satisfactory")).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grade Completeness Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Grade Sheet Completeness Validation", () => {
  /**
   * Validates that all entries have grades before submission.
   */
  const validateCompleteness = (
    entries: GradeSheetEntryView[]
  ): { complete: boolean; missingCount: number; totalCount: number } => {
    const missingCount = entries.filter(
      (e) => e.grade === null || e.grade === ""
    ).length;

    return {
      complete: missingCount === 0,
      missingCount,
      totalCount: entries.length,
    };
  };

  it("passes when all entries have grades", () => {
    const entries = createGradeEntries(30, true);

    const result = validateCompleteness(entries);

    expect(result.complete).toBe(true);
    expect(result.missingCount).toBe(0);
    expect(result.totalCount).toBe(30);
  });

  it("fails when some entries are missing grades", () => {
    const entries = createGradeEntries(30, true);
    // Remove grades from 5 entries
    entries[0].grade = null;
    entries[5].grade = null;
    entries[10].grade = "";
    entries[15].grade = null;
    entries[20].grade = "";

    const result = validateCompleteness(entries);

    expect(result.complete).toBe(false);
    expect(result.missingCount).toBe(5);
    expect(result.totalCount).toBe(30);
  });

  it("fails when all entries are missing grades", () => {
    const entries = createGradeEntries(30, false);

    const result = validateCompleteness(entries);

    expect(result.complete).toBe(false);
    expect(result.missingCount).toBe(30);
  });

  it("handles empty entry list", () => {
    const entries: GradeSheetEntryView[] = [];

    const result = validateCompleteness(entries);

    expect(result.complete).toBe(true);
    expect(result.missingCount).toBe(0);
    expect(result.totalCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// View Type Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("View Type Structures", () => {
  describe("SectionView", () => {
    it("has all required fields", () => {
      const section = createSectionView();

      expect(section).toHaveProperty("id");
      expect(section).toHaveProperty("name");
      expect(section).toHaveProperty("gradeLevelId");
      expect(section).toHaveProperty("gradeLevelName");
      expect(section).toHaveProperty("gradeLevelOrder");
      expect(section).toHaveProperty("schoolYearId");
      expect(section).toHaveProperty("schoolYearLabel");
      expect(section).toHaveProperty("isActiveYear");
      expect(section).toHaveProperty("enrollmentCount");
      expect(section).toHaveProperty("assignmentCount");
    });
  });

  describe("AdviserView", () => {
    it("has all required fields", () => {
      const adviser = createAdviserView();

      expect(adviser).toHaveProperty("id");
      expect(adviser).toHaveProperty("sectionId");
      expect(adviser).toHaveProperty("sectionName");
      expect(adviser).toHaveProperty("userId");
      expect(adviser).toHaveProperty("userName");
      expect(adviser).toHaveProperty("userEmail");
      expect(adviser).toHaveProperty("schoolYearId");
    });
  });

  describe("SubjectOfferingView", () => {
    it("has all required fields", () => {
      const offering = createSubjectOfferingView();

      expect(offering).toHaveProperty("id");
      expect(offering).toHaveProperty("sectionId");
      expect(offering).toHaveProperty("subjectId");
      expect(offering).toHaveProperty("subjectCode");
      expect(offering).toHaveProperty("subjectName");
      expect(offering).toHaveProperty("teacherId");
      expect(offering).toHaveProperty("strandId");
      expect(offering).toHaveProperty("termOffered");
      expect(offering).toHaveProperty("sequenceOrder");
    });

    it("allows null teacher (unassigned)", () => {
      const offering = createSubjectOfferingView({ teacherId: null, teacherName: null });

      expect(offering.teacherId).toBeNull();
      expect(offering.teacherName).toBeNull();
    });

    it("allows null strand (non-SHS or core subject)", () => {
      const offering = createSubjectOfferingView({ strandId: null, strandCode: null });

      expect(offering.strandId).toBeNull();
      expect(offering.strandCode).toBeNull();
    });
  });

  describe("GradeSheetView", () => {
    it("has all required fields", () => {
      const sheet = createGradeSheetView();

      expect(sheet).toHaveProperty("id");
      expect(sheet).toHaveProperty("sectionId");
      expect(sheet).toHaveProperty("sectionName");
      expect(sheet).toHaveProperty("adviserId");
      expect(sheet).toHaveProperty("adviserName");
      expect(sheet).toHaveProperty("gradingPeriod");
      expect(sheet).toHaveProperty("status");
      expect(sheet).toHaveProperty("submittedAt");
      expect(sheet).toHaveProperty("principalApprovedAt");
      expect(sheet).toHaveProperty("publishedAt");
      expect(sheet).toHaveProperty("lockedAt");
      expect(sheet).toHaveProperty("returnedAt");
      expect(sheet).toHaveProperty("returnRemarks");
    });

    it("tracks timestamps for each workflow stage", () => {
      const sheet = createGradeSheetView({
        status: "locked",
        submittedAt: new Date("2026-06-15"),
        principalApprovedAt: new Date("2026-06-18"),
        publishedAt: new Date("2026-06-20"),
        lockedAt: new Date("2026-06-25"),
      });

      expect(sheet.submittedAt).toBeInstanceOf(Date);
      expect(sheet.principalApprovedAt).toBeInstanceOf(Date);
      expect(sheet.publishedAt).toBeInstanceOf(Date);
      expect(sheet.lockedAt).toBeInstanceOf(Date);
    });

    it("includes return remarks when returned", () => {
      const sheet = createGradeSheetView({
        status: "returned",
        returnedAt: new Date("2026-06-16"),
        returnRemarks: "Please verify Student A's Math grade",
      });

      expect(sheet.status).toBe("returned");
      expect(sheet.returnRemarks).toBe("Please verify Student A's Math grade");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Constants Integrity Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Constants Integrity", () => {
  describe("GRADING_PERIODS", () => {
    it("includes all quarterly periods", () => {
      expect(GRADING_PERIODS).toContain("Q1");
      expect(GRADING_PERIODS).toContain("Q2");
      expect(GRADING_PERIODS).toContain("Q3");
      expect(GRADING_PERIODS).toContain("Q4");
    });

    it("includes all trimester periods", () => {
      expect(GRADING_PERIODS).toContain("T1");
      expect(GRADING_PERIODS).toContain("T2");
      expect(GRADING_PERIODS).toContain("T3");
    });

    it("has exactly 7 periods", () => {
      expect(GRADING_PERIODS).toHaveLength(7);
    });
  });

  describe("QUARTERLY_PERIODS", () => {
    it("has exactly 4 quarters", () => {
      expect(QUARTERLY_PERIODS).toHaveLength(4);
      expect(QUARTERLY_PERIODS).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    });
  });

  describe("TRIMESTER_PERIODS", () => {
    it("has exactly 3 trimesters", () => {
      expect(TRIMESTER_PERIODS).toHaveLength(3);
      expect(TRIMESTER_PERIODS).toEqual(["T1", "T2", "T3"]);
    });
  });

  describe("GRADE_SHEET_STATUSES", () => {
    it("includes all workflow statuses", () => {
      expect(GRADE_SHEET_STATUSES).toContain("draft");
      expect(GRADE_SHEET_STATUSES).toContain("submitted");
      expect(GRADE_SHEET_STATUSES).toContain("principal_approved");
      expect(GRADE_SHEET_STATUSES).toContain("published");
      expect(GRADE_SHEET_STATUSES).toContain("locked");
      expect(GRADE_SHEET_STATUSES).toContain("returned");
    });

    it("has exactly 6 statuses", () => {
      expect(GRADE_SHEET_STATUSES).toHaveLength(6);
    });
  });

  describe("GRADE_APPROVAL_ACTIONS", () => {
    it("includes all approval actions", () => {
      expect(GRADE_APPROVAL_ACTIONS).toContain("submit");
      expect(GRADE_APPROVAL_ACTIONS).toContain("principal_return");
      expect(GRADE_APPROVAL_ACTIONS).toContain("principal_approve");
      expect(GRADE_APPROVAL_ACTIONS).toContain("publish");
      expect(GRADE_APPROVAL_ACTIONS).toContain("lock");
      expect(GRADE_APPROVAL_ACTIONS).toContain("unlock");
    });

    it("has exactly 6 actions", () => {
      expect(GRADE_APPROVAL_ACTIONS).toHaveLength(6);
    });
  });
});
