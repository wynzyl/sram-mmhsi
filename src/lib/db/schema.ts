import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  pgEnum,
  uuid,
  uniqueIndex,
  index,
  check,
  jsonb,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { FEE_ASSESSMENT_BANDS } from "@/lib/constants/assessment-bands";
import { CANCELLATION_REASONS } from "@/lib/constants/cancellation-reasons";
import { STUDENT_STATUSES } from "@/lib/constants/student-status";
import { DOCUMENT_REQUEST_TYPES, DOCUMENT_REQUEST_STATUSES } from "@/lib/constants/document-requests";
import { GRADING_PERIODS, GRADE_SHEET_STATUSES, GRADE_APPROVAL_ACTIONS } from "@/lib/constants/grading-periods";
import { GRADING_SYSTEM_TYPES } from "@/lib/constants/grading-systems";
import { GRADE_GROUPS } from "@/lib/constants/grade-groups";
import { SHS_STRAND_CODES } from "@/lib/constants/strands";
import { TERM_OFFERINGS } from "@/lib/constants/term-offerings";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
  "super_admin",
  "admin",
  "registrar",
  "finance_officer",
  "cashier",
  "teacher",
  "coordinator",  // Grade sheet reviewer for assigned grade level groups
  "principal",    // Final approver for grade sheets
  "student",
  "parent_guardian",
]);

export const registrationStatusEnum = pgEnum("registration_status", [
  "pending",
  "approved",
  "rejected",
]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "pending",
  "assessed",
  "enrolled",
  "cancelled",
]);

export const enrollmentStudentTypeEnum = pgEnum("enrollment_student_type", [
  "new_student",
  "transferee",
  "old_student",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending_confirmation",
  "posted",
  "voided",           // Keep for backward compatibility
  "reversed",         // Original payment reversed via approval
  "reversal",         // Offsetting negative entry
  "balance_forward",  // BFX receipt: balance transferred to new school year
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "viewed",
  "settled",
  "overdue",
]);

export const gradeStatusEnum = pgEnum("grade_status", [
  "draft",
  "submitted",
  "locked",
]);

/** Grading periods (quarters) for academic year */
export const gradingPeriodEnum = pgEnum("grading_period", GRADING_PERIODS);

/** Grade sheet workflow: draft → submitted → returned/approved → released */
export const gradeSheetStatusEnum = pgEnum("grade_sheet_status", GRADE_SHEET_STATUSES);

/** Grade approval workflow actions */
export const gradeApprovalActionEnum = pgEnum("grade_approval_action", GRADE_APPROVAL_ACTIONS);

/** Grading system type: quarterly (Q1-Q4) or trimester (T1-T3) per school year */
export const gradingSystemTypeEnum = pgEnum("grading_system_type", GRADING_SYSTEM_TYPES);

/** Grade level groups for coordinator assignment */
export const gradeGroupEnum = pgEnum("grade_group", GRADE_GROUPS);

/**
 * @deprecated SHS strand codes are now stored as TEXT in strands.code for admin-managed tracks.
 * This enum is kept for backward compatibility with existing data but should not be used for new code.
 * Use strands.code (TEXT) directly instead.
 */
export const strandCodeEnum = pgEnum("strand_code", SHS_STRAND_CODES);

/** Term offering for SHS subjects (when the subject is offered within the school year) */
export const termOfferingEnum = pgEnum("term_offering", TERM_OFFERINGS);

/** Curriculum lifecycle: draft → published → archived */
export const curriculumStatusEnum = pgEnum("curriculum_status", [
  "draft",
  "published",
  "archived",
]);

export const bookletStatusEnum = pgEnum("booklet_status", [
  "active",
  "exhausted",
  "voided",
]);

/** Booklet usage mode: auto_only for cashier auto-assign, manual_only for offline reconciliation */
export const bookletUsageModeEnum = pgEnum("booklet_usage_mode", [
  "auto_only",
  "manual_only",
]);

export const orStatusEnum = pgEnum("or_status", [
  "available",
  "consumed",
  "voided",
]);

export const voidRequestStatusEnum = pgEnum("void_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const paymentKindEnum = pgEnum("payment_kind", ["payment", "reversal", "balance_forward"]);

/** Assessment ledger: balance-driven, or cancelled when enrollment is cancelled. */
export const assessmentBillingStatusEnum = pgEnum("assessment_billing_status", [
  "outstanding",
  "fully_paid",
  "cancelled",
  "balance_forwarded",  // Balance transferred to new school year via BFX receipt
]);

/** Groups grade levels for fee catalogs: Casa, elem, JHS, SHS (one schedule per band per school year). */
export const feeAssessmentBandEnum = pgEnum("fee_assessment_band", FEE_ASSESSMENT_BANDS);

/** Discount base type: what amount the discount is calculated from */
export const discountBaseTypeEnum = pgEnum("discount_base_type", [
  "tuition_only",
  "full_assessment",
]);

/** Discount calculation type: fixed amount or percentage */
export const discountCalculationTypeEnum = pgEnum("discount_calculation_type", [
  "fixed_amount",
  "percentage",
]);

/** Discount request status workflow */
export const discountRequestStatusEnum = pgEnum("discount_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "reversed",
]);

/** Enrollment cancellation reason types */
export const cancellationReasonTypeEnum = pgEnum("cancellation_reason_type", CANCELLATION_REASONS);

/** Enrollment cancellation request status workflow */
export const enrollmentCancellationRequestStatusEnum = pgEnum("enrollment_cancellation_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

/** Student status - lifecycle tracking (active, archived states) */
export const studentStatusEnum = pgEnum("student_status", STUDENT_STATUSES);

/** Document request types for student/alumni document requests */
export const documentRequestTypeEnum = pgEnum("document_request_type", DOCUMENT_REQUEST_TYPES);

/** Document request status workflow */
export const documentRequestStatusEnum = pgEnum("document_request_status", DOCUMENT_REQUEST_STATUSES);

/** Student clearance types */
export const clearanceTypeEnum = pgEnum("clearance_type", [
  "end_of_year",
  "enrollment_cancellation",
  "transfer_out",
  "graduation",
  "other",
]);

/** Clearance status */
export const clearanceStatusEnum = pgEnum("clearance_status", [
  "cleared",
  "pending",
  "waived",
]);

/** Clearance resolution types */
export const resolutionTypeEnum = pgEnum("resolution_type", [
  "paid",
  "waived",
  "written_off",
]);

// ─── Users & Sessions ─────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    forcePasswordChange: boolean("force_password_change").notNull().default(false),
    /**
     * Default OR booklet for cashiers (auto-selected in payment form).
     * FK to receiptBooklets.id via an AnyPgColumn thunk because receiptBooklets
     * is declared after users and also references users (createdBy/updatedBy) —
     * the thunk defers resolution and breaks the declaration cycle.
     */
    defaultBookletId: uuid("default_booklet_id").references(
      (): AnyPgColumn => receiptBooklets.id
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by"),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_username_idx").on(t.username),
    index("users_role_idx").on(t.role),
    // Booklet assignment is one-to-one: a booklet may be the default for at most
    // one user (enforces the exclusive-access rule in getBookletIdsAssignedToOthers).
    // Partial so multiple users may have no default booklet (NULL).
    uniqueIndex("users_default_booklet_uidx")
      .on(t.defaultBookletId)
      .where(sql`${t.defaultBookletId} IS NOT NULL`),
  ]
);

/**
 * Portal accounts for student self-service access.
 * Separate from staff `users` table for clean isolation between internal operations and external portal access.
 *
 * Login pattern:
 * - Username: Student reference number (7 digits, e.g., "0000001")
 * - Password: Date of birth in YYYYMMDD format (e.g., "20100315")
 * - Force password change on first login
 */
export const portalAccounts = pgTable(
  "portal_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Foreign key to the student this account belongs to */
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    /** Username = student reference number (e.g., "0000001") */
    username: text("username").notNull(),
    /** bcrypt password hash (cost 12) */
    passwordHash: text("password_hash").notNull(),
    /** Optional email for notifications */
    email: text("email"),
    /** Whether the account is active (can login) */
    isActive: boolean("is_active").notNull().default(true),
    /** Force password change on next login (always true for new accounts) */
    forcePasswordChange: boolean("force_password_change").notNull().default(true),
    /** Last successful login timestamp */
    lastLoginAt: timestamp("last_login_at"),
    // Audit fields
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    // One portal account per student (active records only)
    uniqueIndex("portal_accounts_student_uidx")
      .on(t.studentId)
      .where(sql`${t.deletedAt} IS NULL`),
    // Username must be globally unique
    uniqueIndex("portal_accounts_username_uidx").on(t.username),
    // Active accounts lookup (for login queries)
    index("portal_accounts_active_idx")
      .on(t.isActive)
      .where(sql`${t.isActive} = true AND ${t.deletedAt} IS NULL`),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Staff user ID (nullable - either userId OR portalAccountId must be set) */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** Portal account ID (nullable - either userId OR portalAccountId must be set) */
    portalAccountId: uuid("portal_account_id").references(() => portalAccounts.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** Last user activity time for idle timeout tracking */
    lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_idx").on(t.token),
    index("sessions_user_idx").on(t.userId),
    index("sessions_portal_account_idx").on(t.portalAccountId),
    index("sessions_expires_idx").on(t.expiresAt), // For session cleanup queries
    // Constraint: exactly one of userId or portalAccountId must be set (XOR)
    check(
      "sessions_account_type_chk",
      sql`(${t.userId} IS NOT NULL AND ${t.portalAccountId} IS NULL) OR (${t.userId} IS NULL AND ${t.portalAccountId} IS NOT NULL)`
    ),
  ]
);

// ─── School Configuration ─────────────────────────────────────────────────────

export const schoolYears = pgTable("school_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),           // e.g. "2024-2025"
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  /** Cutoff date for full payment cash discount eligibility. Payments before this date qualify. */
  cashDiscountCutoffDate: timestamp("cash_discount_cutoff_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id),
}, (t) => [
  // Enforce only one active school year at a time.
  uniqueIndex("school_year_active_uidx")
    .on(t.isActive)
    .where(sql`${t.isActive} = true`),

  // Prevent inverted date ranges.
  check("school_year_dates_order_chk", sql`${t.endDate} > ${t.startDate}`),
]);

export const gradeLevels = pgTable("grade_levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),             // e.g. "Grade 7", "Casa Junior"
  order: integer("order").notNull(),
  assessmentBand: feeAssessmentBandEnum("assessment_band").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    gradeLevelId: uuid("grade_level_id").notNull().references(() => gradeLevels.id),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
    /**
     * Track association for SHS sections (Grade 11-12).
     * When set, this section belongs to a specific track (e.g., STEM-A → STEM track).
     * Null for non-SHS sections.
     */
    strandId: uuid("strand_id").references(() => strands.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at"),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    index("sections_grade_sy_idx").on(t.gradeLevelId, t.schoolYearId),
    // Unique section name per grade level + school year (active records only)
    uniqueIndex("sections_name_grade_sy_uidx")
      .on(t.name, t.gradeLevelId, t.schoolYearId)
      .where(sql`${t.deletedAt} IS NULL`),
    // Index for strand-based section queries (SHS track sections)
    index("sections_strand_idx")
      .on(t.strandId)
      .where(sql`${t.deletedAt} IS NULL`),
  ]
);

