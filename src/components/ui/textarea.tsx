import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "w-full px-3 py-2 border rounded-md text-sm transition-colors duration-150",
          "bg-card text-foreground",
          "focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "placeholder:text-muted-foreground",
          "min-h-[80px] resize-y",
          error
            ? "border-destructive focus:border-destructive focus:ring-destructive/20"
            : "border-input",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
