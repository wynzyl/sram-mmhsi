import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AssessmentSummaryCardProps = {
  totalAssessed: number;
  totalPaid: number;
  balance: number;
};

export function AssessmentSummaryCard({
  totalAssessed,
  totalPaid,
  balance,
}: AssessmentSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Assessment Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Total assessed</span>
          <span className="font-semibold">
            <CurrencyDisplay amount={totalAssessed} />
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Paid to date</span>
          <span className="font-semibold text-success">
            <CurrencyDisplay amount={totalPaid} />
          </span>
        </div>
        <div className="h-px w-full bg-border" />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Remaining balance
          </span>
          <span className="font-display text-lg font-black text-primary">
            <CurrencyDisplay amount={balance} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
