import { z } from "zod";

/**
 * A single search result item displayed in the command palette.
 */
export const SearchResultItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  badge: z.string().optional(),
  href: z.string(),
});

export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;

/**
 * Grouped search results by category.
 */
export const GlobalSearchResponseSchema = z.object({
  students: z.array(SearchResultItemSchema),
  enrollments: z.array(SearchResultItemSchema),
  assessments: z.array(SearchResultItemSchema),
  payments: z.array(SearchResultItemSchema),
});

export type GlobalSearchResponse = z.infer<typeof GlobalSearchResponseSchema>;

/**
 * Categories for search results.
 */
export const SEARCH_CATEGORIES = [
  "students",
  "enrollments",
  "assessments",
  "payments",
] as const;

export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

/**
 * Human-readable labels for search categories.
 */
export const SEARCH_CATEGORY_LABELS: Record<SearchCategory, string> = {
  students: "Students",
  enrollments: "Enrollments",
  assessments: "Assessments",
  payments: "Payments",
};
