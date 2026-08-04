"use client";

interface StepHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

/**
 * Shared header for wizard step sections.
 * Displays step eyebrow, title, description with a decorative icon.
 */
export function StepHeader({ eyebrow, title, description, icon }: StepHeaderProps) {
  return (
    <header className="mb-6 flex items-start gap-4 border-l-4 border-primary pl-5">
      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold leading-tight text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </header>
  );
}