export const curriculums = pgTable(
  "curriculums",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    status: curriculumStatusEnum("status").notNull().default("draft"),
    /** Version number within the same version chain (1, 2, 3...) */
    version: integer("version").notNull().default(1),
    /** Root of the version chain (points to the original v1 curriculum, or self for v1) */
    rootId: uuid("root_id"), // Self-reference - FK enforced in migration
    /** Predecessor version (null for v1, points to parent version for clones) */
    predecessorId: uuid("predecessor_id"), // Self-reference - FK enforced in migration
    /** @deprecated Legacy column - use curriculum_adoptions table instead */
    effectiveSchoolYearId: uuid("effective_school_year_id").references(() => schoolYears.id),
    /** Audit: when published */
    publishedAt: timestamp("published_at"),
    publishedBy: uuid("published_by").references(() => users.id),
    /** Audit: when archived */
    archivedAt: timestamp("archived_at"),
    archivedBy: uuid("archived_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [
    index("curriculums_status_idx").on(t.status),
    index("curriculums_root_idx").on(t.rootId),
    // Enforce one version number per version chain (root_id + version unique).
    uniqueIndex("curriculums_root_version_uidx").on(t.rootId, t.version),
    // Only one draft allowed per predecessor (prevents multiple parallel drafts from same source)
    uniqueIndex("curriculums_pred_draft_uidx")
      .on(t.predecessorId)
      .where(sql`${t.status} = 'draft' AND ${t.predecessorId} IS NOT NULL`),
    // Unique name within the same status (prevents duplicate draft names)
    uniqueIndex("curriculums_name_status_uidx")
      .on(t.name, t.status)
      .where(sql`${t.status} = 'draft'`),
  ]
);

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    curriculumId: uuid("curriculum_id").references(() => curriculums.id).notNull(),
    gradeLevelId: uuid("grade_level_id").references(() => gradeLevels.id),
    /**
     * Direct track ownership for SHS subjects (Grade 11-12).
     * When set, this subject belongs exclusively to this track.
     * Null for non-SHS subjects (Casa, Elementary, JHS).
     */
    strandId: uuid("strand_id").references(() => strands.id),
    /**
     * Term when this subject is offered (SHS only).
     * - full_year: Runs entire school year
     * - first_semester / second_semester: Maps to Q1-Q2 / Q3-Q4
     * - first_trimester / second_trimester / third_trimester: T1 / T2 / T3
     */
    termOffered: termOfferingEnum("term_offered").notNull().default("full_year"),
    /** Credit units for this subject (e.g., 1.0, 1.5, 3.0) */
    units: numeric("units", { precision: 4, scale: 2 }).notNull().default("0"),
    /** Display order within the grade level (for sorting subjects) */
    sequenceOrder: integer("sequence_order").notNull().default(0),
    /** Whether this is a core/required subject vs elective (used for non-SHS subjects) */
    isCore: boolean("is_core").notNull().default(true),
    /** Optional grading weight (future use for weighted averages) */
    gradingWeight: numeric("grading_weight", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    index("subjects_curriculum_idx").on(t.curriculumId),
    // Composite index for curriculum + grade level (common query pattern)
    index("subjects_curriculum_grade_idx").on(t.curriculumId, t.gradeLevelId),
    // Partial index for active subjects (soft delete optimization)
    index("subjects_active_idx")
      .on(t.id)
      .where(sql`${t.deletedAt} IS NULL`),
    // Unique subject code within curriculum (active subjects only)
    uniqueIndex("subjects_curriculum_code_uidx")
      .on(t.curriculumId, t.code)
      .where(sql`${t.deletedAt} IS NULL`),
    // Index for strand-based queries (SHS subjects by track)
    index("subjects_strand_idx")
      .on(t.strandId)
      .where(sql`${t.deletedAt} IS NULL`),
    // Composite index for curriculum + strand queries
    index("subjects_curriculum_strand_idx")
      .on(t.curriculumId, t.strandId)
      .where(sql`${t.deletedAt} IS NULL`),
  ]
);

/**
 * Curriculum adoptions bind a published curriculum to a school year + grade level.
 * Decouples curriculum from school year for proper version management.
 * One adoption per (school_year_id, grade_level_id) - enforced by unique index.
 */
export const curriculumAdoptions = pgTable(
  "curriculum_adoptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
    gradeLevelId: uuid("grade_level_id").notNull().references(() => gradeLevels.id),
    curriculumId: uuid("curriculum_id").notNull().references(() => curriculums.id),
    adoptedAt: timestamp("adopted_at").notNull().defaultNow(),
    adoptedBy: uuid("adopted_by").notNull().references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    // One curriculum adoption per grade level per school year (active records only)
    uniqueIndex("curriculum_adoptions_sy_grade_uidx")
      .on(t.schoolYearId, t.gradeLevelId)
      .where(sql`${t.deletedAt} IS NULL`),
    index("curriculum_adoptions_curriculum_idx").on(t.curriculumId),
    index("curriculum_adoptions_sy_idx").on(t.schoolYearId),
  ]
);

// ─── SHS Tracks (formerly Strands) ────────────────────────────────────────────

/**
 * SHS Academic Tracks - admin-managed tracks for Senior High School.
 * Each track owns ALL its subjects directly (subjects.strandId → strands.id).
 *
 * Standard tracks: STEM, ABM, HUMSS, GAS, TVL-ICT, TVL-HE, TVL-IA, TVL-AFA
 * Custom tracks can be added via admin UI (e.g., MAHS, EA, BAE)
 *
 * Track categories:
 * - academic: STEM, ABM, HUMSS, GAS, custom academic tracks
 * - tvl: TVL-ICT, TVL-HE, TVL-IA, TVL-AFA, custom TVL tracks
 * - specialized: Sports, Arts, other specialized tracks
 */
export const strands = pgTable(
  "strands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Full track code (e.g., "STEM", "TVL-ICT", "MAHS") - now TEXT for admin-managed codes */
    code: text("code").notNull(),
    /** Short code for UI badges (e.g., "STEM", "ICT" for TVL-ICT) */
    shortCode: text("short_code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** Track category: academic, tvl, or specialized */
    trackCategory: text("track_category").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    // Unique strand code (active records only)
    uniqueIndex("strands_code_uidx")
      .on(t.code)
      .where(sql`${t.deletedAt} IS NULL`),
    // Unique short code (active records only)
    uniqueIndex("strands_short_code_uidx")
      .on(t.shortCode)
      .where(sql`${t.deletedAt} IS NULL`),
    index("strands_active_idx")
      .on(t.isActive)
      .where(sql`${t.isActive} = true AND ${t.deletedAt} IS NULL`),
    index("strands_display_order_idx").on(t.displayOrder),
    // Check constraint for track_category values
    check("strands_track_category_chk", sql`${t.trackCategory} IN ('academic', 'tvl', 'specialized')`),
  ]
);

/**
 * Subject-Strand associations - links subjects to applicable strands.
 * Core subjects have no strand links (available to all).
 * Elective subjects link to strands they're available to.
 */
export const subjectStrands = pgTable(
  "subject_strands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    strandId: uuid("strand_id").notNull().references(() => strands.id, { onDelete: "cascade" }),
    /** Whether this subject is required (core) for this strand, vs optional elective */
    isStrandCore: boolean("is_strand_core").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    // Unique subject-strand pair (active records only)
    uniqueIndex("subject_strands_subject_strand_uidx")
      .on(t.subjectId, t.strandId)
      .where(sql`${t.deletedAt} IS NULL`),
    index("subject_strands_subject_idx").on(t.subjectId),
    index("subject_strands_strand_idx").on(t.strandId),
  ]
);

// ─── Students & Parents ───────────────────────────────────────────────────────

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referenceNumber: text("reference_number").notNull(),
    lrn: text("lrn").unique(),
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    lastName: text("last_name").notNull(),
    suffix: text("suffix"),
    dateOfBirth: timestamp("date_of_birth"),
    gender: text("gender"),
    address: text("address"),
    mobileNumber: text("mobile_number"),
    email: text("email"),
    nationality: text("nationality"),
    bloodType: text("blood_type"),
    religion: text("religion"),
    /** Prior school name; required workflow-wise for transferees per enrollment skill. */
    previousSchool: text("previous_school"),
    /** Free-text notes on submitted documents (reports, certs, etc.). */
    submittedDocumentsNotes: text("submitted_documents_notes"),
    /** URL path to student profile photo (e.g., /uploads/students/0000001.webp). */
    photoUrl: text("photo_url"),
    userId: uuid("user_id").references(() => users.id),   // linked portal account
    isActive: boolean("is_active").notNull().default(true),
    /** Student lifecycle status: active, graduated, transferred, withdrawn, cancelled, inactive */
    status: studentStatusEnum("status").notNull().default("active"),
    /** Timestamp when student was archived (status changed from active) */
    archivedAt: timestamp("archived_at"),
    /** User who archived the student */
    archivedBy: uuid("archived_by").references(() => users.id),
    /** Reason for archiving the student */
    archiveReason: text("archive_reason"),
    /** School year when the student was archived (for EOY batch operations) */
    archivedSchoolYearId: uuid("archived_school_year_id").references(() => schoolYears.id),
    /** Whether this student requires Special Education (SPED) services */
    isSpecialEducation: boolean("is_special_education").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("students_ref_idx").on(t.referenceNumber),
    index("students_name_idx").on(t.lastName, t.firstName),
    index("students_status_idx").on(t.status),
    // Archive query performance indexes (added for production Docker optimization)
    index("students_archived_at_idx").on(t.archivedAt),
    index("students_archive_sy_status_idx").on(t.archivedSchoolYearId, t.status),
    // NOTE: Additional indexes created via migration 0010:
    // - students_name_dob_active_uidx: UNIQUE(LOWER(first_name), LOWER(last_name), date_of_birth) WHERE deleted_at IS NULL
    // - students_name_dob_lookup_idx: INDEX for duplicate detection queries
  ]
);

export const parentsGuardians = pgTable(
  "parents_guardians",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    lastName: text("last_name").notNull(),
    relationship: text("relationship").notNull(),
    address: text("address").notNull(),
    occupation: text("occupation"),
    contactNumber: text("contact_number").notNull(),
    email: text("email").notNull(),
    userId: uuid("user_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    index("pg_name_idx").on(t.lastName, t.firstName),
    index("pg_email_idx").on(t.email), // For portal login lookups
    // Partial index for active parents/guardians (soft delete optimization)
    index("pg_deleted_at_idx")
      .on(t.deletedAt)
      .where(sql`${t.deletedAt} IS NULL`),
  ]
);

export const studentGuardianLinks = pgTable(
  "student_guardian_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    guardianId: uuid("guardian_id").notNull().references(() => parentsGuardians.id),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    index("sgl_student_idx").on(t.studentId),
    index("student_guardian_links_guardian_idx").on(t.guardianId), // PERFORMANCE: Parent portal reverse lookups
  ]
);

// ─── Registration & Enrollment ────────────────────────────────────────────────

