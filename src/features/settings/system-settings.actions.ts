"use server";

import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  RefundCutoffSettingsSchema,
  SYSTEM_SETTING_KEYS,
  type RefundCutoffSettingsFormState,
} from "./system-settings.schema";

/**
 * Update refund cutoff settings.
 * Only super_admin and admin can modify these settings.
 */
export async function updateRefundCutoffSettingsAction(
  _prevState: RefundCutoffSettingsFormState,
  formData: FormData
): Promise<RefundCutoffSettingsFormState> {
  const session = await requireSession();

  // Permission check - only admins can modify system settings
  if (!hasPermission(session.role, "system:manage")) {
    return { message: "You do not have permission to modify system settings." };
  }

  const parsed = RefundCutoffSettingsSchema.safeParse({
    refundCutoffStartDate: formData.get("refundCutoffStartDate"),
    refundCutoffDays: formData.get("refundCutoffDays"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { refundCutoffStartDate, refundCutoffDays } = parsed.data;

  try {
    // Upsert start date setting
    await db
      .insert(systemSettings)
      .values({
        key: SYSTEM_SETTING_KEYS.REFUND_CUTOFF_START_DATE,
        value: refundCutoffStartDate,
        description: "Start date for refund eligibility calculation (school year start)",
        updatedAt: new Date(),
        updatedBy: session.userId,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: refundCutoffStartDate,
          updatedAt: new Date(),
          updatedBy: session.userId,
        },
      });

    // Upsert cutoff days setting
    await db
      .insert(systemSettings)
      .values({
        key: SYSTEM_SETTING_KEYS.REFUND_CUTOFF_DAYS,
        value: String(refundCutoffDays),
        description: "Number of days from start date within which refunds are allowed",
        updatedAt: new Date(),
        updatedBy: session.userId,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: String(refundCutoffDays),
          updatedAt: new Date(),
          updatedBy: session.userId,
        },
      });

    // Audit log
    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "system_settings_updated",
      targetEntity: "system_settings",
      targetId: "refund_cutoff",
      newState: {
        refundCutoffStartDate,
        refundCutoffDays,
      },
    });

    revalidatePath("/admin/settings/cancellation");

    return {
      success: true,
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[system-settings] Failed to update refund cutoff settings:", error);
    return { message: "Failed to save settings. Please try again." };
  }
}

/**
 * Get current refund cutoff settings.
 */
export async function getRefundCutoffSettings(): Promise<{
  refundCutoffStartDate: string | null;
  refundCutoffDays: number | null;
}> {
  const [startDateSetting, cutoffDaysSetting] = await Promise.all([
    db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, SYSTEM_SETTING_KEYS.REFUND_CUTOFF_START_DATE),
    }),
    db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, SYSTEM_SETTING_KEYS.REFUND_CUTOFF_DAYS),
    }),
  ]);

  return {
    refundCutoffStartDate: startDateSetting?.value ?? null,
    refundCutoffDays: cutoffDaysSetting ? parseInt(cutoffDaysSetting.value, 10) : null,
  };
}
