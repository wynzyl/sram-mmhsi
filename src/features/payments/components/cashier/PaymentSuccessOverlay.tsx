import { Button } from "@/components/ui/button";

type PaymentSuccessOverlayProps = {
  message?: string;
  onClose: () => void;
};

export function PaymentSuccessOverlay({
  message,
  onClose,
}: PaymentSuccessOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
        <p className="font-display text-xl font-extrabold text-foreground">
          Payment posted
        </p>
        {message && (
          <p className="mt-1 text-sm text-muted-foreground">
            {message}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </div>
  );
}