/** Intake document checklist captured at registration (new/transferee) and on enrollment. */
export type EnrollmentIntakeDocuments = {
  form138: "received" | "not_applicable" | "to_follow";
  birthCertificatePsa: "received" | "not_applicable" | "to_follow";
  goodMoralCharacter: "received" | "not_applicable" | "to_follow";
  qualifiedVoucher: "received" | "not_applicable" | "to_follow";
  escCertificate: "received" | "not_applicable" | "to_follow";
};

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
    gradeLevelId: uuid("grade_level_id").notNull().references(() => gradeLevels.id),
    studentType: enrollmentStudentTypeEnum("student_type").notNull().default("new_student"),
    intakeDocuments: jsonb("intake_documents").$type<EnrollmentIntakeDocuments | null>(),
    status: registrationStatusEnum("status").notNull().default("pending"),
    remarks: text("remarks"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [
    index("reg_student_sy_idx").on(t.studentId, t.schoolYearId),
    index("reg_status_idx").on(t.status),
    index("reg_sy_status_idx").on(t.schoolYearId, t.status), // MEMORY OPTIMIZATION: Composite index for enrollment queue
    // NOTE: Additional constraint created via migration 0010:
    // - registrations_student_sy_active_uidx: UNIQUE(student_id, school_year_id) WHERE status != 'rejected'
  ]
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
    gradeLevelId: uuid("grade_level_id").notNull().references(() => gradeLevels.id),
    sectionId: uuid("section_id").references(() => sections.id),
    registrationId: uuid("registration_id").references(() => registrations.id),
    /** SHS strand for senior high school students (Grade 11-12). Nullable for non-SHS. */
    strandId: uuid("strand_id").references(() => strands.id),
    /** NEW_STUDENT | TRANSFEREE | OLD_STUDENT workflow classification. */
    studentType: enrollmentStudentTypeEnum("student_type").notNull().default("new_student"),
    /** Required for new_student / transferee enrollments; null for old_student or legacy rows. */
    intakeDocuments: jsonb("intake_documents").$type<EnrollmentIntakeDocuments | null>(),
    status: enrollmentStatusEnum("status").notNull().default("pending"),
    /**
     * Override the student's default SPED status for this enrollment.
     * - null: Inherit from student.isSpecialEducation
     * - true: Force SPED status for this enrollment
     * - false: Force non-SPED status for this enrollment
     */
    specialEducationOverride: boolean("special_education_override"),
    enrolledAt: timestamp("enrolled_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancelRemarks: text("cancel_remarks"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("enrollment_unique_sy_idx")
      .on(t.studentId, t.schoolYearId)
      .where(sql`status != 'cancelled'`),
    index("enrollment_status_idx").on(t.status),
    index("enrollment_sy_status_idx").on(t.schoolYearId, t.status), // MEMORY OPTIMIZATION: Composite index for enrollment queue
    index("enrollment_student_sy_status_idx").on(t.studentId, t.schoolYearId, t.status), // MEMORY OPTIMIZATION: For old student lookups
    index("enrollment_sy_status_created_idx").on(t.schoolYearId, t.status, t.createdAt), // PERFORMANCE: Queue sorting by creation date
  ]
);

// ─── Fee Schedules ────────────────────────────────────────────────────────────

export const feeSchedules = pgTable("fee_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
  /** Optional legacy column; unused for banded resolution. */
  gradeLevelId: uuid("grade_level_id").references(() => gradeLevels.id),
  /** Null = legacy school-wide catalog for that school year (fallback when no band-specific schedule exists). */
  assessmentBand: feeAssessmentBandEnum("assessment_band"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
}, (t) => [
  uniqueIndex("fee_schedule_sy_band_uidx")
    .on(t.schoolYearId, t.assessmentBand)
    .where(sql`${t.assessmentBand} IS NOT NULL`),
  uniqueIndex("fee_schedule_sy_legacy_uidx")
    .on(t.schoolYearId)
    .where(sql`${t.assessmentBand} IS NULL`),
]);

export const feeScheduleItems = pgTable("fee_schedule_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  feeScheduleId: uuid("fee_schedule_id").notNull().references(() => feeSchedules.id, { onDelete: "restrict" }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  isDiscount: boolean("is_discount").notNull().default(false),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

// ─── Fee Templates (Reusable Fee Structures) ─────────────────────────────

/** Master fee type definitions - ensures consistency across all templates */
export const feeItemTypesCategoryEnum = pgEnum("fee_item_type_category", [
  "tuition",
  "fees",
  "materials",
  "discount",
  "other",
]);

export const feeItemTypes = pgTable("fee_item_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: feeItemTypesCategoryEnum("category").notNull(),
  isDiscount: boolean("is_discount").notNull().default(false),
  /** Whether payments to this fee type can be refunded on enrollment cancellation */
  isRefundable: boolean("is_refundable").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
}, (t) => [
  uniqueIndex("fee_item_types_code_uidx").on(t.code),
  index("fee_item_types_category_idx").on(t.category),
  index("fee_item_types_active_idx").on(t.isActive).where(sql`${t.isActive} = true`),
]);

/** Reusable fee templates per assessment band */
export const feeTemplates = pgTable("fee_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  assessmentBand: feeAssessmentBandEnum("assessment_band").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id),
}, (t) => [
  index("fee_templates_band_idx").on(t.assessmentBand),
  index("fee_templates_active_idx").on(t.isActive).where(sql`${t.isActive} = true`),
]);

/** Template items link fee types to default amounts */
export const feeTemplateItems = pgTable("fee_template_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  feeTemplateId: uuid("fee_template_id")
    .notNull()
    .references(() => feeTemplates.id, { onDelete: "restrict" }),
  feeItemTypeId: uuid("fee_item_type_id")
    .notNull()
    .references(() => feeItemTypes.id),
  defaultAmount: numeric("default_amount", { precision: 12, scale: 2 }).notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id),
}, (t) => [
  index("fee_template_items_template_idx").on(t.feeTemplateId),
  index("fee_template_items_type_idx").on(t.feeItemTypeId),
  uniqueIndex("fee_template_items_template_type_uidx").on(t.feeTemplateId, t.feeItemTypeId),
]);

/** Links templates to school years with effective dates */
export const schoolYearFeeSchedules = pgTable("school_year_fee_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolYearId: uuid("school_year_id")
    .notNull()
    .references(() => schoolYears.id, { onDelete: "restrict" }),
  assessmentBand: feeAssessmentBandEnum("assessment_band").notNull(),
  feeTemplateId: uuid("fee_template_id")
    .notNull()
    .references(() => feeTemplates.id),
  effectiveDate: timestamp("effective_date").notNull(),
  expiryDate: timestamp("expiry_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
}, (t) => [
  uniqueIndex("syfs_sy_band_active_uidx")
    .on(t.schoolYearId, t.assessmentBand)
    .where(sql`${t.isActive} = true`),
  index("syfs_sy_band_idx").on(t.schoolYearId, t.assessmentBand),
  index("syfs_effective_idx").on(t.effectiveDate),
  check("syfs_dates_chk", sql`${t.expiryDate} IS NULL OR ${t.expiryDate} > ${t.effectiveDate}`),
]);

/** Year-specific amount adjustments without duplicating entire schedules */
export const feeScheduleOverrides = pgTable("fee_schedule_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  scheduleId: uuid("schedule_id")
    .notNull()
    .references(() => schoolYearFeeSchedules.id, { onDelete: "restrict" }),
  feeTemplateItemId: uuid("fee_template_item_id")
    .notNull()
    .references(() => feeTemplateItems.id),
  overrideAmount: numeric("override_amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
}, (t) => [
  uniqueIndex("fso_schedule_item_uidx").on(t.scheduleId, t.feeTemplateItemId),
  index("fso_schedule_idx").on(t.scheduleId),
  index("fso_template_item_idx").on(t.feeTemplateItemId), // For reverse lookups
]);

// ─── Assessments (Billing) ────────────────────────────────────────────────────

// NOTE: Drizzle/TypeScript cannot type self-referencing FKs in object style. FK is enforced in migration only.
  // NOTE: Drizzle/TypeScript cannot type self-referencing FKs in object style. FK is enforced in migration only.
  export const assessments = pgTable(
    "assessments",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id),
      studentId: uuid("student_id").notNull().references(() => students.id),
      schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
      totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
      totalPaid: numeric("total_paid", { precision: 12, scale: 2 }).notNull().default("0"),
      totalDiscounts: numeric("total_discounts", { precision: 12, scale: 2 }).notNull().default("0"),
      balance: numeric("balance", { precision: 12, scale: 2 }).notNull(),
      hasDiscountsPending: boolean("has_discounts_pending").notNull().default(false),
      billingStatus: assessmentBillingStatusEnum("billing_status")
        .notNull()
        .default("outstanding"),
      remarks: text("remarks"),
      /** Set when the linked enrollment is cancelled — blocks new payments on this ledger. */
      cancelledAt: timestamp("cancelled_at"),
      cancelledBy: uuid("cancelled_by").references(() => users.id),
      /** Balance transfer tracking: Set when this assessment's balance is carried forward to a new school year */
      transferredAt: timestamp("transferred_at"),
      transferredBy: uuid("transferred_by").references(() => users.id),
      transferredToAssessmentId: uuid("transferred_to_assessment_id"), // See migration for FK
      transferRemarks: text("transfer_remarks"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      createdBy: uuid("created_by").references(() => users.id),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      updatedBy: uuid("updated_by").references(() => users.id),
    },
    (t) => [
      index("assessment_student_sy_idx").on(t.studentId, t.schoolYearId),
      uniqueIndex("assessments_enrollment_id_uidx")
      .on(t.enrollmentId)
      .where(sql`cancelled_at IS NULL`),
      index("assessments_billing_status_idx").on(t.billingStatus), // PERFORMANCE: Outstanding balance queries
      index("assessments_student_billing_idx").on(t.studentId, t.billingStatus), // PERFORMANCE: Student balance lookups
      index("assessments_transferred_at_idx").on(t.transferredAt), // PERFORMANCE: Filter active assessments (WHERE transferredAt IS NULL)
      // PERFORMANCE: Finance reports by school year + billing status
      index("assessments_sy_billing_idx").on(t.schoolYearId, t.billingStatus),
      // PERFORMANCE: Outstanding balance lookup for finance dashboard (audit 2026-07)
      index("assessments_sy_outstanding_idx")
        .on(t.schoolYearId, t.billingStatus, t.balance)
        .where(sql`${t.cancelledAt} IS NULL AND ${t.transferredAt} IS NULL`),
      // DB-level: All transfer fields must be NULL or all NOT NULL
      check(
        "assessments_transfer_fields_atomic",
        sql`
          ((
            ${t.transferredAt} IS NULL AND
            ${t.transferredBy} IS NULL AND
            ${t.transferredToAssessmentId} IS NULL
          ) OR (
            ${t.transferredBy} IS NOT NULL AND
            ${t.transferredToAssessmentId} IS NOT NULL
          ))`
      ),
    ]
  );

