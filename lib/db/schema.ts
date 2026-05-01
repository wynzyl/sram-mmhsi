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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
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

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending_confirmation",
  "posted",
  "voided",
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
});

export const gradeLevels = pgTable("grade_levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),             // e.g. "Grade 7", "Kinder 2"
  order: integer("order").notNull(),
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

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  curriculumId: uuid("curriculum_id").references(() => curriculums.id).notNull(),
  gradeLevelId: uuid("grade_level_id").references(() => gradeLevels.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

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
  },
  (t) => [index("pg_name_idx").on(t.lastName, t.firstName)]
);

export const studentGuardianLinks = pgTable(
  "student_guardian_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    guardianId: uuid("guardian_id").notNull().references(() => parentsGuardians.id),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sgl_student_idx").on(t.studentId)]
);

// ─── Registration & Enrollment ────────────────────────────────────────────────

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
    gradeLevelId: uuid("grade_level_id").notNull().references(() => gradeLevels.id),
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
    status: enrollmentStatusEnum("status").notNull().default("pending"),
    enrolledAt: timestamp("enrolled_at"),
    cancelledAt: timestamp("cancelled_at"),
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
  ]
);

// ─── Fee Schedules ────────────────────────────────────────────────────────────

export const feeSchedules = pgTable("fee_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
  gradeLevelId: uuid("grade_level_id").notNull().references(() => gradeLevels.id),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
}, (t) => [
  uniqueIndex("fee_schedule_unique_idx").on(t.schoolYearId, t.gradeLevelId)
]);

export const feeScheduleItems = pgTable("fee_schedule_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  feeScheduleId: uuid("fee_schedule_id").notNull().references(() => feeSchedules.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  isDiscount: boolean("is_discount").notNull().default(false),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

// ─── Assessments (Billing) ────────────────────────────────────────────────────

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id),
    studentId: uuid("student_id").notNull().references(() => students.id),
    schoolYearId: uuid("school_year_id").notNull().references(() => schoolYears.id),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    totalPaid: numeric("total_paid", { precision: 12, scale: 2 }).notNull().default("0"),
    balance: numeric("balance", { precision: 12, scale: 2 }).notNull(),
    remarks: text("remarks"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [index("assessment_student_sy_idx").on(t.studentId, t.schoolYearId)]
);

export const assessmentItems = pgTable("assessment_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  isDiscount: boolean("is_discount").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

// ─── Payments ─────────────────────────────────────────────────────────────────

export const receiptBooklets = pgTable(
  "receipt_booklets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    series: text("series").notNull(),               // e.g. "AP"
    startNumber: integer("start_number").notNull(),
    endNumber: integer("end_number").notNull(),
    nextNumber: integer("next_number").notNull(),
    status: bookletStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [index("booklet_status_idx").on(t.status)]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    assessmentId: uuid("assessment_id").references(() => assessments.id),
    bookletId: uuid("booklet_id").references(() => receiptBooklets.id),
    orNumber: text("or_number"),
    orStatus: orStatusEnum("or_status").notNull().default("consumed"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: text("payment_method").notNull(),  // cash, check, gcash, etc.
    referenceNumber: text("reference_number"),
    paymentDate: timestamp("payment_date").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending_confirmation"),
    remarks: text("remarks"),
    voidedAt: timestamp("voided_at"),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidReason: text("void_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("payments_or_number_idx").on(t.orNumber),
    index("payments_student_idx").on(t.studentId),
    index("payments_status_idx").on(t.status),
    index("payments_date_idx").on(t.paymentDate),
  ]
);

export const paymentAllocations = pgTable("payment_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  assessmentItemId: uuid("assessment_item_id").references(() => assessmentItems.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
  },
  (t) => [
    uniqueIndex("ta_unique_idx").on(t.teacherId, t.subjectId, t.sectionId, t.schoolYearId),
    index("ta_teacher_idx").on(t.teacherId),
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
    index("gr_student_idx").on(t.studentId),
    index("gr_status_idx").on(t.status),
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
  ]
);
