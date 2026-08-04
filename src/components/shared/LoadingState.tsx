import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";

export type LoadingStateProps = {
  /** Loading message to display */
  message?: string;
  /** Size of the spinner */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes for the container */
  className?: string;
  /** Center the loading state in its container */
  centered?: boolean;
};

/**
 * Loading state indicator with optional message.
 * Extracted for reusability (audit 2026-07).
 *
 * @example
 * <LoadingState message="Loading students..." />
 * <LoadingState size="lg" centered />
 */
export function LoadingState({
  message = "Loading...",
  size = "md",
  className,
  centered = true,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex-row-2 text-muted-foreground",
        centered && "justify-center py-8",
        className
      )}
    >
      <Spinner size={size} />
      {message && <span className="text-sm">{message}</span>}
    </div>
  );
}