export const assessmentItems = pgTable(
  "assessment_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "restrict" }),
    /** Legacy: References old fee_schedule_items (will be migrated to feeTemplateItemId) */
    feeScheduleItemId: uuid("fee_schedule_item_id").references(() => feeScheduleItems.id),
    /** New: References fee_template_items for audit trail */
    feeTemplateItemId: uuid("fee_template_item_id").references(() => feeTemplateItems.id),
    /** New: References fee_item_types for reporting/analytics */
    feeItemTypeId: uuid("fee_item_type_id").references(() => feeItemTypes.id),
    /** Snapshot: Fee description from fee_item_types.name at time of assessment */
    description: text("description").notNull(),
    /** Snapshot: Resolved amount (includes overrides) at time of assessment */
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    /** Snapshot: Discount flag from fee_item_types.isDiscount at time of assessment */
    isDiscount: boolean("is_discount").notNull().default(false),
    /** Snapshot: Refundability flag from fee_item_types.isRefundable at time of assessment */
    isRefundable: boolean("is_refundable").notNull().default(true),
    /** Balance forward tracking: Links to the source assessment when this item is a "Balance Forward" line */
    sourceAssessmentId: uuid("source_assessment_id").references(() => assessments.id),
    /** Links to the student discount record that generated this line item (for discount lines) */
    studentDiscountId: uuid("student_discount_id"), // FK added after studentDiscounts table defined
    /**
     * Flag indicating this is a cascade adjustment item.
     * Cascade adjustments are created when cash discount triggers recalculation
     * of existing tuition_only discounts. This adds back the difference.
     */
    isCascadeAdjustment: boolean("is_cascade_adjustment").notNull().default(false),
    /**
     * Links to the original discount assessment item that this adjustment offsets.
     * For cascade adjustments, points to the original scholarship discount line
     * whose effective value was reduced by cascading.
     */
    adjustsItemId: uuid("adjusts_item_id"), // Self-reference to assessmentItems
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [
    index("ai_assessment_idx").on(t.assessmentId),
    index("ai_fee_item_type_idx").on(t.feeItemTypeId),
    index("ai_fee_template_item_idx").on(t.feeTemplateItemId),
    index("ai_source_assessment_idx").on(t.sourceAssessmentId), // PERFORMANCE: Reverse lookup for balance forward items
    index("ai_student_discount_idx").on(t.studentDiscountId), // PERFORMANCE: Discount line lookups
    index("ai_cascade_adjustment_idx")
      .on(t.adjustsItemId)
      .where(sql`${t.isCascadeAdjustment} = true`), // PERFORMANCE: Cascade adjustment lookup
  ]
);

// ─── Payments ─────────────────────────────────────────────────────────────────

export const receiptBooklets = pgTable(
  "receipt_booklets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    series: text("series").notNull(),
    /** Printed/stored before sequence: stored OR = `${prefix} ${paddedNo}` (e.g. AP 00050). */
    prefix: text("prefix").notNull(),
    startNumber: integer("start_number").notNull(),
    endNumber: integer("end_number").notNull(),
    nextNumber: integer("next_number").notNull(),
    status: bookletStatusEnum("status").notNull().default("active"),
    /** Usage mode: auto_only for cashier auto-assign dropdown, manual_only for offline reconciliation */
    usageMode: bookletUsageModeEnum("usage_mode").notNull().default("auto_only"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [
    index("booklet_status_idx").on(t.status),
    index("receipt_booklets_status_active_idx")
      .on(t.status)
      .where(sql`${t.status} = 'active'`), // PERFORMANCE: Payment processing active booklet lookups
    // PERFORMANCE: Active booklet lookup by usage mode (audit 2026-07)
    index("booklets_active_usage_idx")
      .on(t.status, t.usageMode)
      .where(sql`${t.status} = 'active'`),
  ]
);

// ─── Void Requests (Approval-based payment voiding) ───────────────────────────

/**
 * Void requests capture requests to void/reverse a posted payment.
 * Cashiers/registrars create requests; admins approve/reject.
 * Approved requests create a reversal payment entry (offsetting negative amount).
 */
export const voidRequests = pgTable(
  "void_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The payment being requested to void */
    paymentId: uuid("payment_id").notNull(), // FK added after payments table defined
    /** Reason provided by the requester */
    requestReason: text("request_reason").notNull(),
    status: voidRequestStatusEnum("status").notNull().default("pending"),
    /** User who submitted the void request */
    requestedBy: uuid("requested_by").notNull().references(() => users.id),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    /** Admin who approved/rejected */
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at"),
    /** Remarks from the approver/rejecter */
    decisionRemarks: text("decision_remarks"),
    /** When the requester cancelled their own request */
    cancelledAt: timestamp("cancelled_at"),
    /** The reversal payment created upon approval */
    reversalPaymentId: uuid("reversal_payment_id"), // FK added after payments table defined
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Only one pending request per payment at a time
    uniqueIndex("void_requests_payment_pending_uidx")
      .on(t.paymentId)
      .where(sql`${t.status} = 'pending'`),
    index("void_requests_status_idx").on(t.status),
    index("void_requests_payment_idx").on(t.paymentId),
    index("void_requests_requested_by_idx").on(t.requestedBy),
    index("void_requests_pending_status_idx")
      .on(t.status)
      .where(sql`${t.status} = 'pending'`), // PERFORMANCE: Admin inbox queries
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    assessmentId: uuid("assessment_id").references(() => assessments.id),
    // Booklet and OR number are nullable for reversal entries (reversals don't consume an OR)
    bookletId: uuid("booklet_id").references(() => receiptBooklets.id),
    orNumber: text("or_number"),
    orStatus: orStatusEnum("or_status").notNull().default("consumed"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: text("payment_method").notNull(),  // cash, check, gcash, etc.
    referenceNumber: text("reference_number"),
    paymentDate: timestamp("payment_date").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending_confirmation"),
    remarks: text("remarks"),
    /**
     * Client-generated key (UUID per form mount) that makes payment posting
     * idempotent: a retried submit with the same key returns the original
     * payment instead of consuming a second OR (audit finding F7).
     */
    idempotencyKey: text("idempotency_key"),
    // Void-related fields (legacy direct void - kept for backward compatibility)
    voidedAt: timestamp("voided_at"),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidReason: text("void_reason"),
    // Reversal workflow fields (new approval-based system)
    kind: paymentKindEnum("kind").notNull().default("payment"),
    /** For reversal rows: points to the original payment being offset */
    reversesPaymentId: uuid("reverses_payment_id").references((): AnyPgColumn => payments.id),
    /** For original payments: when it was reversed via approval */
    reversedAt: timestamp("reversed_at"),
    reversedBy: uuid("reversed_by").references(() => users.id),
    /** Links to the void request that triggered this reversal */
    reversedByRequestId: uuid("reversed_by_request_id"), // FK added after voidRequests table
    /** Manual entry flag: true when payment was entered retroactively from offline receipt */
    isManualEntry: boolean("is_manual_entry").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    // OR-tracking invariant: whenever OR is marked consumed, the OR number must exist.
    check(
      "payments_or_number_required_when_consumed",
      sql`(${t.orStatus} <> 'consumed' OR ${t.orNumber} IS NOT NULL)`,
    ),
    // Unique OR number index - partial to exclude NULL (reversal rows have no OR number)
    uniqueIndex("payments_or_number_idx")
      .on(t.orNumber)
      .where(sql`${t.orNumber} IS NOT NULL`),
    uniqueIndex("payments_reference_number_unique_idx")
      .on(t.referenceNumber)
      .where(sql`${t.referenceNumber} is not null`),
    // Idempotent posting: replays with the same client key map to one payment.
    uniqueIndex("payments_idempotency_key_uidx")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
    index("payments_student_idx").on(t.studentId),
    index("payments_status_idx").on(t.status),
    index("payments_date_idx").on(t.paymentDate),
    index("payments_student_date_idx").on(t.studentId, t.paymentDate), // PERFORMANCE: Student payment history queries
    index("payments_assessment_status_idx").on(t.assessmentId, t.status), // PERFORMANCE: Assessment reconciliation
    index("payments_reverses_payment_idx").on(t.reversesPaymentId), // PERFORMANCE: Reversal lookups
    index("payments_kind_idx").on(t.kind), // PERFORMANCE: Filter payment vs reversal
    index("payments_booklet_idx").on(t.bookletId), // PERFORMANCE: Consumed-OR lookups per booklet (manual entry suggestions)
    // PERFORMANCE: Daily reconciliation queries (posted payments by date)
    index("payments_posted_date_idx")
      .on(t.paymentDate)
      .where(sql`${t.status} = 'posted'`),
    // PERFORMANCE: Payment reconciliation by date + method (audit 2026-07)
    index("payments_date_method_posted_idx")
      .on(t.paymentDate, t.paymentMethod)
      .where(sql`${t.status} = 'posted'`),
    // PERFORMANCE: Active (non-deleted) payment queries
    index("payments_active_idx")
      .on(t.studentId, t.assessmentId)
      .where(sql`${t.deletedAt} IS NULL`),
  ]
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "restrict" }),
    assessmentItemId: uuid("assessment_item_id").references(() => assessmentItems.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("pa_payment_idx").on(t.paymentId),
  ]
);

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    assessmentId: uuid("assessment_id").references(() => assessments.id),
    invoiceNumber: text("invoice_number").notNull(),
    amountDue: numeric("amount_due", { precision: 12, scale: 2 }).notNull(),
    dueDate: timestamp("due_date"),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    sentAt: timestamp("sent_at"),
    sentBy: uuid("sent_by").references(() => users.id),
    lastSentAt: timestamp("last_sent_at"),
    sentCount: integer("sent_count").default(0),
    viewedAt: timestamp("viewed_at"),
    settledAt: timestamp("settled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("invoices_number_idx").on(t.invoiceNumber),
    index("invoices_student_idx").on(t.studentId),
    index("invoices_status_idx").on(t.status),
  ]
);

// ─── Teacher Assignments & Grades ─────────────────────────────────────────────

export const teacherAssignments = pgTable(
  "teacher_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id").notNull().references(() => users.id),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id),
    sectionId: uuid("section_id").notNull().references(() => sections.id),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("ta_unique_idx")
      .on(t.teacherId, t.subjectId, t.sectionId, t.schoolYearId)
      // Allow re-creating the same assignment after soft-delete.
      .where(sql`${t.deletedAt} is null`),
    index("ta_teacher_idx").on(t.teacherId),
    index("ta_subject_idx").on(t.subjectId),
    // Partial index for active assignments (soft delete optimization)
    index("ta_active_idx")
      .on(t.teacherId)
      .where(sql`${t.deletedAt} IS NULL`),
    // PERFORMANCE: Grade encoding queries by section + school year
    index("ta_section_sy_idx").on(t.sectionId, t.schoolYearId),
    // PERFORMANCE: Admin assignment queries by school year
    index("ta_school_year_idx").on(t.schoolYearId),
  ]
);

export const gradeRecords = pgTable(
  "grade_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    teacherAssignmentId: uuid("teacher_assignment_id").notNull().references(() => teacherAssignments.id),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
    gradingPeriod: text("grading_period").notNull(),  // "Q1", "Q2", "Q3", "Q4"
    grade: numeric("grade", { precision: 5, scale: 2 }),
    status: gradeStatusEnum("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at"),
    submittedBy: uuid("submitted_by").references(() => users.id),
    lockedAt: timestamp("locked_at"),
    lockedBy: uuid("locked_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("gr_unique_idx").on(t.studentId, t.teacherAssignmentId, t.gradingPeriod),
    index("gr_teacher_assignment_idx").on(t.teacherAssignmentId),
    index("gr_student_idx").on(t.studentId),
    index("gr_status_idx").on(t.status),
    index("grade_records_teacher_status_period_idx").on(t.teacherAssignmentId, t.status, t.gradingPeriod), // PERFORMANCE: Grade submission workflow queries
  ]
);

