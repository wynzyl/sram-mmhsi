import 'server-only';
import { db } from "@/lib/db";
import { registrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { RegistrationEnrollmentContext } from "@/lib/types/registration-enrollment-context";

export type { RegistrationEnrollmentContext };

/**
 * Approved registrations for the active school year, one preferred row per student
 * (latest reviewedAt, then latest createdAt). Optionally pin a specific registration id.
 */
export async function getRegistrationContextByStudentIdForSchoolYear(
  activeSchoolYearId: string,
  options?: {
    preferredRegistrationId?: string | null;
    preferredStudentId?: string | null;
  }
): Promise<Record<string, RegistrationEnrollmentContext>> {
  const rows = await db
    .select({
      id: registrations.id,
      studentId: registrations.studentId,
      schoolYearId: registrations.schoolYearId,
      gradeLevelId: registrations.gradeLevelId,
      studentType: registrations.studentType,
      intakeDocuments: registrations.intakeDocuments,
      reviewedAt: registrations.reviewedAt,
      createdAt: registrations.createdAt,
    })
    .from(registrations)
    .where(
      and(eq(registrations.schoolYearId, activeSchoolYearId), eq(registrations.status, "approved"))
    );

  rows.sort((a, b) => {
    const ta = a.reviewedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const tb = b.reviewedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (tb !== ta) return tb - ta;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const toContext = (
    r: (typeof rows)[number]
  ): RegistrationEnrollmentContext => ({
    registrationId: r.id,
    studentId: r.studentId,
    schoolYearId: r.schoolYearId,
    gradeLevelId: r.gradeLevelId,
    studentType: r.studentType as RegistrationEnrollmentContext["studentType"],
    intakeDocuments: r.intakeDocuments,
  });

  const map: Record<string, RegistrationEnrollmentContext> = {};
  for (const r of rows) {
    if (map[r.studentId]) continue;
    map[r.studentId] = toContext(r);
  }

  const prefId = options?.preferredRegistrationId?.trim();
  if (prefId) {
    const pref = rows.find((r) => r.id === prefId);
    if (pref && pref.schoolYearId === activeSchoolYearId) {
      const sid = options?.preferredStudentId?.trim();
      if (!sid || pref.studentId === sid) {
        map[pref.studentId] = toContext(pref);
      }
    }
  }

  return map;
}
