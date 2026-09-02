"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { receiptBooklets, users } from "@/lib/db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { ROLES } from "@/lib/constants/roles";
import {
  CreateBookletSchema,
  UpdateBookletSchema,
  formatBookletSeriesCanonical,
  type BookletFormState,
  type UpdateBookletFormState,
} from "../payments.schema";
import { parseFormData } from "@/lib/utils/form-validation";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";

// ─────────────────────────────────────────────────────────────────
// Receipt Booklet Management
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new OR (Official Receipt) booklet.
 *
 * Validates:
 * - User has booklets:manage permission
 * - OR number range doesn't overlap existing booklets with same prefix
 * - Booklet series format is canonical (e.g., "AK 00001-00050")
 *
 * Side effects:
 * - Creates booklet record with status "active"
 * - If assignedCashierId provided, sets as cashier's default booklet
 * - Writes audit log entries
 */
export async function createBookletAction(
  _prevState: BookletFormState,
  formData: FormData
): Promise<BookletFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "booklets:manage")) {
    return { message: "You do not have permission to manage OR booklets." };
  }

  const result = parseFormData(CreateBookletSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  const { startNumber, endNumber, usageMode, assignedCashierId } = parsed.data;
  const prefix = parsed.data.prefix.toUpperCase();
  const seriesCanonical = formatBookletSeriesCanonical(prefix, startNumber, endNumber);

  // Check for overlapping booklets with same prefix
  // Closed-interval overlap: [s1,e1] ∩ [s2,e2] ≠ ∅
  const overlapping = await db
    .select({
      series: receiptBooklets.series,
      startNumber: receiptBooklets.startNumber,
      endNumber: receiptBooklets.endNumber,
    })
    .from(receiptBooklets)
    .where(
      and(
        eq(receiptBooklets.prefix, prefix),
        lte(receiptBooklets.startNumber, endNumber),
        gte(receiptBooklets.endNumber, startNumber)
      )
    )
    .limit(8);

  if (overlapping.length > 0) {
    const detail = overlapping
      .map(
        (row) =>
          `${row.series} (${row.startNumber}–${row.endNumber})`
      )
      .join("; ");
    return {
      errors: {
        _form: [
          `This OR number range overlaps another ${prefix} booklet: ${detail}. Ranges for the same prefix must not overlap.`,
        ],
      },
    };
  }

  try {
    const [newBooklet] = await db
      .insert(receiptBooklets)
      .values({
        series: seriesCanonical,
        prefix,
        startNumber,
        endNumber,
        nextNumber: startNumber,
        status: "active",
        usageMode,
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: receiptBooklets.id });

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "booklet_created",
      targetEntity: "receipt_booklets",
      targetId: newBooklet.id,
      newState: {
        ...parsed.data,
        prefix,
        series: seriesCanonical,
        usageMode,
      },
    }, { throwOnFail: true });

    // If a cashier was selected, set this booklet as their default
    if (assignedCashierId) {
      await db
        .update(users)
        .set({
          defaultBookletId: newBooklet.id,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, assignedCashierId));

      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "cashier_default_booklet_assigned",
        targetEntity: "users",
        targetId: assignedCashierId,
        newState: { defaultBookletId: newBooklet.id, bookletSeries: seriesCanonical },
      });
    }

    revalidatePath("/staff/finance/booklets");
    return { success: true, message: "Receipt booklet created successfully." };
  } catch (error) {
    logger.error("[cashier] Failed to create booklet", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Update an existing OR (Official Receipt) booklet.
 *
 * Admin-only action to modify:
 * - Usage mode (auto_only / manual_only)
 * - Assigned cashier
 * - Status (active / inactive)
 *
 * Only active booklets can be edited; exhausted/voided booklets are immutable.
 * Immutable fields: prefix, startNumber, endNumber, series.
 *
 * Side effects:
 * - If unassigning a cashier, clears their defaultBookletId if it was this booklet
 * - If assigning a new cashier, sets this as their defaultBookletId
 * - Writes audit log with before/after state
 */
export async function updateBookletAction(
  _prevState: UpdateBookletFormState,
  formData: FormData
): Promise<UpdateBookletFormState> {
  const session = await requireSession();

  // Admin-only check (admin or super_admin)
  if (session.role !== ROLES.ADMIN && session.role !== ROLES.SUPER_ADMIN) {
    return { message: "Only administrators can edit receipt booklets." };
  }

  const result = parseFormData(UpdateBookletSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { bookletId, usageMode, assignedCashierId, status } = result.data;

  // Fetch current booklet state
  const [booklet] = await db
    .select({
      id: receiptBooklets.id,
      series: receiptBooklets.series,
      prefix: receiptBooklets.prefix,
      status: receiptBooklets.status,
      usageMode: receiptBooklets.usageMode,
      nextNumber: receiptBooklets.nextNumber,
      startNumber: receiptBooklets.startNumber,
      endNumber: receiptBooklets.endNumber,
    })
    .from(receiptBooklets)
    .where(eq(receiptBooklets.id, bookletId))
    .limit(1);

  if (!booklet) {
    return { message: "Booklet not found." };
  }

  // Only active booklets can be edited
  if (booklet.status !== "active") {
    return {
      message: `Cannot edit a booklet with status "${booklet.status}". Only active booklets can be modified.`,
    };
  }

  // Find current assigned cashier (if any)
  const [currentCashier] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.defaultBookletId, bookletId))
    .limit(1);

  const previousCashierId = currentCashier?.id ?? null;

  try {
    // Update booklet
    await db
      .update(receiptBooklets)
      .set({
        usageMode,
        status,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(receiptBooklets.id, bookletId));

    // Handle cashier assignment changes
    if (previousCashierId !== assignedCashierId) {
      // Clear previous cashier's default booklet
      if (previousCashierId) {
        await db
          .update(users)
          .set({
            defaultBookletId: null,
            updatedBy: session.userId,
            updatedAt: new Date(),
          })
          .where(eq(users.id, previousCashierId));

        await logAudit({
          actor: session.userId,
          actorRole: session.role,
          action: "cashier_default_booklet_cleared",
          targetEntity: "users",
          targetId: previousCashierId,
          previousState: { defaultBookletId: bookletId },
          newState: { defaultBookletId: null },
        });
      }

      // Set new cashier's default booklet
      if (assignedCashierId) {
        // First clear any existing default for this cashier (if different booklet)
        await db
          .update(users)
          .set({
            defaultBookletId: bookletId,
            updatedBy: session.userId,
            updatedAt: new Date(),
          })
          .where(eq(users.id, assignedCashierId));

        await logAudit({
          actor: session.userId,
          actorRole: session.role,
          action: "cashier_default_booklet_assigned",
          targetEntity: "users",
          targetId: assignedCashierId,
          newState: { defaultBookletId: bookletId, bookletSeries: booklet.series },
        });
      }
    }

    // Audit log for booklet update
    await logAudit(
      {
        actor: session.userId,
        actorRole: session.role,
        action: "booklet_updated",
        targetEntity: "receipt_booklets",
        targetId: bookletId,
        previousState: {
          usageMode: booklet.usageMode,
          status: booklet.status,
          assignedCashierId: previousCashierId,
        },
        newState: {
          usageMode,
          status,
          assignedCashierId,
        },
      },
      { throwOnFail: true }
    );

    revalidatePath("/staff/finance/booklets");
    return {
      success: true,
      message: "Receipt booklet updated successfully.",
      bookletId,
    };
  } catch (error) {
    logger.error("[booklet] Failed to update booklet", { error, bookletId });
    return { message: "An unexpected error occurred. Please try again." };
  }
}