// ─── Subject Offerings ────────────────────────────────────────────────────────

/**
 * Subject offerings - operational layer between curriculum and grading.
 * Tracks subjects offered per section per school year with optional teacher assignment.
 * Enables:
 * - SHS strand-specific subject availability
 * - Teacher assignment per section+subject
 * - Student-subject enrollment traceability
 */
export const subjectOfferings = pgTable(
  "subject_offerings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id").notNull().references(() => sections.id),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
    /** Optional teacher assignment - can be assigned later */
    teacherId: uuid("teacher_id").references(() => users.id),
    /** Optional strand for SHS strand-specific subjects */
    strandId: uuid("strand_id").references(() => strands.id),
    /** Source curriculum for manually added offerings (null = from adopted curriculum) */
    sourceCurriculumId: uuid("source_curriculum_id").references(() => curriculums.id),
    /** Term when this subject is offered (SHS only) - defaults to full year */
    termOffered: termOfferingEnum("term_offered").notNull().default("full_year"),
    isActive: boolean("is_active").notNull().default(true),
    /** Display order for subject list */
    sequenceOrder: integer("sequence_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    // Unique subject offering per section + school year (active records only)
    uniqueIndex("subject_offerings_section_subject_sy_uidx")
      .on(t.sectionId, t.subjectId, t.schoolYearId)
      .where(sql`${t.deletedAt} IS NULL`),
    index("subject_offerings_section_idx").on(t.sectionId),
    index("subject_offerings_subject_idx").on(t.subjectId),
    index("subject_offerings_teacher_idx").on(t.teacherId),
    index("subject_offerings_strand_idx").on(t.strandId),
    index("subject_offerings_sy_idx").on(t.schoolYearId),
    // Active offerings for section
    index("subject_offerings_section_active_idx")
      .on(t.sectionId)
      .where(sql`${t.isActive} = true AND ${t.deletedAt} IS NULL`),
  ]
);

/**
 * Student subject enrollments - explicit link between students and subject offerings.
 * Created when student is assigned to a section.
 * Enables grade sheet traceability to specific student-subject enrollment.
 */
export const studentSubjectEnrollments = pgTable(
  "student_subject_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id),
    subjectOfferingId: uuid("subject_offering_id").notNull().references(() => subjectOfferings.id),
    /** Denormalized for query performance */
    studentId: uuid("student_id").notNull().references(() => students.id),
    /** Denormalized for query performance */
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
    isActive: boolean("is_active").notNull().default(true),
    /** Withdrawal tracking */
    withdrawnAt: timestamp("withdrawn_at"),
    withdrawnBy: uuid("withdrawn_by").references(() => users.id),
    withdrawalReason: text("withdrawal_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    // Unique enrollment + offering (active records only)
    uniqueIndex("sse_enrollment_offering_uidx")
      .on(t.enrollmentId, t.subjectOfferingId)
      .where(sql`${t.isActive} = true AND ${t.deletedAt} IS NULL`),
    index("sse_enrollment_idx").on(t.enrollmentId),
    index("sse_offering_idx").on(t.subjectOfferingId),
    index("sse_student_idx").on(t.studentId),
    index("sse_school_year_idx").on(t.schoolYearId),
    // Student's active subject enrollments
    index("sse_student_active_idx")
      .on(t.studentId)
      .where(sql`${t.isActive} = true AND ${t.deletedAt} IS NULL`),
    // School year active enrollments for reporting
    index("sse_sy_active_idx")
      .on(t.schoolYearId)
      .where(sql`${t.isActive} = true AND ${t.deletedAt} IS NULL`),
  ]
);

// ─── Section Advisers ─────────────────────────────────────────────────────────

/**
 * Section adviser assignments - one homeroom adviser per section per school year.
 * Different from teacherAssignments which tracks subject teachers.
 */
export const sectionAdvisers = pgTable(
  "section_advisers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id").notNull().references(() => sections.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),

    // Audit
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    // One adviser per section per school year (soft delete aware)
    uniqueIndex("section_advisers_section_sy_uidx")
      .on(t.sectionId, t.schoolYearId)
      .where(sql`${t.deletedAt} IS NULL`),
    index("section_advisers_user_idx").on(t.userId),
    index("section_advisers_sy_idx").on(t.schoolYearId),
  ]
);

// ─── Grade Sheets & Approval Workflow ─────────────────────────────────────────

/**
 * Grade sheets - batch grade submission per section per grading period.
 * Adviser enters ALL subject grades for their section students.
 * Tracks workflow status: draft → submitted → principal_approved → published → locked.
 * Can be returned at any stage for corrections.
 */
export const gradeSheets = pgTable(
  "grade_sheets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id").notNull().references(() => sections.id),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
    adviserId: uuid("adviser_id").references(() => users.id),
    gradingPeriod: gradingPeriodEnum("grading_period").notNull(),
    status: gradeSheetStatusEnum("status").notNull().default("draft"),

    // Workflow timestamps - submission
    submittedAt: timestamp("submitted_at"),
    submittedBy: uuid("submitted_by").references(() => users.id),

    // Workflow timestamps - principal review
    principalApprovedAt: timestamp("principal_approved_at"),
    principalApprovedBy: uuid("principal_approved_by").references(() => users.id),

    // Workflow timestamps - publishing
    publishedAt: timestamp("published_at"),
    publishedBy: uuid("published_by").references(() => users.id),

    // Workflow timestamps - locking
    lockedAt: timestamp("locked_at"),
    lockedBy: uuid("locked_by").references(() => users.id),

    // Workflow timestamps - return
    returnedAt: timestamp("returned_at"),
    returnedBy: uuid("returned_by").references(() => users.id),
    returnRemarks: text("return_remarks"),

    // Audit
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [
    // One sheet per section per school year per grading period
    uniqueIndex("grade_sheets_section_sy_period_uidx")
      .on(t.sectionId, t.schoolYearId, t.gradingPeriod),
    index("grade_sheets_status_idx").on(t.status),
    index("grade_sheets_sy_status_idx").on(t.schoolYearId, t.status),
    index("grade_sheets_adviser_idx").on(t.adviserId),
    // PERFORMANCE: Principal review queue (audit 2026-07)
    index("grade_sheets_pending_review_idx")
      .on(t.schoolYearId, t.status, t.submittedAt)
      .where(sql`${t.status} = 'submitted'`),
  ]
);

/**
 * Grade sheet entries - individual student grades per subject within a grade sheet.
 * Advisers enter quarterly grades for all subjects for their section students.
 */
export const gradeSheetEntries = pgTable(
  "grade_sheet_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gradeSheetId: uuid("grade_sheet_id").notNull().references(() => gradeSheets.id),
    studentId: uuid("student_id").notNull().references(() => students.id),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id),
    /**
     * Link to student subject enrollment for traceability.
     * Nullable during migration - will be populated for new entries.
     * @deprecated studentId + subjectId kept for backward compatibility during migration
     */
    studentSubjectEnrollmentId: uuid("student_subject_enrollment_id").references(
      () => studentSubjectEnrollments.id
    ),

    // Direct quarterly grade entry (no computation)
    // DepEd transmutation range: 60-100
    grade: numeric("grade", { precision: 5, scale: 2 }),
    remarks: text("remarks"), // Teacher remarks (optional)

    // Audit
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // One entry per student per subject per grade sheet
    uniqueIndex("grade_sheet_entries_sheet_student_subject_uidx")
      .on(t.gradeSheetId, t.studentId, t.subjectId),
    index("grade_sheet_entries_student_idx").on(t.studentId),
    index("grade_sheet_entries_subject_idx").on(t.subjectId),
    index("grade_sheet_entries_sse_idx").on(t.studentSubjectEnrollmentId),
    // Partial index for grade completeness queries (entries with grades filled)
    index("grade_sheet_entries_filled_idx")
      .on(t.gradeSheetId)
      .where(sql`${t.grade} IS NOT NULL`),
  ]
);

/**
 * Grade approvals - audit trail of approval workflow actions.
 * Records every status transition with actor, timestamp, and remarks.
 */
export const gradeApprovals = pgTable(
  "grade_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gradeSheetId: uuid("grade_sheet_id").notNull().references(() => gradeSheets.id),
    action: gradeApprovalActionEnum("action").notNull(),
    remarks: text("remarks"),

    // Actor
    actorId: uuid("actor_id").notNull().references(() => users.id),
    actorRole: roleEnum("actor_role").notNull(),

    // Timestamp
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("grade_approvals_sheet_idx").on(t.gradeSheetId),
    index("grade_approvals_actor_idx").on(t.actorId),
    index("grade_approvals_created_idx").on(t.createdAt),
  ]
);

// ─── Grading Period Systems ──────────────────────────────────────────────────

/**
 * Grading period system configuration per school year.
 * Determines whether the school uses quarterly (Q1-Q4) or trimester (T1-T3) for that year.
 */
export const gradingPeriodSystems = pgTable(
  "grading_period_systems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
    systemType: gradingSystemTypeEnum("system_type").notNull(),

    // Audit
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [
    // One grading system per school year
    uniqueIndex("grading_period_systems_sy_uidx").on(t.schoolYearId),
  ]
);

// ─── Coordinator Assignments ─────────────────────────────────────────────────

/**
 * Coordinator assignments - assigns coordinators to grade level groups.
 * Coordinators review grade sheet submissions for their assigned groups.
 */
export const coordinatorAssignments = pgTable(
  "coordinator_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    gradeGroup: gradeGroupEnum("grade_group").notNull(),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),

    // Audit
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    // One coordinator per grade group per school year (soft delete aware)
    uniqueIndex("coordinator_assignments_group_sy_uidx")
      .on(t.gradeGroup, t.schoolYearId)
      .where(sql`${t.deletedAt} IS NULL`),
    index("coordinator_assignments_user_idx").on(t.userId),
    index("coordinator_assignments_sy_idx").on(t.schoolYearId),
  ]
);

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actor: uuid("actor").references(() => users.id),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    targetEntity: text("target_entity").notNull(),
    targetId: text("target_id"),
    previousState: text("previous_state"),   // JSON summary
    newState: text("new_state"),             // JSON summary
    context: text("context"),
    correlationId: text("correlation_id"),
    // Privacy-safe audit-log channel: nullable legacy-compatible field; raw IPs
    // must not be persisted here. The helper in audit-logger normalizes this
    // field to a SHA-256 fingerprint before insert and retention should purge it.
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_actor_idx").on(t.actor),
    index("audit_entity_idx").on(t.targetEntity, t.targetId),
    index("audit_created_idx").on(t.createdAt),
    index("audit_action_idx").on(t.action), // For compliance reporting queries
  ]
);

// ─── Discounts ────────────────────────────────────────────────────────────────

/**
 * Discount type definitions - reusable discount configurations
 * Finance officers configure these; registrars can request them for enrollments.
 */
