"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginatedResult } from "@/lib/types/pagination";

type PaginationControlsProps = {
  pagination: PaginatedResult<any>["pagination"];
  basePath: string;
};

export function PaginationControls({ pagination, basePath }: PaginationControlsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { page, pageSize, totalRecords, totalPages, hasNextPage, hasPreviousPage } = pagination;

  // Build URL with updated page number
  const createPageUrl = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    return `${pathname}?${params.toString()}`;
  };

  // Calculate record range
  const startRecord = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalRecords);

  if (totalRecords === 0) {
    return null; // Don't show pagination if no records
  }

  return (
    <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
      {/* Record count */}
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{startRecord}</span> to{" "}
        <span className="font-medium text-foreground">{endRecord}</span> of{" "}
        <span className="font-medium text-foreground">{totalRecords}</span> records
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-2">
        <Link href={createPageUrl(page - 1)} aria-disabled={!hasPreviousPage}>
          <Button variant="secondary" size="sm" disabled={!hasPreviousPage} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
        </Link>

        <div className="flex items-center gap-1 px-2 text-sm">
          <span className="text-muted-foreground">Page</span>
          <span className="font-medium text-foreground">{page}</span>
          <span className="text-muted-foreground">of</span>
          <span className="font-medium text-foreground">{totalPages}</span>
        </div>

        <Link href={createPageUrl(page + 1)} aria-disabled={!hasNextPage}>
          <Button variant="secondary" size="sm" disabled={!hasNextPage} className="gap-1">
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
