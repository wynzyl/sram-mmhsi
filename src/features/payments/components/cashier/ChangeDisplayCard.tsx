import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { Card, CardContent } from "@/components/ui/card";

type ChangeDisplayCardProps = {
  change: number;
  isReadyToPost: boolean;
};

export function ChangeDisplayCard({
  change,
  isReadyToPost,
}: ChangeDisplayCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Calculated Change
        </p>
        <p className="mt-2 font-display text-3xl font-black text-foreground">
          <CurrencyDisplay amount={change} />
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isReadyToPost ? "Ready for processing" : "Enter amount to continue"}
        </p>
      </CardContent>
    </Card>
  );
}