export const discountTypes = pgTable(
  "discount_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    calculationType: discountCalculationTypeEnum("calculation_type").notNull(),
    baseType: discountBaseTypeEnum("base_type").notNull().default("tuition_only"),
    defaultValue: numeric("default_value", { precision: 12, scale: 2 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    requiresDocumentation: boolean("requires_documentation").notNull().default(true),
    isStackable: boolean("is_stackable").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    /**
     * Priority for cascading discount calculations.
     * Lower values = applied first. Cash discounts apply first (priority 0),
     * then other discounts cascade (recalculated) based on the discounted tuition.
     * NULL means no cascade priority (legacy discounts).
     */
    cascadePriority: integer("cascade_priority"),
    /**
     * Flag indicating this is the cash payment discount type.
     * When cash discount is applied, other tuition_only discounts cascade.
     */
    isCashDiscount: boolean("is_cash_discount").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("discount_types_code_uidx")
      .on(t.code)
      .where(sql`${t.deletedAt} IS NULL`),
    index("discount_types_active_idx")
      .on(t.isActive)
      .where(sql`${t.isActive} = true AND ${t.deletedAt} IS NULL`),
    index("discount_types_display_order_idx").on(t.displayOrder),
    // Unique constraint: only one cash discount type can exist
    uniqueIndex("discount_types_cash_discount_uidx")
      .on(t.isCashDiscount)
      .where(sql`${t.isCashDiscount} = true AND ${t.deletedAt} IS NULL`),
  ]
);

/**
 * Discount requests - requests for discounts on specific enrollments
 * Created by registrars during enrollment, reviewed by finance officers.
 */
export const discountRequests = pgTable(
  "discount_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id),
    assessmentId: uuid("assessment_id").references(() => assessments.id),
    discountTypeId: uuid("discount_type_id").notNull().references(() => discountTypes.id),
    requestReason: text("request_reason"),
    /** Calculated base amount at time of request (for audit trail) */
    baseAmount: numeric("base_amount", { precision: 12, scale: 2 }),
    /** Calculated discount amount at time of request */
    calculatedAmount: numeric("calculated_amount", { precision: 12, scale: 2 }),
    /** Override value if approver modifies the discount */
    overrideValue: numeric("override_value", { precision: 12, scale: 2 }),
    overrideReason: text("override_reason"),
    status: discountRequestStatusEnum("status").notNull().default("pending"),
    requestedBy: uuid("requested_by").notNull().references(() => users.id),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at"),
    decisionRemarks: text("decision_remarks"),
    cancelledAt: timestamp("cancelled_at"),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    reversedAt: timestamp("reversed_at"),
    reversedBy: uuid("reversed_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Only one pending/approved request per enrollment + discount type
    uniqueIndex("discount_requests_enrollment_type_uidx")
      .on(t.enrollmentId, t.discountTypeId)
      .where(sql`${t.status} IN ('pending', 'approved')`),
    index("discount_requests_student_idx").on(t.studentId),
    index("discount_requests_enrollment_idx").on(t.enrollmentId),
    index("discount_requests_status_idx").on(t.status),
    index("discount_requests_pending_idx")
      .on(t.status)
      .where(sql`${t.status} = 'pending'`),
    // PERFORMANCE: Pending discount request queue with FIFO ordering (audit 2026-07)
    index("discount_requests_pending_created_idx")
      .on(t.status, t.createdAt)
      .where(sql`${t.status} = 'pending'`),
    // PERFORMANCE: Discount type lookups
    index("discount_requests_type_idx").on(t.discountTypeId),
  ]
);

/**
 * Student discounts - applied discounts on assessments
 * Created when approved discount requests are applied to an assessment.
 */
export const studentDiscounts = pgTable(
  "student_discounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    assessmentId: uuid("assessment_id").notNull().references(() => assessments.id),
    discountRequestId: uuid("discount_request_id").notNull().references(() => discountRequests.id),
    /** Snapshot of discount type code for reporting */
    discountTypeCode: text("discount_type_code").notNull(),
    /** Snapshot of discount type name for display */
    discountTypeName: text("discount_type_name").notNull(),
    calculationType: discountCalculationTypeEnum("calculation_type").notNull(),
    baseType: discountBaseTypeEnum("base_type").notNull(),
    /** Base amount used for calculation */
    baseAmount: numeric("base_amount", { precision: 12, scale: 2 }).notNull(),
    /** Discount value (percentage or fixed amount) */
    discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull(),
    /** Final calculated discount amount */
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull(),
    /** Links to the assessment item created for this discount */
    assessmentItemId: uuid("assessment_item_id").references(() => assessmentItems.id),
    /** Reversal tracking */
    reversedAt: timestamp("reversed_at"),
    reversedBy: uuid("reversed_by").references(() => users.id),
    reversalRemarks: text("reversal_remarks"),
    reversalDiscountId: uuid("reversal_discount_id"), // Self-reference for reversal entries
    /** Links a reversed discount to the new request that supersedes it (audit chain) */
    replacedByRequestId: uuid("replaced_by_request_id").references(
      (): AnyPgColumn => discountRequests.id
    ),
    /**
     * Cascade adjustment amount: the reduction in this discount due to cascading.
     * When cash discount is applied, other tuition_only discounts are recalculated
     * on the discounted tuition. This field stores the adjustment delta.
     * Example: Original ESC = 20,000, Recalculated = 18,000 → adjustment = 2,000
     */
    cascadeAdjustmentAmount: numeric("cascade_adjustment_amount", { precision: 12, scale: 2 }),
    /**
     * Links to the cash discount that triggered this cascade adjustment.
     * NULL if this discount was not affected by cascading.
     */
    cascadeTriggeredByDiscountId: uuid("cascade_triggered_by_discount_id"), // FK to studentDiscounts
    appliedAt: timestamp("applied_at").notNull().defaultNow(),
    appliedBy: uuid("applied_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("student_discounts_student_idx").on(t.studentId),
    index("student_discounts_assessment_idx").on(t.assessmentId),
    index("student_discounts_request_idx").on(t.discountRequestId),
    // Only one active (non-reversed) discount per request
    uniqueIndex("student_discounts_request_active_uidx")
      .on(t.discountRequestId)
      .where(sql`${t.reversedAt} IS NULL`),
    // PERFORMANCE: Lookup discounts affected by cascade for reversal
    index("student_discounts_cascade_trigger_idx")
      .on(t.cascadeTriggeredByDiscountId)
      .where(sql`${t.cascadeTriggeredByDiscountId} IS NOT NULL`),
  ]
);

// ─── System Settings ──────────────────────────────────────────────────────────

/**
 * System-wide configuration settings (key-value store).
 * Used for configurable values like refund cutoff days, etc.
 */
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

// ─── Enrollment Cancellation Requests ─────────────────────────────────────────

/**
 * Enrollment cancellation requests capture requests to cancel enrolled enrollments.
 * Direct cancellation is allowed for pending/assessed status.
 * Enrolled status requires approval from admin/super_admin.
 */
export const enrollmentCancellationRequests = pgTable(
  "enrollment_cancellation_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // No onDelete cascade: enrollments are soft-deleted via deletedAt/deletedBy;
    // cancellation requests must follow the same soft-delete lifecycle, not be hard-purged.
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id),
    /** User who submitted the cancellation request */
    requestedBy: uuid("requested_by").notNull().references(() => users.id),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    /** Predefined cancellation reason */
    reasonType: cancellationReasonTypeEnum("reason_type").notNull(),
    /** Optional details (required when reasonType = 'other') */
    remarks: text("remarks"),
    status: enrollmentCancellationRequestStatusEnum("status").notNull().default("pending"),
    /** Admin who approved/rejected */
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    /** Remarks from the approver/rejecter */
    reviewRemarks: text("review_remarks"),
    /** Soft delete */
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    // Only one pending request per enrollment at a time
    uniqueIndex("ecr_enrollment_pending_uidx")
      .on(t.enrollmentId)
      .where(sql`${t.status} = 'pending' AND ${t.deletedAt} IS NULL`),
    index("ecr_enrollment_idx").on(t.enrollmentId),
    index("ecr_status_idx").on(t.status),
    index("ecr_pending_idx")
      .on(t.status, t.deletedAt)
      .where(sql`${t.status} = 'pending' AND ${t.deletedAt} IS NULL`),
    index("ecr_requested_by_idx").on(t.requestedBy),
    // PERFORMANCE: Pending cancellation queue with FIFO ordering (audit 2026-07)
    index("ecr_pending_created_idx")
      .on(t.status, t.requestedAt)
      .where(sql`${t.status} = 'pending' AND ${t.deletedAt} IS NULL`),
  ]
);

// ─── Student Clearances ───────────────────────────────────────────────────────

/**
 * Student clearances track outstanding balances that must be resolved
 * before document release. Created on:
 * - End-of-year school year close
 * - Enrollment cancellation with balance
 * - Transfer out
 * - Graduation
 */
export const studentClearances = pgTable(
  "student_clearances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id),
    schoolYearId: uuid("school_year_id").references(() => schoolYears.id),
    clearanceType: clearanceTypeEnum("clearance_type").notNull(),
    /** Outstanding amount snapshot at creation */
    outstandingAmount: numeric("outstanding_amount", { precision: 12, scale: 2 }).notNull(),
    status: clearanceStatusEnum("status").notNull().default("pending"),
    /** For resolved clearances */
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at"),
    resolutionType: resolutionTypeEnum("resolution_type"),
    resolutionRemarks: text("resolution_remarks"),
    /** Timestamps */
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    /** Soft delete */
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    index("clearances_student_idx").on(t.studentId),
    index("clearances_enrollment_idx").on(t.enrollmentId),
    index("clearances_school_year_idx").on(t.schoolYearId),
    index("clearances_status_idx").on(t.status),
    index("clearances_pending_idx")
      .on(t.status)
      .where(sql`${t.status} = 'pending' AND ${t.deletedAt} IS NULL`),
    // PERFORMANCE: Student pending clearance lookup for document release (audit 2026-07)
    index("clearances_student_pending_idx")
      .on(t.studentId, t.status)
      .where(sql`${t.status} = 'pending' AND ${t.deletedAt} IS NULL`),
    // Prevent duplicate clearances for same enrollment + type (active only)
    uniqueIndex("clearances_enrollment_type_uidx")
      .on(t.enrollmentId, t.clearanceType)
      .where(sql`${t.deletedAt} IS NULL`),
  ]
);

// ─── Document Requests ────────────────────────────────────────────────────────

/**
 * Document requests track requests for official school documents.
 * Used for students and alumni (archived students) to request:
 * - Form 137 (Permanent Record)
 * - Form 138 (Report Card)
 * - Good Moral Certificate
 * - Certificate of Enrollment
 * - Certificate of Completion
 * - Diploma copies
 *
 * **Release Gate:**
 * Documents can only be released when student has no outstanding balance
 * and all clearances are resolved.
 */
