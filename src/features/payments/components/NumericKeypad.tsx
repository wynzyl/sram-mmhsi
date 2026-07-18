"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface NumericKeypadProps {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  className?: string;
}

export function NumericKeypad({
  onDigit,
  onClear,
  onBackspace,
  className,
}: NumericKeypadProps) {
  const keys = [
    ["7", "8", "9"],
    ["4", "5", "6"],
    ["1", "2", "3"],
    ["C", "0", "⌫"],
  ];

  const handleKeyPress = (key: string) => {
    if (key === "C") {
      onClear();
    } else if (key === "⌫") {
      onBackspace();
    } else {
      onDigit(key);
    }
  };

  return (
    <div className={cn("grid grid-cols-3 gap-1.5", className)}>
      {keys.flat().map((key) => (
        <Button
          key={key}
          type="button"
          variant="secondary"
          className={cn(
            "h-10 text-base font-semibold",
            key === "C" && "text-destructive hover:bg-destructive/10",
            key === "⌫" && "text-muted-foreground"
          )}
          onClick={() => handleKeyPress(key)}
        >
          {key}
        </Button>
      ))}
    </div>
  );
}
