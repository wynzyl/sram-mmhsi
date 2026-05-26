"use client";

import { CalendarDays, GraduationCap, UserCircle2 } from "lucide-react";
import { DataCard, DataCardBody } from "@/components/ui/editorial/DataCard";
import { StatusIndicator } from "@/components/ui/editorial/StatusIndicator";
import { cn } from "@/lib/utils/cn";

export type PlacementType = "new_student" | "transferee" | "old_student";

const TYPE_LABEL: Record<PlacementType, string> = {
  new_student: "New",
  transferee: "Transferee",
  old_student: "Returning",
};

interface PlacementPreviewCardProps {
  studentName: string | null;
  referenceNumber: string | null;
  schoolYearLabel: string | null;
  gradeLevelName: string | null;
  studentType: PlacementType | null;
  /** Optional caption echoing the source of the auto-detection. */
  contextHint?: string | null;
  className?: string;
}

/**
 * Sticky right-rail card that re-renders as the wizard fills in.
 *
 * Visual moment of the redesign: a Crimson-Pro nameplate that reads as a
 * physical "academic record card forming" rather than a generic preview.
 */
export default function PlacementPreviewCard({
  studentName,
  referenceNumber,
  schoolYearLabel,
  gradeLevelName,
  studentType,
  contextHint,
  className,
}: PlacementPreviewCardProps) {
  const isEmpty = !studentName;

  return (
    <DataCard
      className={cn(
        "relative overflow-hidden",
        "bg-primary/[0.03]",
        "border-primary/15",
        className
      )}
    >
      {/* Decorative corner mark — quiet editorial flourish */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 blur-xl"
      />

      <DataCardBody className="space-y-5 px-6 py-6">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
            Placement Plate
          </span>
          {!isEmpty && <StatusIndicator status="pending" label="Pending after save" pulse size="sm" />}
        </div>

        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            <NameplateBlock
              studentName={studentName}
              referenceNumber={referenceNumber}
            />

            <div className="border-t border-dashed border-primary/15" />

            <PlacementRow
              icon={<CalendarDays className="h-4 w-4" />}
              label="School Year"
              value={schoolYearLabel ?? "—"}
              valueIsMono={Boolean(schoolYearLabel)}
            />
            <PlacementRow
              icon={<GraduationCap className="h-4 w-4" />}
              label="Grade Level"
              value={gradeLevelName ?? "Pending grade selection"}
              dim={!gradeLevelName}
            />
            <PlacementRow
              icon={<UserCircle2 className="h-4 w-4" />}
              label="Type"
              value={studentType ? TYPE_LABEL[studentType] : "Pending"}
              dim={!studentType}
            />

            {contextHint && (
              <p className="mt-1 border-l-2 border-primary/30 pl-3 text-xs leading-relaxed text-muted-foreground">
                {contextHint}
              </p>
            )}
          </>
        )}
      </DataCardBody>
    </DataCard>
  );
}

function NameplateBlock({
  studentName,
  referenceNumber,
}: {
  studentName: string;
  referenceNumber: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="font-display text-[1.65rem] font-bold uppercase leading-[1.1] tracking-tight text-foreground">
        {studentName}
      </h3>
      {referenceNumber ? (
        <code className="inline-block rounded-sm bg-gray-200 px-2 py-0.5 font-mono text-xs text-foreground shadow-sm ring-1 ring-gray-200 dark:bg-gray-800">
          {referenceNumber}
        </code>
      ) : (
        <span className="block text-xs italic text-muted-foreground">No reference on record</span>
      )}
    </div>
  );
}

function PlacementRow({
  icon,
  label,
  value,
  valueIsMono = false,
  dim = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueIsMono?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-primary ring-1 ring-primary/15">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-sm font-medium leading-snug text-foreground",
            valueIsMono && "font-mono",
            dim && "italic text-muted-foreground"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-2 py-2">
      <div className="h-12 w-32 rounded-sm border border-dashed border-primary/30" />
      <div className="h-3 w-20 rounded-sm bg-primary/[0.08]" />
      <p className="mt-3 max-w-[20rem] text-xs leading-relaxed text-muted-foreground">
        Pick a student and the placement record forms here in real time —
        ready to confirm before the enrollment is created.
      </p>
    </div>
  );
}
