/**
 * SHS Track Categories
 *
 * Defines the categories for Senior High School academic tracks.
 * Track categories help group tracks for reporting and UI organization.
 *
 * Categories:
 * - academic: Traditional academic tracks (STEM, ABM, HUMSS, GAS)
 * - tvl: Technical-Vocational-Livelihood tracks (ICT, HE, IA, AFA)
 * - specialized: Specialized programs (Sports, Arts, etc.)
 *
 * **Database Design:**
 * Stored in strands.track_category (TEXT with CHECK constraint).
 * Each track must belong to exactly one category.
 */

// ─── Track Category Values ────────────────────────────────────────────────────

export const TRACK_CATEGORIES = ["academic", "tvl", "specialized"] as const;

export type TrackCategory = (typeof TRACK_CATEGORIES)[number];

// ─── Display Labels ───────────────────────────────────────────────────────────

export const TRACK_CATEGORY_LABELS: Record<TrackCategory, string> = {
  academic: "Academic Track",
  tvl: "Technical-Vocational-Livelihood Track",
  specialized: "Specialized Track",
};

// ─── Short Labels (for badges) ────────────────────────────────────────────────

export const TRACK_CATEGORY_SHORT_LABELS: Record<TrackCategory, string> = {
  academic: "Academic",
  tvl: "TVL",
  specialized: "Specialized",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get sorted track category options for UI dropdowns
 */
export function getTrackCategoryOptions(): Array<{
  value: TrackCategory;
  label: string;
}> {
  return TRACK_CATEGORIES.map((category) => ({
    value: category,
    label: TRACK_CATEGORY_LABELS[category],
  }));
}

/**
 * Check if a value is a valid track category
 */
export function isValidTrackCategory(value: unknown): value is TrackCategory {
  return TRACK_CATEGORIES.includes(value as TrackCategory);
}
