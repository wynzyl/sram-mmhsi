"use server";

import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";
import { logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  RefundCutoffSettingsSchema,
  SpedFeeSettingsSchema,
  SYSTEM_SETTING_KEYS,
  type RefundCutoffSettingsFormState,
  type SpedFeeSettingsFormState,
} from "./system-settings.schema";
import { SPED_FEE_DEFAULT_AMOUNT } from "@/lib/utils/special-education";

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
    return { message: PERMISSION_ERRORS.SETTINGS_MODIFY };
  }

  const result = parseFormData(RefundCutoffSettingsSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { refundCutoffStartDate, refundCutoffDays } = result.data;

  try {
    // Both settings must succeed or fail together — partial saves would leave
    // refund cutoff configuration inconsistent.
    await db.transaction(async (tx) => {
      const now = new Date();

      await tx
        .insert(systemSettings)
        .values({
          key: SYSTEM_SETTING_KEYS.REFUND_CUTOFF_START_DATE,
          value: refundCutoffStartDate,
          description: "Start date for refund eligibility calculation (school year start)",
          updatedAt: now,
          updatedBy: session.userId,
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: refundCutoffStartDate,
            updatedAt: now,
            updatedBy: session.userId,
          },
        });

      await tx
        .insert(systemSettings)
        .values({
          key: SYSTEM_SETTING_KEYS.REFUND_CUTOFF_DAYS,
          value: String(refundCutoffDays),
          description: "Number of days from start date within which refunds are allowed",
          updatedAt: now,
          updatedBy: session.userId,
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: String(refundCutoffDays),
            updatedAt: now,
            updatedBy: session.userId,
          },
        });
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

// ─── SPED Fee Settings ───────────────────────────────────────────────────────

/**
 * Update SPED fee amount setting.
 * Only finance_officer, admin, and super_admin can modify.
 */
export async function updateSpedFeeSettingsAction(
  _prevState: SpedFeeSettingsFormState,
  formData: FormData
): Promise<SpedFeeSettingsFormState> {
  const session = await requireSession();

  // Permission check - finance officers and admins can modify
  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: PERMISSION_ERRORS.SETTINGS_SPED_FEE };
  }

  const result = parseFormData(SpedFeeSettingsSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { spedFeeAmount } = result.data;

  try {
    const now = new Date();

    await db
      .insert(systemSettings)
      .values({
        key: SYSTEM_SETTING_KEYS.SPED_FEE_AMOUNT,
        value: String(spedFeeAmount),
        description: "Default Special Education (SPED) fee amount",
        updatedAt: now,
        updatedBy: session.userId,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: String(spedFeeAmount),
          updatedAt: now,
          updatedBy: session.userId,
        },
      });

    // Audit log
    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "system_settings_updated",
      targetEntity: "system_settings",
      targetId: "sped_fee_amount",
      newState: { spedFeeAmount },
    });

    revalidatePath("/staff/finance/setup");

    return {
      success: true,
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[system-settings] Failed to update SPED fee settings:", error);
    return { message: "Failed to save settings. Please try again." };
  }
}

/**
 * Get current SPED fee amount setting.
 * Returns the configured amount or the default if not set.
 */
export async function getSpedFeeAmount(): Promise<number> {
  const setting = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, SYSTEM_SETTING_KEYS.SPED_FEE_AMOUNT),
  });

  if (setting) {
    const parsed = parseInt(setting.value, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return SPED_FEE_DEFAULT_AMOUNT;
}
