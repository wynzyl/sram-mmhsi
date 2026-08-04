"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    return (
      <label
        className={cn(
          "relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors",
          "bg-muted has-[:checked]:bg-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
          className
        )}
      >
        <input
          type="checkbox"
          className="peer sr-only"
          ref={ref}
          onChange={handleChange}
          {...props}
        />
        <span
          className={cn(
            "pointer-events-none absolute left-0.5 block h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
            "peer-checked:translate-x-4"
          )}
        />
      </label>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
