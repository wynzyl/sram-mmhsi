"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { STANDARD_STALE_TIME } from "@/lib/query/staleness";

/**
 * Hook that returns a prefetch function for student details.
 * Use this to prefetch student data on hover for instant navigation.
 *
 * @example
 * ```tsx
 * const prefetchStudent = usePrefetchStudent();
 *
 * <TableRow onMouseEnter={() => prefetchStudent(student.id)}>
 *   ...
 * </TableRow>
 * ```
 */
export function usePrefetchStudent() {
  const queryClient = useQueryClient();

  return useCallback(
    (studentId: string) => {
      if (!studentId) return;

      queryClient.prefetchQuery({
        queryKey: queryKeys.students.detail(studentId),
        queryFn: async () => {
          const res = await fetch(`/api/students/${studentId}`);
          if (!res.ok) {
            throw new Error(`Failed to prefetch student: ${res.status}`);
          }
          return res.json();
        },
        staleTime: STANDARD_STALE_TIME,
      });
    },
    [queryClient]
  );
}

/**
 * Hook that returns a prefetch function for student assessments.
 * Use this to prefetch assessment data when hovering over a student.
 */
export function usePrefetchStudentAssessments() {
  const queryClient = useQueryClient();

  return useCallback(
    (studentId: string) => {
      if (!studentId) return;

      queryClient.prefetchQuery({
        queryKey: queryKeys.assessments.byStudent(studentId),
        queryFn: async () => {
          const res = await fetch(`/api/students/${studentId}/assessments`);
          if (!res.ok) {
            throw new Error(`Failed to prefetch assessments: ${res.status}`);
          }
          return res.json();
        },
        staleTime: STANDARD_STALE_TIME,
      });
    },
    [queryClient]
  );
}
