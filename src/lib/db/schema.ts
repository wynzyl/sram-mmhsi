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

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
  "super_admin",
  "admin",
  "registrar",
  "finance_officer",
  "cashier",
  "teacher",
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

export const bookletStatusEnum = pgEnum("booklet_status", [
  "active",
  "exhausted",
  "voided",
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
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_idx").on(t.token),
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt), // For session cleanup queries
  ]
);

// ─── School Configuration ─────────────────────────────────────────────────────

export const schoolYears = pgTable("school_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),           // e.g. "2024-2025"
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(false),
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (t) => [
    index("sections_grade_sy_idx").on(t.gradeLevelId, t.schoolYearId),
  ]
);

export const curriculums = pgTable("curriculums", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  effectiveSchoolYearId: uuid("effective_school_year_id").references(() => schoolYears.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    curriculumId: uuid("curriculum_id").references(() => curriculums.id).notNull(),
    gradeLevelId: uuid("grade_level_id").references(() => gradeLevels.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    index("subjects_curriculum_idx").on(t.curriculumId),
    // Partial index for active subjects (soft delete optimization)
    index("subjects_active_idx")
      .on(t.id)
      .where(sql`${t.deletedAt} IS NULL`),
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
    userId: uuid("user_id").references(() => users.id),   // linked portal account
    isActive: boolean("is_active").notNull().default(true),
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
    /** NEW_STUDENT | TRANSFEREE | OLD_STUDENT workflow classification. */
    studentType: enrollmentStudentTypeEnum("student_type").notNull().default("new_student"),
    /** Required for new_student / transferee enrollments; null for old_student or legacy rows. */
    intakeDocuments: jsonb("intake_documents").$type<EnrollmentIntakeDocuments | null>(),
    status: enrollmentStatusEnum("status").notNull().default("pending"),
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
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
    // Prevent duplicate clearances for same enrollment + type (active only)
    uniqueIndex("clearances_enrollment_type_uidx")
      .on(t.enrollmentId, t.clearanceType)
      .where(sql`${t.deletedAt} IS NULL`),
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
  assessments: many(assessments),
  discountRequests: many(discountRequests),
  cancellationRequests: many(enrollmentCancellationRequests),
  clearances: many(studentClearances),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  enrollments: many(enrollments),
  discountRequests: many(discountRequests),
  studentDiscounts: many(studentDiscounts),
  clearances: many(studentClearances),
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
