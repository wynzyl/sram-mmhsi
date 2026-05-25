import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, isStaffRole } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import {
  students,
  enrollments,
  assessments,
  payments,
  gradeLevels,
  schoolYears,
} from "@/lib/db/schema";
import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { GlobalSearchResponse, SearchResultItem } from "@/lib/validators/search.schema";

const MAX_RESULTS_PER_CATEGORY = 5;

export async function GET(request: NextRequest) {
  await connection();

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim() ?? "";

    if (!query || query.length < 2) {
      const emptyResponse: GlobalSearchResponse = {
        students: [],
        enrollments: [],
        assessments: [],
        payments: [],
      };
      return NextResponse.json(emptyResponse);
    }

    // Determine base path based on role
    const basePath = isStaffRole(user.role) ? "/staff" : "/admin";
    const searchPattern = `%${query}%`;

    // Build response based on permissions
    const response: GlobalSearchResponse = {
      students: [],
      enrollments: [],
      assessments: [],
      payments: [],
    };

    // Search students (if user has permission)
    if (hasPermission(user.role, "students:read")) {
      const studentResults = await db
        .select({
          id: students.id,
          referenceNumber: students.referenceNumber,
          firstName: students.firstName,
          lastName: students.lastName,
        })
        .from(students)
        .where(
          and(
            isNull(students.deletedAt),
            or(
              ilike(students.referenceNumber, searchPattern),
              ilike(students.firstName, searchPattern),
              ilike(students.lastName, searchPattern),
              ilike(sql`concat(${students.firstName}, ' ', ${students.lastName})`, searchPattern),
              ilike(sql`concat(${students.lastName}, ', ', ${students.firstName})`, searchPattern)
            )
          )
        )
        .limit(MAX_RESULTS_PER_CATEGORY);

      response.students = studentResults.map((s): SearchResultItem => ({
        id: s.id,
        title: `${s.lastName}, ${s.firstName}`,
        subtitle: s.referenceNumber,
        href: `${basePath}/students/${s.id}`,
      }));
    }

    // Search enrollments (if user has permission)
    if (hasPermission(user.role, "enrollments:read")) {
      const enrollmentResults = await db
        .select({
          id: enrollments.id,
          status: enrollments.status,
          studentRef: students.referenceNumber,
          studentFirst: students.firstName,
          studentLast: students.lastName,
          gradeLevel: gradeLevels.name,
          schoolYear: schoolYears.label,
        })
        .from(enrollments)
        .innerJoin(students, eq(enrollments.studentId, students.id))
        .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
        .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
        .where(
          and(
            isNull(students.deletedAt),
            or(
              ilike(students.referenceNumber, searchPattern),
              ilike(students.firstName, searchPattern),
              ilike(students.lastName, searchPattern),
              ilike(sql`concat(${students.firstName}, ' ', ${students.lastName})`, searchPattern)
            )
          )
        )
        .limit(MAX_RESULTS_PER_CATEGORY);

      response.enrollments = enrollmentResults.map((e): SearchResultItem => ({
        id: e.id,
        title: `${e.studentLast}, ${e.studentFirst}`,
        subtitle: `${e.gradeLevel} · ${e.schoolYear}`,
        badge: e.status,
        href: `${basePath}/enrollments/${e.id}`,
      }));
    }

    // Search assessments (if user has permission)
    if (hasPermission(user.role, "assessments:read")) {
      const assessmentResults = await db
        .select({
          id: assessments.id,
          billingStatus: assessments.billingStatus,
          balance: assessments.balance,
          studentRef: students.referenceNumber,
          studentFirst: students.firstName,
          studentLast: students.lastName,
          gradeLevel: gradeLevels.name,
          schoolYear: schoolYears.label,
        })
        .from(assessments)
        .innerJoin(students, eq(assessments.studentId, students.id))
        .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
        .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
        .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
        .where(
          and(
            isNull(students.deletedAt),
            isNull(assessments.cancelledAt),
            or(
              ilike(students.referenceNumber, searchPattern),
              ilike(students.firstName, searchPattern),
              ilike(students.lastName, searchPattern),
              ilike(sql`concat(${students.firstName}, ' ', ${students.lastName})`, searchPattern)
            )
          )
        )
        .limit(MAX_RESULTS_PER_CATEGORY);

      response.assessments = assessmentResults.map((a): SearchResultItem => ({
        id: a.id,
        title: `${a.studentLast}, ${a.studentFirst}`,
        subtitle: `${a.gradeLevel} · ${a.schoolYear} · Bal: ₱${Number(a.balance).toLocaleString()}`,
        badge: a.billingStatus,
        href: `${basePath}/assessments/${a.id}`,
      }));
    }

    // Search payments (if user has permission)
    if (hasPermission(user.role, "payments:read")) {
      const paymentResults = await db
        .select({
          id: payments.id,
          orNumber: payments.orNumber,
          amount: payments.amount,
          status: payments.status,
          studentRef: students.referenceNumber,
          studentFirst: students.firstName,
          studentLast: students.lastName,
        })
        .from(payments)
        .innerJoin(students, eq(payments.studentId, students.id))
        .where(
          and(
            isNull(students.deletedAt),
            or(
              ilike(payments.orNumber, searchPattern),
              ilike(students.referenceNumber, searchPattern),
              ilike(students.firstName, searchPattern),
              ilike(students.lastName, searchPattern),
              ilike(sql`concat(${students.firstName}, ' ', ${students.lastName})`, searchPattern)
            )
          )
        )
        .limit(MAX_RESULTS_PER_CATEGORY);

      response.payments = paymentResults.map((p): SearchResultItem => ({
        id: p.id,
        title: p.orNumber ? `OR ${p.orNumber}` : `${p.studentLast}, ${p.studentFirst}`,
        subtitle: `₱${Number(p.amount).toLocaleString()} · ${p.studentRef}`,
        badge: p.status,
        href: `${basePath}/payments/${p.id}`,
      }));
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Global search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
