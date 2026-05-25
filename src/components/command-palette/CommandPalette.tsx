"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, User, BookOpen, FileText, CreditCard, ArrowRight, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils/cn";
import type { GlobalSearchResponse, SearchCategory, SearchResultItem } from "@/lib/validators/search.schema";
import { SEARCH_CATEGORY_LABELS } from "@/lib/validators/search.schema";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<SearchCategory, React.ReactNode> = {
  students: <User className="h-4 w-4" />,
  enrollments: <BookOpen className="h-4 w-4" />,
  assessments: <FileText className="h-4 w-4" />,
  payments: <CreditCard className="h-4 w-4" />,
};

type FlatResult = SearchResultItem & { category: SearchCategory };

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [results, setResults] = useState<GlobalSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Flatten results for keyboard navigation
  const flatResults: FlatResult[] = results
    ? [
        ...results.students.map((r) => ({ ...r, category: "students" as const })),
        ...results.enrollments.map((r) => ({ ...r, category: "enrollments" as const })),
        ...results.assessments.map((r) => ({ ...r, category: "assessments" as const })),
        ...results.payments.map((r) => ({ ...r, category: "payments" as const })),
      ]
    : [];

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery("");
      setResults(null);
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Fetch search results
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchResults() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
          signal: controller.signal,
          cache: 'no-store',  // Always fetch fresh data after transactions
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setActiveIndex(0);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Search error:", err);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchResults();

    return () => controller.abort();
  }, [debouncedQuery]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (flatResults.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(flatResults.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = flatResults[activeIndex];
        if (selected) {
          router.push(selected.href);
          onClose();
        }
      }
    },
    [flatResults, activeIndex, onClose, router]
  );

  // Scroll active item into view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const hasResults = flatResults.length > 0;
  const showEmptyState = debouncedQuery.length >= 2 && !isLoading && !hasResults;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="relative flex items-center border-b border-[var(--color-border)] px-4">
          <Search className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students, enrollments, assessments, payments..."
            className="flex-1 bg-transparent px-3 py-4 text-base text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
          />
          {isLoading && (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--color-text-muted)]" />
          )}
          {query && !isLoading && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto overscroll-contain"
          role="listbox"
        >
          {showEmptyState && (
            <div className="px-4 py-12 text-center">
              <p className="text-[var(--color-text-muted)]">
                No results found for &quot;{debouncedQuery}&quot;
              </p>
            </div>
          )}

          {hasResults && (
            <div className="py-2">
              {(["students", "enrollments", "assessments", "payments"] as SearchCategory[]).map(
                (category) => {
                  const items = results?.[category] ?? [];
                  if (items.length === 0) return null;

                  // Calculate the start index for this category
                  const categoryStartIndex = flatResults.findIndex((r) => r.category === category);

                  return (
                    <div key={category}>
                      {/* Category header */}
                      <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                        {CATEGORY_ICONS[category]}
                        <span>{SEARCH_CATEGORY_LABELS[category]}</span>
                      </div>

                      {/* Category items */}
                      {items.map((item, idx) => {
                        const globalIndex = categoryStartIndex + idx;
                        const isActive = globalIndex === activeIndex;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            data-index={globalIndex}
                            role="option"
                            aria-selected={isActive}
                            onClick={() => {
                              router.push(item.href);
                              onClose();
                            }}
                            onMouseEnter={() => setActiveIndex(globalIndex)}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                              isActive
                                ? "bg-[var(--color-primary)]/10"
                                : "hover:bg-[var(--color-surface-3)]"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[var(--color-text)] truncate">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="shrink-0 rounded-full bg-[var(--color-surface-3)] px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--color-text-muted)]">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-sm text-[var(--color-text-muted)] truncate">
                                {item.subtitle}
                              </p>
                            </div>
                            {isActive && (
                              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-text-muted)]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-3)] px-1.5 py-0.5 font-mono text-[10px]">
                ↑↓
              </kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-3)] px-1.5 py-0.5 font-mono text-[10px]">
                Enter
              </kbd>
              <span>Open</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-3)] px-1.5 py-0.5 font-mono text-[10px]">
                Esc
              </kbd>
              <span>Close</span>
            </span>
          </div>
          <span className="font-mono">Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