export const documentRequests = pgTable(
  "document_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    schoolYearId: uuid("school_year_id").references(() => schoolYears.id),
    documentType: documentRequestTypeEnum("document_type").notNull(),
    /** Purpose of the document request (for records) */
    purpose: text("purpose"),
    /** Number of copies requested */
    copies: integer("copies").notNull().default(1),
    status: documentRequestStatusEnum("status").notNull().default("requested"),
    /** Fee amount for this document request */
    feeAmount: numeric("fee_amount", { precision: 12, scale: 2 }),
    /** Payment reference (if fee was paid) */
    paymentId: uuid("payment_id").references(() => payments.id),
    /** Document control number (e.g., DOC-2024-0001) */
    documentNumber: text("document_number"),
    /** Additional remarks */
    remarks: text("remarks"),
    /** Rejection reason (when status = rejected) */
    rejectedReason: text("rejected_reason"),
    /** Request tracking */
    requestedBy: uuid("requested_by").notNull().references(() => users.id),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    /** Processing tracking */
    processedBy: uuid("processed_by").references(() => users.id),
    processedAt: timestamp("processed_at"),
    /** Release tracking */
    releasedBy: uuid("released_by").references(() => users.id),
    releasedAt: timestamp("released_at"),
    /** Timestamps */
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** Soft delete */
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    index("doc_requests_student_idx").on(t.studentId),
    index("doc_requests_status_idx").on(t.status),
    index("doc_requests_school_year_idx").on(t.schoolYearId),
    index("doc_requests_requested_at_idx").on(t.requestedAt),
    // PERFORMANCE: Student document history (audit 2026-07)
    index("doc_requests_student_history_idx")
      .on(t.studentId, t.status, t.requestedAt)
      .where(sql`${t.deletedAt} IS NULL`),
    index("doc_requests_pending_idx")
      .on(t.status)
      .where(sql`${t.status} IN ('requested', 'processing', 'ready') AND ${t.deletedAt} IS NULL`),
    // Unique document number when assigned
    uniqueIndex("doc_requests_doc_number_uidx")
      .on(t.documentNumber)
      .where(sql`${t.documentNumber} IS NOT NULL`),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

// Fee Templates Relations
export const feeTemplatesRelations = relations(feeTemplates, ({ many }) => ({
  items: many(feeTemplateItems),
}));

export const feeTemplateItemsRelations = relations(feeTemplateItems, ({ one }) => ({
  feeTemplate: one(feeTemplates, {
    fields: [feeTemplateItems.feeTemplateId],
    references: [feeTemplates.id],
  }),
  feeItemType: one(feeItemTypes, {
    fields: [feeTemplateItems.feeItemTypeId],
    references: [feeItemTypes.id],
  }),
}));

export const feeItemTypesRelations = relations(feeItemTypes, ({ many }) => ({
  templateItems: many(feeTemplateItems),
  assessmentItems: many(assessmentItems),
}));

export const schoolYearFeeSchedulesRelations = relations(schoolYearFeeSchedules, ({ one, many }) => ({
  schoolYear: one(schoolYears, {
    fields: [schoolYearFeeSchedules.schoolYearId],
    references: [schoolYears.id],
  }),
  feeTemplate: one(feeTemplates, {
    fields: [schoolYearFeeSchedules.feeTemplateId],
    references: [feeTemplates.id],
  }),
  overrides: many(feeScheduleOverrides),
}));

export const feeScheduleOverridesRelations = relations(feeScheduleOverrides, ({ one }) => ({
  schedule: one(schoolYearFeeSchedules, {
    fields: [feeScheduleOverrides.scheduleId],
    references: [schoolYearFeeSchedules.id],
  }),
  feeTemplateItem: one(feeTemplateItems, {
    fields: [feeScheduleOverrides.feeTemplateItemId],
    references: [feeTemplateItems.id],
  }),
}));

export const assessmentItemsRelations = relations(assessmentItems, ({ one }) => ({
  assessment: one(assessments, {
    fields: [assessmentItems.assessmentId],
    references: [assessments.id],
  }),
  feeTemplateItem: one(feeTemplateItems, {
    fields: [assessmentItems.feeTemplateItemId],
    references: [feeTemplateItems.id],
  }),
  feeItemType: one(feeItemTypes, {
    fields: [assessmentItems.feeItemTypeId],
    references: [feeItemTypes.id],
  }),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  enrollment: one(enrollments, {
    fields: [assessments.enrollmentId],
    references: [enrollments.id],
  }),
  items: many(assessmentItems),
}));

export const schoolYearsRelations = relations(schoolYears, ({ many }) => ({
  feeSchedules: many(schoolYearFeeSchedules),
  curriculumAdoptions: many(curriculumAdoptions),
  sections: many(sections),
}));

// Section Relations
export const sectionsRelations = relations(sections, ({ one, many }) => ({
  gradeLevel: one(gradeLevels, {
    fields: [sections.gradeLevelId],
    references: [gradeLevels.id],
  }),
  schoolYear: one(schoolYears, {
    fields: [sections.schoolYearId],
    references: [schoolYears.id],
  }),
  /** Track association for SHS sections */
  strand: one(strands, {
    fields: [sections.strandId],
    references: [strands.id],
  }),
  /** Subject offerings for this section */
  subjectOfferings: many(subjectOfferings),
  /** Section adviser assignment */
  advisers: many(sectionAdvisers),
}));

// Curriculum Relations
export const curriculumsRelations = relations(curriculums, ({ one, many }) => ({
  /** The root curriculum of this version chain (self for v1) */
  root: one(curriculums, {
    fields: [curriculums.rootId],
    references: [curriculums.id],
    relationName: "curriculum_root",
  }),
  /** The parent version this was cloned from */
  predecessor: one(curriculums, {
    fields: [curriculums.predecessorId],
    references: [curriculums.id],
    relationName: "curriculum_predecessor",
  }),
  /** All versions in this curriculum's chain (where rootId matches) */
  versionChain: many(curriculums, {
    relationName: "curriculum_root",
  }),
  /** Successor versions cloned from this curriculum */
  successors: many(curriculums, {
    relationName: "curriculum_predecessor",
  }),
  /** Subjects belonging to this curriculum */
  subjects: many(subjects),
  /** Adoption bindings to school years */
  adoptions: many(curriculumAdoptions),
  /** @deprecated Legacy school year reference */
  effectiveSchoolYear: one(schoolYears, {
    fields: [curriculums.effectiveSchoolYearId],
    references: [schoolYears.id],
  }),
  publishedByUser: one(users, {
    fields: [curriculums.publishedBy],
    references: [users.id],
    relationName: "curriculum_publisher",
  }),
  archivedByUser: one(users, {
    fields: [curriculums.archivedBy],
    references: [users.id],
    relationName: "curriculum_archiver",
  }),
  createdByUser: one(users, {
    fields: [curriculums.createdBy],
    references: [users.id],
    relationName: "curriculum_creator",
  }),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  curriculum: one(curriculums, {
    fields: [subjects.curriculumId],
    references: [curriculums.id],
  }),
  gradeLevel: one(gradeLevels, {
    fields: [subjects.gradeLevelId],
    references: [gradeLevels.id],
  }),
  /** Direct track ownership for SHS subjects (Grade 11-12) */
  strand: one(strands, {
    fields: [subjects.strandId],
    references: [strands.id],
  }),
  createdByUser: one(users, {
    fields: [subjects.createdBy],
    references: [users.id],
    relationName: "subject_creator",
  }),
  /** @deprecated Use strand direct ownership for SHS subjects instead */
  subjectStrands: many(subjectStrands),
  /** Subject offerings across sections */
  subjectOfferings: many(subjectOfferings),
}));

export const curriculumAdoptionsRelations = relations(curriculumAdoptions, ({ one }) => ({
  schoolYear: one(schoolYears, {
    fields: [curriculumAdoptions.schoolYearId],
    references: [schoolYears.id],
  }),
  gradeLevel: one(gradeLevels, {
    fields: [curriculumAdoptions.gradeLevelId],
    references: [gradeLevels.id],
  }),
  curriculum: one(curriculums, {
    fields: [curriculumAdoptions.curriculumId],
    references: [curriculums.id],
  }),
  adoptedByUser: one(users, {
    fields: [curriculumAdoptions.adoptedBy],
    references: [users.id],
    relationName: "adoption_adopter",
  }),
}));

// Void Request Relations
export const voidRequestsRelations = relations(voidRequests, ({ one }) => ({
  payment: one(payments, {
    fields: [voidRequests.paymentId],
    references: [payments.id],
    relationName: "voidRequest_payment",
  }),
  requestedByUser: one(users, {
    fields: [voidRequests.requestedBy],
    references: [users.id],
    relationName: "voidRequest_requester",
  }),
  decidedByUser: one(users, {
    fields: [voidRequests.decidedBy],
    references: [users.id],
    relationName: "voidRequest_decider",
  }),
  reversalPayment: one(payments, {
    fields: [voidRequests.reversalPaymentId],
    references: [payments.id],
    relationName: "voidRequest_reversalPayment",
  }),
}));

// Payment Relations (for reversal tracking)
export const paymentsRelations = relations(payments, ({ one, many }) => ({
  student: one(students, {
    fields: [payments.studentId],
    references: [students.id],
  }),
  assessment: one(assessments, {
    fields: [payments.assessmentId],
    references: [assessments.id],
  }),
  booklet: one(receiptBooklets, {
    fields: [payments.bookletId],
    references: [receiptBooklets.id],
  }),
  /** For reversal rows: the original payment this reverses */
  reversedPayment: one(payments, {
    fields: [payments.reversesPaymentId],
    references: [payments.id],
    relationName: "payment_reversal",
  }),
  /** For original payments: the reversal row(s) that offset this payment */
  reversals: many(payments, {
    relationName: "payment_reversal",
  }),
  /** Void requests targeting this payment */
  voidRequests: many(voidRequests, {
    relationName: "voidRequest_payment",
  }),
}));

// Discount Relations
export const discountTypesRelations = relations(discountTypes, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [discountTypes.createdBy],
    references: [users.id],
    relationName: "discountType_creator",
  }),
  requests: many(discountRequests),
}));

export const discountRequestsRelations = relations(discountRequests, ({ one, many }) => ({
  student: one(students, {
    fields: [discountRequests.studentId],
    references: [students.id],
  }),
  enrollment: one(enrollments, {
    fields: [discountRequests.enrollmentId],
    references: [enrollments.id],
  }),
  assessment: one(assessments, {
    fields: [discountRequests.assessmentId],
    references: [assessments.id],
  }),
  discountType: one(discountTypes, {
    fields: [discountRequests.discountTypeId],
    references: [discountTypes.id],
  }),
  requestedByUser: one(users, {
    fields: [discountRequests.requestedBy],
    references: [users.id],
    relationName: "discountRequest_requester",
  }),
  decidedByUser: one(users, {
    fields: [discountRequests.decidedBy],
    references: [users.id],
    relationName: "discountRequest_decider",
  }),
  studentDiscounts: many(studentDiscounts),
}));

