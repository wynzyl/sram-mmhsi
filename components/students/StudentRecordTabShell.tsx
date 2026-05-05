"use client";

import { useId, useState, type ReactNode } from "react";

export type StudentRecordTabDef = {
  id: string;
  label: string;
  content: ReactNode;
};

type Props = {
  tabs: StudentRecordTabDef[];
};

export function StudentRecordTabShell({ tabs }: Props) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");

  if (tabs.length === 0) return null;

  return (
    <div className="student-record-tabs-root">
      <div
        role="tablist"
        aria-label="Student record sections"
        className="student-record-tablist"
      >
        {tabs.map((t) => {
          const selected = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className={selected ? "student-record-tab student-record-tab-active" : "student-record-tab"}
              onClick={() => setActiveId(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tabs.map((t) => {
        const selected = t.id === activeId;
        return (
          <section
            key={t.id}
            role="tabpanel"
            id={`${baseId}-panel-${t.id}`}
            aria-labelledby={`${baseId}-tab-${t.id}`}
            hidden={!selected}
            className="student-record-tabpanel"
            tabIndex={selected ? 0 : -1}
          >
            {selected ? t.content : null}
          </section>
        );
      })}
    </div>
  );
}
