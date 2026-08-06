/**
 * SHS Academic Strand Constants
 *
 * @deprecated The enum-based approach is deprecated in favor of admin-managed tracks.
 * Tracks are now stored as TEXT in strands.code, allowing dynamic creation via UI.
 *
 * For new code, use:
 * - Query strands table directly for available tracks
 * - Use TrackCategory from '@/lib/constants/track-categories' for categorization
 *
 * These constants are kept for backward compatibility with existing code.
 *
 * **Adding a New Track (New Approach):**
 * 1. Use the admin UI at /staff/academics/strands to create new tracks
 * 2. Tracks are stored in the `strands` table with TEXT code
 * 3. No migration needed for new tracks
 *
 * **Database Design:**
 * Strands are stored in the `strands` table.
 * - strands.code: TEXT (admin-managed, no longer enum)
 * - strands.short_code: TEXT (display abbreviation)
 * - strands.track_category: TEXT (academic, tvl, specialized)
 * Access via relationship: enrollment → strand → code/name
 */

/**
 * SHS Strand Codes - used as enum values
 * @deprecated Use database query for strands instead. Tracks are now admin-managed.
 */
export const SHS_STRAND_CODES = [
  // Academic Track
  "STEM",
  "ABM",
  "HUMSS",
  "GAS",
  // TVL Track
  "TVL-ICT",
  "TVL-HE",
  "TVL-IA",
  "TVL-AFA",
] as const satisfies readonly [string, ...string[]];

export type ShsStrandCode = (typeof SHS_STRAND_CODES)[number];

/**
 * Human-readable labels for each strand
 */
export const SHS_STRAND_LABELS: Record<ShsStrandCode, string> = {
  // Academic Track
  STEM: "Science, Technology, Engineering, and Mathematics",
  ABM: "Accountancy, Business, and Management",
  HUMSS: "Humanities and Social Sciences",
  GAS: "General Academic Strand",
  // TVL Track
  "TVL-ICT": "TVL - Information and Communications Technology",
  "TVL-HE": "TVL - Home Economics",
  "TVL-IA": "TVL - Industrial Arts",
  "TVL-AFA": "TVL - Agri-Fishery Arts",
};

/**
 * Short labels for UI badges and compact displays
 */
export const SHS_STRAND_SHORT_LABELS: Record<ShsStrandCode, string> = {
  STEM: "STEM",
  ABM: "ABM",
  HUMSS: "HUMSS",
  GAS: "GAS",
  "TVL-ICT": "ICT",
  "TVL-HE": "HE",
  "TVL-IA": "IA",
  "TVL-AFA": "AFA",
};

/**
 * Track categories for grouping strands
 * @deprecated Use TRACK_CATEGORIES from '@/lib/constants/track-categories' instead.
 * The new system includes 'specialized' category in addition to 'academic' and 'tvl'.
 */
export const SHS_TRACKS = ["academic", "tvl"] as const;

/** @deprecated Use TrackCategory from '@/lib/constants/track-categories' */
export type ShsTrack = (typeof SHS_TRACKS)[number];

/** @deprecated Use TRACK_CATEGORY_LABELS from '@/lib/constants/track-categories' */
export const SHS_TRACK_LABELS: Record<ShsTrack, string> = {
  academic: "Academic Track",
  tvl: "Technical-Vocational-Livelihood Track",
};

/**
 * Map strands to their track
 */
export const SHS_STRAND_TRACKS: Record<ShsStrandCode, ShsTrack> = {
  STEM: "academic",
  ABM: "academic",
  HUMSS: "academic",
  GAS: "academic",
  "TVL-ICT": "tvl",
  "TVL-HE": "tvl",
  "TVL-IA": "tvl",
  "TVL-AFA": "tvl",
};

/**
 * Display order for strands (used in dropdowns, tables)
 */
export const SHS_STRAND_ORDER: Record<ShsStrandCode, number> = {
  STEM: 1,
  ABM: 2,
  HUMSS: 3,
  GAS: 4,
  "TVL-ICT": 5,
  "TVL-HE": 6,
  "TVL-IA": 7,
  "TVL-AFA": 8,
};

/**
 * Get strands for a specific track
 */
export function getStrandsForTrack(track: ShsTrack): ShsStrandCode[] {
  return SHS_STRAND_CODES.filter((code) => SHS_STRAND_TRACKS[code] === track);
}

/**
 * Get the track for a strand code
 */
export function getTrackForStrand(strandCode: ShsStrandCode): ShsTrack {
  return SHS_STRAND_TRACKS[strandCode];
}

/**
 * Check if a grade level requires strand selection (SHS only)
 */
export function requiresStrandSelection(gradeLevelName: string): boolean {
  return gradeLevelName === "Grade 11" || gradeLevelName === "Grade 12";
}

/**
 * Get sorted strands for dropdown options
 * @deprecated Query strands table directly instead. Use getActiveTracksForSHS() from strands.queries.ts.
 */
export function getSortedStrands(): Array<{
  code: ShsStrandCode;
  label: string;
  shortLabel: string;
  track: ShsTrack;
}> {
  return [...SHS_STRAND_CODES]
    .sort((a, b) => SHS_STRAND_ORDER[a] - SHS_STRAND_ORDER[b])
    .map((code) => ({
      code,
      label: SHS_STRAND_LABELS[code],
      shortLabel: SHS_STRAND_SHORT_LABELS[code],
      track: SHS_STRAND_TRACKS[code],
    }));
}
