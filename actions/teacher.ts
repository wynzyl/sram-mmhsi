"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { gradeRecords } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  SaveGradesSchema,
  SubmitGradesSchema,
  type SaveGradesFormState,
  type SubmitGradesFormState,
} from "@/lib/validators/academics";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";

// ─── Save Grades (Draft) ────────────────────────────────────────────────────

export async function saveGradesAction(
  _prevState: SaveGradesFormState,
  formData: FormData
): Promise<SaveGradesFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "grades:encode")) {
    return { message: "You do not have permission to encode grades." };
  }

  // Parse complex formData structure (array of objects)
  const gradesJson = formData.get("grades");
  if (!gradesJson || typeof gradesJson !== "string") {
    return { message: "Invalid grades data." };
  }

  let parsedGrades;
  try {
    parsedGrades = JSON.parse(gradesJson);
  } catch (e) {
    return { message: "Failed to parse grades JSON." };
  }

  const parsed = SaveGradesSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    schoolYearId: formData.get("schoolYearId"),
    grades: parsedGrades,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as SaveGradesFormState["errors"] };
  }

  const { assignmentId, schoolYearId, grades } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      for (const entry of grades) {
        // Skip empty entries unless they are explicitly zero
        if (entry.grade === null || entry.grade === undefined || entry.grade === "") {
          continue;
        }

        // Check if grade record exists
        const existing = await tx.query.gradeRecords.findFirst({
          where: and(
            eq(gradeRecords.studentId, entry.studentId),
            eq(gradeRecords.teacherAssignmentId, assignmentId),
            eq(gradeRecords.gradingPeriod, entry.gradingPeriod)
          ),
        });

        // Prevent modification if already submitted or locked
        if (existing && (existing.status === "submitted" || existing.status === "locked")) {
          throw new Error(`Grade for student ${entry.studentId} in ${entry.gradingPeriod} is already submitted/locked.`);
        }

        if (existing) {
          await tx
            .update(gradeRecords)
            .set({
              grade: String(entry.grade),
              status: "draft",
              updatedBy: session.userId,
              updatedAt: new Date(),
            })
            .where(eq(gradeRecords.id, existing.id));
        } else {
          await tx.insert(gradeRecords).values({
            studentId: entry.studentId,
            teacherAssignmentId: assignmentId,
            schoolYearId: schoolYearId,
            gradingPeriod: entry.gradingPeriod,
            grade: String(entry.grade),
            status: "draft",
            createdBy: session.userId,
            updatedBy: session.userId,
          });
        }
      }

      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "grades_saved_draft",
        targetEntity: "teacher_assignments",
        targetId: assignmentId,
        context: `Saved ${grades.length} grades.`,
      }, { throwOnFail: true });
    });

    revalidatePath(`/staff/grades/${assignmentId}`);
    return { success: true, message: "Grades saved successfully." };
  } catch (error: any) {
    logger.error("[teacher] Failed to save grades", { error: String(error) });
    return { message: error.message || "An unexpected error occurred." };
  }
}

// ─── Submit Grades ──────────────────────────────────────────────────────────

export async function submitGradesAction(
  _prevState: SubmitGradesFormState,
  formData: FormData
): Promise<SubmitGradesFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "grades:submit")) {
    return { message: "You do not have permission to submit grades." };
  }

  const parsed = SubmitGradesSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    gradingPeriod: formData.get("gradingPeriod"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { assignmentId, gradingPeriod } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      // Find all drafts for this period
      const drafts = await tx.query.gradeRecords.findMany({
        where: and(
          eq(gradeRecords.teacherAssignmentId, assignmentId),
          eq(gradeRecords.gradingPeriod, gradingPeriod),
          eq(gradeRecords.status, "draft")
        ),
      });

      if (drafts.length === 0) {
        throw new Error("No draft grades found to submit.");
      }

      // Update to submitted
      await tx
        .update(gradeRecords)
        .set({
          status: "submitted",
          submittedAt: new Date(),
          submittedBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(
          and(
            eq(gradeRecords.teacherAssignmentId, assignmentId),
            eq(gradeRecords.gradingPeriod, gradingPeriod),
            eq(gradeRecords.status, "draft")
          )
        );

      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "grades_submitted",
        targetEntity: "teacher_assignments",
        targetId: assignmentId,
        context: `Period: ${gradingPeriod}`,
      }, { throwOnFail: true });
    });

    revalidatePath(`/staff/grades/${assignmentId}`);
    return { success: true, message: "Grades submitted successfully." };
  } catch (error: any) {
    logger.error("[teacher] Failed to submit grades", { error: String(error) });
    return { message: error.message || "An unexpected error occurred." };
  }
}