export const studentDiscountsRelations = relations(studentDiscounts, ({ one }) => ({
  student: one(students, {
    fields: [studentDiscounts.studentId],
    references: [students.id],
  }),
  assessment: one(assessments, {
    fields: [studentDiscounts.assessmentId],
    references: [assessments.id],
  }),
  discountRequest: one(discountRequests, {
    fields: [studentDiscounts.discountRequestId],
    references: [discountRequests.id],
  }),
  assessmentItem: one(assessmentItems, {
    fields: [studentDiscounts.assessmentItemId],
    references: [assessmentItems.id],
  }),
  appliedByUser: one(users, {
    fields: [studentDiscounts.appliedBy],
    references: [users.id],
    relationName: "studentDiscount_applier",
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  student: one(students, {
    fields: [enrollments.studentId],
    references: [students.id],
  }),
  schoolYear: one(schoolYears, {
    fields: [enrollments.schoolYearId],
    references: [schoolYears.id],
  }),
  gradeLevel: one(gradeLevels, {
    fields: [enrollments.gradeLevelId],
    references: [gradeLevels.id],
  }),
  section: one(sections, {
    fields: [enrollments.sectionId],
    references: [sections.id],
  }),
  registration: one(registrations, {
    fields: [enrollments.registrationId],
    references: [registrations.id],
  }),
  /** SHS strand for senior high school students */
  strand: one(strands, {
    fields: [enrollments.strandId],
    references: [strands.id],
  }),
  assessments: many(assessments),
  discountRequests: many(discountRequests),
  cancellationRequests: many(enrollmentCancellationRequests),
  clearances: many(studentClearances),
  studentSubjectEnrollments: many(studentSubjectEnrollments),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  /** Portal account for student self-service access */
  portalAccount: one(portalAccounts, {
    fields: [students.id],
    references: [portalAccounts.studentId],
  }),
  archivedByUser: one(users, {
    fields: [students.archivedBy],
    references: [users.id],
    relationName: "student_archiver",
  }),
  archivedSchoolYear: one(schoolYears, {
    fields: [students.archivedSchoolYearId],
    references: [schoolYears.id],
  }),
  enrollments: many(enrollments),
  discountRequests: many(discountRequests),
  studentDiscounts: many(studentDiscounts),
  clearances: many(studentClearances),
  documentRequests: many(documentRequests),
  studentSubjectEnrollments: many(studentSubjectEnrollments),
}));

// Portal Account Relations
export const portalAccountsRelations = relations(portalAccounts, ({ one, many }) => ({
  student: one(students, {
    fields: [portalAccounts.studentId],
    references: [students.id],
  }),
  createdByUser: one(users, {
    fields: [portalAccounts.createdBy],
    references: [users.id],
    relationName: "portalAccount_creator",
  }),
  updatedByUser: one(users, {
    fields: [portalAccounts.updatedBy],
    references: [users.id],
    relationName: "portalAccount_updater",
  }),
  deletedByUser: one(users, {
    fields: [portalAccounts.deletedBy],
    references: [users.id],
    relationName: "portalAccount_deleter",
  }),
  sessions: many(sessions),
}));

// Session Relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  portalAccount: one(portalAccounts, {
    fields: [sessions.portalAccountId],
    references: [portalAccounts.id],
  }),
}));

// Enrollment Cancellation Request Relations
export const enrollmentCancellationRequestsRelations = relations(enrollmentCancellationRequests, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [enrollmentCancellationRequests.enrollmentId],
    references: [enrollments.id],
  }),
  requestedByUser: one(users, {
    fields: [enrollmentCancellationRequests.requestedBy],
    references: [users.id],
    relationName: "cancellationRequest_requester",
  }),
  reviewedByUser: one(users, {
    fields: [enrollmentCancellationRequests.reviewedBy],
    references: [users.id],
    relationName: "cancellationRequest_reviewer",
  }),
}));

// Student Clearance Relations
export const studentClearancesRelations = relations(studentClearances, ({ one }) => ({
  student: one(students, {
    fields: [studentClearances.studentId],
    references: [students.id],
  }),
  enrollment: one(enrollments, {
    fields: [studentClearances.enrollmentId],
    references: [enrollments.id],
  }),
  schoolYear: one(schoolYears, {
    fields: [studentClearances.schoolYearId],
    references: [schoolYears.id],
  }),
  resolvedByUser: one(users, {
    fields: [studentClearances.resolvedBy],
    references: [users.id],
    relationName: "clearance_resolver",
  }),
  createdByUser: one(users, {
    fields: [studentClearances.createdBy],
    references: [users.id],
    relationName: "clearance_creator",
  }),
}));

// Document Request Relations
export const documentRequestsRelations = relations(documentRequests, ({ one }) => ({
  student: one(students, {
    fields: [documentRequests.studentId],
    references: [students.id],
  }),
  schoolYear: one(schoolYears, {
    fields: [documentRequests.schoolYearId],
    references: [schoolYears.id],
  }),
  payment: one(payments, {
    fields: [documentRequests.paymentId],
    references: [payments.id],
  }),
  requestedByUser: one(users, {
    fields: [documentRequests.requestedBy],
    references: [users.id],
    relationName: "docRequest_requester",
  }),
  processedByUser: one(users, {
    fields: [documentRequests.processedBy],
    references: [users.id],
    relationName: "docRequest_processor",
  }),
  releasedByUser: one(users, {
    fields: [documentRequests.releasedBy],
    references: [users.id],
    relationName: "docRequest_releaser",
  }),
}));

// Section Adviser Relations
export const sectionAdvisersRelations = relations(sectionAdvisers, ({ one }) => ({
  section: one(sections, {
    fields: [sectionAdvisers.sectionId],
    references: [sections.id],
  }),
  user: one(users, {
    fields: [sectionAdvisers.userId],
    references: [users.id],
    relationName: "adviser_user",
  }),
  schoolYear: one(schoolYears, {
    fields: [sectionAdvisers.schoolYearId],
    references: [schoolYears.id],
  }),
  createdByUser: one(users, {
    fields: [sectionAdvisers.createdBy],
    references: [users.id],
    relationName: "adviser_creator",
  }),
}));

// Grade Sheet Relations
export const gradeSheetsRelations = relations(gradeSheets, ({ one, many }) => ({
  section: one(sections, {
    fields: [gradeSheets.sectionId],
    references: [sections.id],
  }),
  schoolYear: one(schoolYears, {
    fields: [gradeSheets.schoolYearId],
    references: [schoolYears.id],
  }),
  adviser: one(users, {
    fields: [gradeSheets.adviserId],
    references: [users.id],
    relationName: "gradeSheet_adviser",
  }),
  entries: many(gradeSheetEntries),
  approvals: many(gradeApprovals),
  submittedByUser: one(users, {
    fields: [gradeSheets.submittedBy],
    references: [users.id],
    relationName: "gradeSheet_submitter",
  }),
  returnedByUser: one(users, {
    fields: [gradeSheets.returnedBy],
    references: [users.id],
    relationName: "gradeSheet_returner",
  }),
  principalApprovedByUser: one(users, {
    fields: [gradeSheets.principalApprovedBy],
    references: [users.id],
    relationName: "gradeSheet_principalApprover",
  }),
  publishedByUser: one(users, {
    fields: [gradeSheets.publishedBy],
    references: [users.id],
    relationName: "gradeSheet_publisher",
  }),
  lockedByUser: one(users, {
    fields: [gradeSheets.lockedBy],
    references: [users.id],
    relationName: "gradeSheet_locker",
  }),
}));

// Grade Sheet Entry Relations
export const gradeSheetEntriesRelations = relations(gradeSheetEntries, ({ one }) => ({
  gradeSheet: one(gradeSheets, {
    fields: [gradeSheetEntries.gradeSheetId],
    references: [gradeSheets.id],
  }),
  student: one(students, {
    fields: [gradeSheetEntries.studentId],
    references: [students.id],
  }),
  subject: one(subjects, {
    fields: [gradeSheetEntries.subjectId],
    references: [subjects.id],
  }),
  studentSubjectEnrollment: one(studentSubjectEnrollments, {
    fields: [gradeSheetEntries.studentSubjectEnrollmentId],
    references: [studentSubjectEnrollments.id],
  }),
}));

// Grade Approval Relations
export const gradeApprovalsRelations = relations(gradeApprovals, ({ one }) => ({
  gradeSheet: one(gradeSheets, {
    fields: [gradeApprovals.gradeSheetId],
    references: [gradeSheets.id],
  }),
  actor: one(users, {
    fields: [gradeApprovals.actorId],
    references: [users.id],
  }),
}));

// ─── Subject Offering Relations ───────────────────────────────────────────────

// Strand Relations
export const strandsRelations = relations(strands, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [strands.createdBy],
    references: [users.id],
    relationName: "strand_creator",
  }),
  /** Subjects owned by this track (SHS direct ownership model) */
  subjects: many(subjects),
  /** Sections assigned to this track (SHS track-based sections) */
  sections: many(sections),
  /** @deprecated Use subjects direct ownership instead */
  subjectStrands: many(subjectStrands),
  subjectOfferings: many(subjectOfferings),
  enrollments: many(enrollments),
}));

// Subject-Strand Relations
export const subjectStrandsRelations = relations(subjectStrands, ({ one }) => ({
  subject: one(subjects, {
    fields: [subjectStrands.subjectId],
    references: [subjects.id],
  }),
  strand: one(strands, {
    fields: [subjectStrands.strandId],
    references: [strands.id],
  }),
  createdByUser: one(users, {
    fields: [subjectStrands.createdBy],
    references: [users.id],
    relationName: "subjectStrand_creator",
  }),
}));

// Subject Offering Relations
export const subjectOfferingsRelations = relations(subjectOfferings, ({ one, many }) => ({
  section: one(sections, {
    fields: [subjectOfferings.sectionId],
    references: [sections.id],
  }),
  subject: one(subjects, {
    fields: [subjectOfferings.subjectId],
    references: [subjects.id],
  }),
  schoolYear: one(schoolYears, {
    fields: [subjectOfferings.schoolYearId],
    references: [schoolYears.id],
  }),
  teacher: one(users, {
    fields: [subjectOfferings.teacherId],
    references: [users.id],
    relationName: "offering_teacher",
  }),
  strand: one(strands, {
    fields: [subjectOfferings.strandId],
    references: [strands.id],
  }),
  createdByUser: one(users, {
    fields: [subjectOfferings.createdBy],
    references: [users.id],
    relationName: "offering_creator",
  }),
  studentSubjectEnrollments: many(studentSubjectEnrollments),
}));

// Student Subject Enrollment Relations
export const studentSubjectEnrollmentsRelations = relations(studentSubjectEnrollments, ({ one, many }) => ({
  enrollment: one(enrollments, {
    fields: [studentSubjectEnrollments.enrollmentId],
    references: [enrollments.id],
  }),
  subjectOffering: one(subjectOfferings, {
    fields: [studentSubjectEnrollments.subjectOfferingId],
    references: [subjectOfferings.id],
  }),
  student: one(students, {
    fields: [studentSubjectEnrollments.studentId],
    references: [students.id],
  }),
  schoolYear: one(schoolYears, {
    fields: [studentSubjectEnrollments.schoolYearId],
    references: [schoolYears.id],
  }),
  withdrawnByUser: one(users, {
    fields: [studentSubjectEnrollments.withdrawnBy],
    references: [users.id],
    relationName: "sse_withdrawer",
  }),
  createdByUser: one(users, {
    fields: [studentSubjectEnrollments.createdBy],
    references: [users.id],
    relationName: "sse_creator",
  }),
  gradeSheetEntries: many(gradeSheetEntries),
}));
