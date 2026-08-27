import "server-only";
import { db } from "@/lib/db";
import { portalAccounts } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { PortalAccountInfo } from "./portal-accounts.schema";

/**
 * Get portal account info for a student.
 * Returns null if no account exists.
 */
export async function getPortalAccountForStudent(
  studentId: string
): Promise<PortalAccountInfo | null> {
  const account = await db.query.portalAccounts.findFirst({
    where: and(
      eq(portalAccounts.studentId, studentId),
      isNull(portalAccounts.deletedAt)
    ),
    columns: {
      id: true,
      username: true,
      email: true,
      isActive: true,
      forcePasswordChange: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return account ?? null;
}

/**
 * Get portal account by username (reference number).
 * Used for login.
 */
export async function getPortalAccountByUsername(username: string) {
  return db.query.portalAccounts.findFirst({
    where: and(
      eq(portalAccounts.username, username),
      isNull(portalAccounts.deletedAt)
    ),
    columns: {
      id: true,
      studentId: true,
      username: true,
      passwordHash: true,
      email: true,
      isActive: true,
      forcePasswordChange: true,
    },
    with: {
      student: {
        columns: {
          id: true,
          isActive: true,
          status: true,
          referenceNumber: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/**
 * Check if a student already has a portal account.
 */
export async function hasPortalAccount(studentId: string): Promise<boolean> {
  const account = await db.query.portalAccounts.findFirst({
    where: and(
      eq(portalAccounts.studentId, studentId),
      isNull(portalAccounts.deletedAt)
    ),
    columns: { id: true },
  });

  return account !== undefined;
}
