"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { schoolYearFreshness } from "@/lib/query/staleness";
import { useActiveSchoolYearId } from "@/components/providers/ActiveSchoolYearProvider";
import { createStudentAction, updateStudentAction } from "../students.actions";
import type {
  CreateStudentFormState,
  UpdateStudentFormState,
} from "../students.schema";
import type { StudentDirectoryRow } from "../students.queries";
import type { StudentSortBy, StudentSortDir } from "@/lib/utils/student-directory-href";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type StudentFilters = {
  q?: string;
  page?: number;
  schoolYearId?: string;
  gradeLevelId?: string;
  sortBy?: StudentSortBy;
  sortDir?: StudentSortDir;
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
  if (filters.sortBy) {
    params.set("sortBy", filters.sortBy);
    if (filters.sortDir === "desc") params.set("sortDir", "desc");
  }

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
  // Normalize filters for consistent cache keys AND fetch requests
  const normalizedFilters: StudentFilters = {
    q: filters.q?.trim() || "",
    page: filters.page || 1,
    schoolYearId: filters.schoolYearId || undefined,
    gradeLevelId: filters.gradeLevelId || undefined,
    sortBy: filters.sortBy,
    sortDir: filters.sortBy ? filters.sortDir ?? "asc" : undefined,
  };

  // Freshness is school-year aware: rows for the active school year stay
  // perpetually fresh (live enrollment/assessment/payment data), while past
  // years use a long stale window.
  const activeSchoolYearId = useActiveSchoolYearId();

  return useQuery({
    queryKey: queryKeys.students.list(normalizedFilters),
    queryFn: () => fetchStudents(normalizedFilters),
    // Keep previous data during refetch (smooth pagination experience)
    placeholderData: keepPreviousData,
    ...schoolYearFreshness(normalizedFilters.schoolYearId, activeSchoolYearId),
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

// ─────────────────────────────────────────────────────────────────
// Mutation Hooks
// ─────────────────────────────────────────────────────────────────

/**
 * Create a student (with registration).
 *
 * On success, invalidates the entire `students` cache so every directory
 * list/detail refetches with fresh data. This is what keeps the master
 * list in sync — `revalidatePath` in the action only busts Next's *server*
 * cache, not this client-side TanStack cache.
 */
export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation<CreateStudentFormState, Error, FormData>({
    mutationFn: (formData) => createStudentAction({}, formData),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      }
    },
  });
}

/**
 * Update an existing student.
 *
 * Invalidates both the lists and the specific student's detail entry so the
 * directory row and the profile page both refetch. Falls back to the broad
 * `students.all` key when the id isn't present on the result.
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation<UpdateStudentFormState, Error, FormData>({
    mutationFn: (formData) => updateStudentAction({}, formData),
    onSuccess: (result, formData) => {
      if (!result.success) return;

      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });

      const studentId = formData.get("studentId");
      if (typeof studentId === "string" && studentId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.students.detail(studentId),
        });
      }
    },
  });
}
