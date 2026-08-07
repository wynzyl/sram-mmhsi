"use client";

/**
 * Grading scale legend shown below grade entry grids.
 * Based on DepEd K-12 grading scale.
 */
export function GradeEntryLegend() {
  return (
    <div className="border-t border-border p-4 bg-muted">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Grading Scale
      </h4>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">90-100:</strong> Outstanding
        </span>
        <span>
          <strong className="text-foreground">85-89:</strong> Very Satisfactory
        </span>
        <span>
          <strong className="text-foreground">80-84:</strong> Satisfactory
        </span>
        <span>
          <strong className="text-foreground">75-79:</strong> Fairly Satisfactory
        </span>
        <span>
          <strong className="text-foreground">Below 75:</strong> Did Not Meet Expectations
        </span>
      </div>
    </div>
  );
}
