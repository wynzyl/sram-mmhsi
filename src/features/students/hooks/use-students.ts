"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { StudentDirectoryRow } from "../students.queries";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type StudentFilters = {
  q?: string;
  page?: number;
  schoolYearId?: string;
  gradeLevelId?: string;
};

export type StudentDirectoryResponse = {
  rows: StudentDirectoryRow[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  schoolYearOptions: { id: string; label: string }[];
  gradeLevelOptions: { id: string; name: string }[];
  emptyMessage: string;
  canCreate: boolean;
};

// ─────────────────────────────────────────────────────────────────
// Fetch Function
// ─────────────────────────────────────────────────────────────────

async function fetchStudents(
  filters: StudentFilters
): Promise<StudentDirectoryResponse> {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  if (filters.schoolYearId) params.set("schoolYearId", filters.schoolYearId);
  if (filters.gradeLevelId) params.set("gradeLevelId", filters.gradeLevelId);

  const queryString = params.toString();
  const url = `/api/students${queryString ? `?${queryString}` : ""}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch students: ${res.status}`);
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────────
// Query Hook
// ─────────────────────────────────────────────────────────────────

/**
 * Fetches the student directory with filters and pagination.
 *
 * Features:
 * - Keeps previous data while fetching (smooth pagination)
 * - Stale time of 30 seconds (balance freshness vs. performance)
 * - Automatic refetch on filter changes
 */
export function useStudents(filters: StudentFilters = {}) {
  // Normalize filters for consistent cache keys
  const normalizedFilters: Record<string, unknown> = {
    q: filters.q?.trim() || "",
    page: filters.page || 1,
    schoolYearId: filters.schoolYearId || null,
    gradeLevelId: filters.gradeLevelId || null,
  };

  return useQuery({
    queryKey: queryKeys.students.list(normalizedFilters),
    queryFn: () => fetchStudents(filters),
    // Keep previous data during refetch (smooth pagination experience)
    placeholderData: keepPreviousData,
    // 30 second stale time (frequent updates may happen)
    staleTime: 30 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────
// Helper Hooks
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch a single student by ID.
 */
export function useStudent(studentId: string | null) {
  return useQuery({
    queryKey: queryKeys.students.detail(studentId ?? ""),
    queryFn: async () => {
      if (!studentId) return null;

      const res = await fetch(`/api/students/${studentId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch student: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!studentId,
    staleTime: 60 * 1000,
  });
}
