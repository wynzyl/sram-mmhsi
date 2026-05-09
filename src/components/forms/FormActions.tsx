import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface FormActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  loading?: boolean;
  submitDisabled?: boolean;
}

export function FormActions({
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onCancel,
  loading,
  submitDisabled,
  className,
  ...props
}: FormActionsProps) {
  return (
    <div className={cn("flex items-center gap-3 pt-4", className)} {...props}>
      <Button type="submit" loading={loading} disabled={submitDisabled}>
        {submitLabel}
      </Button>
      {onCancel && (
        <Button type="button" variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
    </div>
  );
}
