"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { receiptBooklets, users } from "@/lib/db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  CreateBookletSchema,
  formatBookletSeriesCanonical,
  type BookletFormState,
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
