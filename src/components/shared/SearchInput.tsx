"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

interface SearchInputProps {
  /** Current search value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional className for the container */
  className?: string;
  /** Whether to show a clear button when there's input */
  showClear?: boolean;
  /** Input type (search or text) */
  type?: "search" | "text";
}

/**
 * Reusable search input with icon and optional clear button.
 * Standardizes the search input pattern across the application.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
  showClear = false,
  type = "text",
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("pl-9", showClear && value && "pr-9")}
      />
      {showClear && value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
