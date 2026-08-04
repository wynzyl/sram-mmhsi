"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { CurriculumVersionRow } from "../curriculums.types";
import { CurriculumStatusBadge } from "./CurriculumStatusBadge";

interface CurriculumVersionChainProps {
  versions: CurriculumVersionRow[];
  currentId: string;
}

export function CurriculumVersionChain({
  versions,
  currentId,
}: CurriculumVersionChainProps) {
  if (versions.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2">
      <span className="text-xs font-medium text-muted-foreground shrink-0">
        Version history:
      </span>
      <div className="flex items-center gap-1">
        {versions.map((version, index) => (
          <div key={version.id} className="flex items-center">
            {index > 0 && (
              <svg
                className="w-4 h-4 text-muted-foreground/50 mx-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
            <Link
              href={`/staff/academics/curriculums/${version.id}`}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors",
                version.id === currentId
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="font-mono">v{version.version}</span>
              <CurriculumStatusBadge status={version.status} className="text-[10px]" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
