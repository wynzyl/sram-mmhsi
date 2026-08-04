import { cn } from "@/lib/utils/cn";

export type TabItem<T extends string = string> = {
  id: T;
  label: string;
};

type TabNavProps<T extends string> = {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  className?: string;
  /** Show border-top separator (default: true) */
  bordered?: boolean;
};

/**
 * Reusable tab navigation component.
 *
 * @example
 * const TABS = [
 *   { id: "overview", label: "Overview" },
 *   { id: "details", label: "Details" },
 * ] as const;
 *
 * type Tab = typeof TABS[number]["id"];
 *
 * const [tab, setTab] = useState<Tab>("overview");
 *
 * <TabNav tabs={TABS} activeTab={tab} onTabChange={setTab} />
 */
export function TabNav<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className,
  bordered = true,
}: TabNavProps<T>) {
  return (
    <nav
      className={cn(
        "flex flex-wrap gap-1 print:hidden",
        bordered && "mt-4 border-t border-border pt-3",
        className
      )}
      aria-label="Tabs"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "relative px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === tab.id
              ? "text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
