"use client";

import type { PlacementType } from "./components/PlacementPreviewCard";

export type WizardStep = 1 | 2 | 3;

/**
 * Human-readable labels for enrollment placement types.
 * Single source of truth — import this instead of defining inline.
 */
export const TYPE_LABEL: Record<PlacementType, string> = {
  new_student: "New",
  transferee: "Transferee",
  old_student: "Returning",
};
