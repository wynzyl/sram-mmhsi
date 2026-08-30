"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { editorialFieldClass } from "@/lib/utils/editorial-styles";
import { cn } from "@/lib/utils/cn";
import { useDebounce } from "@/hooks/useDebounce";

export interface StudentPickerOption {
  id: string;
  firstName: string;
  lastName: string;
  referenceNumber: string;
  /** "New", "Transferee", or "Returning" — auto-resolved upstream. */
  typeLabel: string;
  /** Source of the type detection (e.g. last enrollment SY, approved registration). */
  contextLabel: string | null;
}

interface StudentPickerProps {
  students: StudentPickerOption[];
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
  errorMessage?: string;
  placeholder?: string;
}

const MAX_VISIBLE = 50;

/**
 * Typeahead student selector built on the editorial input style.
 * Operates over the already-loaded student array — no extra query.
 */
export default function StudentPicker({
  students,
  value,
  onChange,
  invalid = false,
  errorMessage,
  placeholder = "Search by name or reference (e.g. STU-2026-…)",
}: StudentPickerProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 200);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => students.find((s) => s.id === value) ?? null,
    [students, value]
  );

  // Sync query display when selection changes externally
  useEffect(() => {
    if (selected) {
      setQuery(`${selected.lastName}, ${selected.firstName}`); // eslint-disable-line react-hooks/set-state-in-effect -- Sync selection to display
    } else {
      setQuery("");  
    }
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const all = q
      ? students.filter((s) => {
          const haystack = `${s.lastName} ${s.firstName} ${s.referenceNumber}`.toLowerCase();
          return haystack.includes(q);
        })
      : students;
    return all.slice(0, MAX_VISIBLE);
  }, [students, debouncedQuery]);

  // Reset active index when filtered results change
  useEffect(() => {
    setActiveIndex(0); // eslint-disable-line react-hooks/set-state-in-effect -- Reset on filter change
  }, [filtered.length, debouncedQuery]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const candidate = filtered[activeIndex];
      if (candidate) {
        onChange(candidate.id);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="student-picker-list"
          className={editorialFieldClass({
            invalid,
            className: "pl-9 pr-9",
          })}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (selected && e.target.value !== `${selected.lastName}, ${selected.firstName}`) {
              onChange("");
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div
          id="student-picker-list"
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg"
        >
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No students match{" "}
              <strong className="text-foreground">{query}</strong>.
            </p>
          ) : (
            <ul className="py-1">
              {filtered.map((s, i) => {
                const isActive = i === activeIndex;
                const isSelected = s.id === value;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => {
                        onChange(s.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors",
                        isActive ? "bg-primary/15" : "bg-transparent",
                        "hover:bg-primary/15"
                      )}
                    >
                      <span
                          className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-base font-semibold leading-tight text-foreground">
                          {s.lastName}, {s.firstName}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                            {s.referenceNumber}
                          </code>
                          <span aria-hidden="true">·</span>
                          <span>
                            <span className="font-medium text-muted-foreground">{s.typeLabel}</span>
                            {s.contextLabel ? ` · ${s.contextLabel}` : null}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {students.length > MAX_VISIBLE && filtered.length === MAX_VISIBLE && (
            <p className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
              Showing first {MAX_VISIBLE} matches — refine your search to see more.
            </p>
          )}
        </div>
      )}

      {errorMessage && (
        <p className="mt-1 text-sm text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}
