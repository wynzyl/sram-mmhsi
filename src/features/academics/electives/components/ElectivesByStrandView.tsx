"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { ElectiveSubjectsTable } from "./ElectiveSubjectsTable";
import type { ElectivesByStrand, ElectiveSubjectView } from "../electives.schema";
import { SHS_STRAND_LABELS, type ShsStrandCode } from "@/lib/constants/strands";

interface ElectivesByStrandViewProps {
  electivesByStrand: ElectivesByStrand[];
  allElectives: ElectiveSubjectView[];
}

export function ElectivesByStrandView({
  electivesByStrand,
  allElectives,
}: ElectivesByStrandViewProps) {
  const [activeTab, setActiveTab] = useState("all");

  // Get active subjects based on selected tab
  const activeSubjects =
    activeTab === "all"
      ? allElectives
      : electivesByStrand.find((s) => s.strand.id === activeTab)?.subjects || [];

  const activeStrand =
    activeTab !== "all"
      ? electivesByStrand.find((s) => s.strand.id === activeTab)?.strand
      : null;

  return (
    <div className="w-full">
      {/* Tab buttons */}
      <div className="flex flex-wrap gap-1 border-b pb-2">
        <Button
          variant={activeTab === "all" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("all")}
          className={cn(
            "rounded-b-none",
            activeTab === "all" && "border-b-2 border-primary"
          )}
        >
          All
          <Badge variant="secondary" className="ml-2">
            {allElectives.length}
          </Badge>
        </Button>
        {electivesByStrand.map(({ strand, subjects }) => (
          <Button
            key={strand.id}
            variant={activeTab === strand.id ? "primary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(strand.id)}
            className={cn(
              "rounded-b-none",
              activeTab === strand.id && "border-b-2 border-primary"
            )}
          >
            {SHS_STRAND_LABELS[strand.code as ShsStrandCode] || strand.code}
            <Badge variant="secondary" className="ml-2">
              {subjects.length}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-4">
        {activeStrand && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{activeStrand.name}</h3>
            <p className="text-sm text-muted-foreground">
              Elective subjects available for{" "}
              {SHS_STRAND_LABELS[activeStrand.code as ShsStrandCode] ||
                activeStrand.code}{" "}
              strand students.
            </p>
          </div>
        )}
        <ElectiveSubjectsTable subjects={activeSubjects} />
      </div>
    </div>
  );
}
