/**
 * Types for curriculum management.
 * Safe to import in client components (no server-only dependencies).
 *
 * @module features/academics/curriculums/curriculums.types
 */

import type { CurriculumStatus } from "./curriculums.schema";

export type CurriculumListRow = {
  id: string;
  name: string;
  description: string | null;
  status: CurriculumStatus;
  version: number;
  rootId: string | null;
  subjectCount: number;
  adoptionCount: number;
  createdAt: Date;
  createdByName: string | null;
  publishedAt: Date | null;
};

export type CurriculumDetail = {
  id: string;
  name: string;
  description: string | null;
  status: CurriculumStatus;
  version: number;
  rootId: string | null;
  predecessorId: string | null;
  publishedAt: Date | null;
  publishedByName: string | null;
  archivedAt: Date | null;
  archivedByName: string | null;
  createdAt: Date;
  createdByName: string | null;
  updatedAt: Date;
  subjects: SubjectListRow[];
  adoptions: AdoptionRow[];
};

export type SubjectListRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  gradeLevelId: string | null;
  gradeLevelName: string | null;
  units: string;
  sequenceOrder: number;
  isCore: boolean;
  isDeleted: boolean;
  createdAt: Date;
};

export type AdoptionRow = {
  id: string;
  schoolYearId: string;
  schoolYearLabel: string;
  gradeLevelId: string;
  gradeLevelName: string;
  isActiveYear: boolean;
  adoptedAt: Date;
  adoptedByName: string | null;
};

export type CurriculumVersionRow = {
  id: string;
  name: string;
  status: CurriculumStatus;
  version: number;
  publishedAt: Date | null;
  createdAt: Date;
};

export type AdoptionMatrixCell = {
  gradeLevelId: string;
  gradeLevelName: string;
  gradeLevelOrder: number;
  curriculumId: string | null;
  curriculumName: string | null;
  curriculumStatus: CurriculumStatus | null;
  adoptionId: string | null;
  adoptedAt: Date | null;
};

export type CurriculumDropdownOption = {
  id: string;
  name: string;
  status: CurriculumStatus;
  version: number;
};
