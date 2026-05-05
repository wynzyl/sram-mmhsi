"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { schoolYears, enrollments, registrations, auditLogs } from "@/lib/db/schema";
import { eq, and, ilike, isNull, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logCreateAction, logUpdateAction, logDeleteAction } from "@/lib/utils/audit-logger";
import {
  CreateSchoolYearSchema,
  UpdateSchoolYearSchema,
  ToggleSchoolYearStatusSchema,
  DeleteSchoolYearSchema,
} from "@/lib/validators/school-year";
import type {
  CreateSchoolYearFormState,
  UpdateSchoolYearFormState,
  ToggleSchoolYearStatusFormState,
  DeleteSchoolYearFormState,
} from "@/lib/validators/school-year";
import { logger } from "@/lib/observability/logger";

// ─── Create School Year Action ────────────────────────────────────────────────

export async function createSchoolYearAction(
  _prevState: CreateSchoolYearFormState,
  formData: FormData
): Promise<CreateSchoolYearFormState> {
  // 1. Auth check
  const session = await requireSession();
  if (!hasPermission(session.role, "school_years:manage")) {
    return { message: "You do not have permission to create school years." };
  }

  // 2. Validate
  const parsed = CreateSchoolYearSchema.safeParse({
    label: formData.get("label"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as CreateSchoolYearFormState["errors"],
    };
  }

  const schoolYearData = parsed.data;

  // 3. Duplicate label detection
  const existingLabel = await db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(
      and(
        ilike(schoolYears.label, schoolYearData.label),
        isNull(schoolYears.deletedAt)
      )
    )
    .limit(1);

  if (existingLabel.length > 0) {
    return {
      errors: {
        label: ["This school year label already exists."],
      },
    };
  }

  try {
    // 4. Single-active enforcement: if creating as active, deactivate all others
    if (schoolYearData.isActive) {
      await db
        .update(schoolYears)
        .set({ isActive: false, updatedBy: session.userId, updatedAt: new Date() })
        .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)));
    }

    // 5. Insert school year
    const [newSchoolYear] = await db
      .insert(schoolYears)
      .values({
        ...schoolYearData,
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: schoolYears.id });

    // 6. Audit log
    await logCreateAction(session, "school_years", newSchoolYear.id, {
      label: schoolYearData.label,
      isActive: schoolYearData.isActive,
    });

    logger.info("[school_years] School year created", {
      schoolYearId: newSchoolYear.id,
      label: schoolYearData.label,
      actorId: session.userId,
    });

    revalidatePath("/admin/school-years");

    return { success: true, schoolYearId: newSchoolYear.id };
  } catch (err) {
    logger.error("[school_years] Failed to create school year", {
      error: String(err),
    });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Update School Year Action ────────────────────────────────────────────────

export async function updateSchoolYearAction(
  _prevState: UpdateSchoolYearFormState,
  formData: FormData
): Promise<UpdateSchoolYearFormState> {
  // 1. Auth check
  const session = await requireSession();
  if (!hasPermission(session.role, "school_years:manage")) {
    return { message: "You do not have permission to update school years." };
  }

  // 2. Validate
  const parsed = UpdateSchoolYearSchema.safeParse({
    schoolYearId: formData.get("schoolYearId"),
    label: formData.get("label"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as UpdateSchoolYearFormState["errors"],
    };
  }

  const { schoolYearId, ...updateData } = parsed.data;

  // 3. Get existing school year
  const [existingSchoolYear] = await db
    .select()
    .from(schoolYears)
    .where(and(eq(schoolYears.id, schoolYearId), isNull(schoolYears.deletedAt)))
    .limit(1);

  if (!existingSchoolYear) {
    return { message: "School year not found." };
  }

  // 4. Duplicate label detection (excluding current school year)
  if (updateData.label && updateData.label !== existingSchoolYear.label) {
    const duplicateLabel = await db
      .select({ id: schoolYears.id })
      .from(schoolYears)
      .where(
        and(
          ilike(schoolYears.label, updateData.label),
          sql`${schoolYears.id} != ${schoolYearId}`,
          isNull(schoolYears.deletedAt)
        )
      )
      .limit(1);

    if (duplicateLabel.length > 0) {
      return {
        errors: {
          label: ["This school year label already exists."],
        },
      };
    }
  }

  try {
    // 5. Single-active enforcement: if activating this one, deactivate all others
    if (updateData.isActive === true && !existingSchoolYear.isActive) {
      await db
        .update(schoolYears)
        .set({ isActive: false, updatedBy: session.userId, updatedAt: new Date() })
        .where(
          and(
            eq(schoolYears.isActive, true),
            sql`${schoolYears.id} != ${schoolYearId}`,
            isNull(schoolYears.deletedAt)
          )
        );
    }

    // 6. Update school year
    await db
      .update(schoolYears)
      .set({
        ...updateData,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(schoolYears.id, schoolYearId));

    // 7. Audit log
    await logUpdateAction(
      session,
      "school_years",
      schoolYearId,
      {
        label: existingSchoolYear.label,
        startDate: existingSchoolYear.startDate,
        endDate: existingSchoolYear.endDate,
        isActive: existingSchoolYear.isActive,
      },
      updateData
    );

    logger.info("[school_years] School year updated", {
      schoolYearId,
      actorId: session.userId,
    });

    revalidatePath("/admin/school-years");
    revalidatePath(`/admin/school-years/${schoolYearId}/edit`);

    return { success: true };
  } catch (err) {
    logger.error("[school_years] Failed to update school year", {
      error: String(err),
    });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Toggle School Year Status Action ─────────────────────────────────────────

export async function toggleSchoolYearStatusAction(
  _prevState: ToggleSchoolYearStatusFormState,
  formData: FormData
): Promise<ToggleSchoolYearStatusFormState> {
  // 1. Auth check
  const session = await requireSession();
  if (!hasPermission(session.role, "school_years:manage")) {
    return {
      message: "You do not have permission to change school year status.",
    };
  }

  // 2. Validate
  const parsed = ToggleSchoolYearStatusSchema.safeParse({
    schoolYearId: formData.get("schoolYearId"),
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as ToggleSchoolYearStatusFormState["errors"],
    };
  }

  const { schoolYearId, isActive } = parsed.data;

  // 3. Get existing school year
  const [existingSchoolYear] = await db
    .select()
    .from(schoolYears)
    .where(and(eq(schoolYears.id, schoolYearId), isNull(schoolYears.deletedAt)))
    .limit(1);

  if (!existingSchoolYear) {
    return { message: "School year not found." };
  }

  try {
    // 4. Single-active enforcement: if activating, deactivate all others
    if (isActive === true && !existingSchoolYear.isActive) {
      await db
        .update(schoolYears)
        .set({ isActive: false, updatedBy: session.userId, updatedAt: new Date() })
        .where(
          and(
            eq(schoolYears.isActive, true),
            sql`${schoolYears.id} != ${schoolYearId}`,
            isNull(schoolYears.deletedAt)
          )
        );
    }

    // 5. Update status
    await db
      .update(schoolYears)
      .set({
        isActive,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(schoolYears.id, schoolYearId));

    // 6. Audit log
    await logUpdateAction(
      session,
      "school_years",
      schoolYearId,
      { isActive: existingSchoolYear.isActive },
      { isActive }
    );

    logger.info("[school_years] School year status changed", {
      schoolYearId,
      isActive,
      actorId: session.userId,
    });

    revalidatePath("/admin/school-years");

    return { success: true };
  } catch (err) {
    logger.error("[school_years] Failed to toggle school year status", {
      error: String(err),
    });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Delete School Year Action ────────────────────────────────────────────────

export async function deleteSchoolYearAction(
  _prevState: DeleteSchoolYearFormState,
  formData: FormData
): Promise<DeleteSchoolYearFormState> {
  // 1. Auth check
  const session = await requireSession();
  if (!hasPermission(session.role, "school_years:manage")) {
    return { message: "You do not have permission to delete school years." };
  }

  // 2. Validate
  const parsed = DeleteSchoolYearSchema.safeParse({
    schoolYearId: formData.get("schoolYearId"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as DeleteSchoolYearFormState["errors"],
    };
  }

  const { schoolYearId } = parsed.data;

  // 3. Get existing school year
  const [existingSchoolYear] = await db
    .select()
    .from(schoolYears)
    .where(and(eq(schoolYears.id, schoolYearId), isNull(schoolYears.deletedAt)))
    .limit(1);

  if (!existingSchoolYear) {
    return { message: "School year not found." };
  }

  // 4. Check for enrollments
  const enrollmentCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.schoolYearId, schoolYearId));

  if ((enrollmentCount[0]?.count ?? 0) > 0) {
    return {
      errors: {
        _form: [
          "Cannot delete this school year because it has existing enrollments.",
        ],
      },
    };
  }

  // 5. Check for registrations
  const registrationCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrations)
    .where(eq(registrations.schoolYearId, schoolYearId));

  if ((registrationCount[0]?.count ?? 0) > 0) {
    return {
      errors: {
        _form: [
          "Cannot delete this school year because it has existing registrations.",
        ],
      },
    };
  }

  try {
    // 6. Soft delete
    await db
      .update(schoolYears)
      .set({
        deletedAt: new Date(),
        deletedBy: session.userId,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(schoolYears.id, schoolYearId));

    // 7. Audit log
    await logDeleteAction(
      session,
      "school_years",
      schoolYearId,
      `Deleted school year: ${existingSchoolYear.label}`
    );

    logger.info("[school_years] School year deleted", {
      schoolYearId,
      actorId: session.userId,
    });

    revalidatePath("/admin/school-years");

    return { success: true };
  } catch (err) {
    logger.error("[school_years] Failed to delete school year", {
      error: String(err),
    });
    return { message: "An unexpected error occurred. Please try again." };
  }
}
