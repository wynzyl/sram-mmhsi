import "server-only";

import { db } from "@/lib/db";
import { students, parentsGuardians, studentGuardianLinks } from "@/lib/db/schema";
import type { Role } from "@/lib/constants/roles";
import { ROLES } from "@/lib/constants/roles";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";

/**
 * Returns distinct student row ids the portal user may view (linked student account or guardian links).
 */
export async function getPortalStudentIds(userId: string, role: Role): Promise<string[]> {
  if (role === ROLES.STUDENT) {
    const row = await db.query.students.findFirst({
      columns: { id: true },
      where: and(eq(students.userId, userId), isNull(students.deletedAt)),
    });
    return row ? [row.id] : [];
  }

  if (role === ROLES.PARENT_GUARDIAN) {
    const guardianRows = await db
      .select({ parentId: parentsGuardians.id })
      .from(parentsGuardians)
      .where(eq(parentsGuardians.userId, userId));

    if (guardianRows.length === 0) return [];

    const guardianIds = guardianRows.map((r) => r.parentId);
    const links = await db
      .select({ studentId: studentGuardianLinks.studentId })
      .from(studentGuardianLinks)
      .where(inArray(studentGuardianLinks.guardianId, guardianIds));

    return [...new Set(links.map((l) => l.studentId))];
  }

  return [];
}

export type PortalStudentLabel = { id: string; firstName: string; lastName: string; referenceNumber: string };

export async function getPortalStudentLabels(studentIds: string[]): Promise<PortalStudentLabel[]> {
  if (studentIds.length === 0) return [];
  const rows = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      referenceNumber: students.referenceNumber,
    })
    .from(students)
    .where(and(inArray(students.id, studentIds), isNull(students.deletedAt)))
    .orderBy(desc(students.lastName));

  return rows;
}
