import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type PaymentProcessingHeaderProps = {
  referenceNumber: string;
  studentName: string;
  gradeLevel: string;
  schoolYear: string;
  onBack: () => void;
};

export function PaymentProcessingHeader({
  referenceNumber,
  studentName,
  gradeLevel,
  schoolYear,
  onBack,
}: PaymentProcessingHeaderProps) {
  return (
    <div className="shrink-0 border-b border-border bg-card px-4 py-4 md:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Payment Processing
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-sm font-mono font-semibold text-foreground">
              {referenceNumber}
            </span>
            <h1
              id="cashier-payment-modal-title"
              className="font-display text-lg font-extrabold text-foreground md:text-xl"
            >
              {studentName}
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {gradeLevel} · {schoolYear}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={onBack}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to queue
        </Button>
      </div>
    </div>
  );
}
