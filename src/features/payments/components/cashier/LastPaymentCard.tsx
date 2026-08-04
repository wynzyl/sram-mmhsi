import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LastPaymentCardProps = {
  lastPayment: {
    amount: number;
    paymentMethod: string;
    paymentDateLabel: string;
    orNumber: string | null;
  } | null;
};

export function LastPaymentCard({ lastPayment }: LastPaymentCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Last Payment
        </CardTitle>
      </CardHeader>
      <CardContent>
        {lastPayment ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="font-semibold">
                <CurrencyDisplay amount={lastPayment.amount} />
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Method</span>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {lastPayment.paymentMethod}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Date</span>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {lastPayment.paymentDateLabel}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">OR</span>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {lastPayment.orNumber ? (
                  <ReferenceCode code={lastPayment.orNumber} />
                ) : (
                  "—"
                )}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No payments posted yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
