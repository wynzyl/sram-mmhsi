import { cn } from "@/lib/utils/cn";

interface DocumentProgressRingProps {
  completed: number;
  total: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    dimension: 48,
    strokeWidth: 4,
    fontSize: "text-xs",
    radius: 20,
  },
  md: {
    dimension: 64,
    strokeWidth: 5,
    fontSize: "text-sm",
    radius: 26,
  },
  lg: {
    dimension: 96,
    strokeWidth: 6,
    fontSize: "text-lg",
    radius: 42,
  },
};

/**
 * Circular progress indicator for document completion tracking.
 * Displays "X of Y complete" with animated ring and color-coded states.
 * Part of the Editorial Design System for SRAMS.
 */
export function DocumentProgressRing({
  completed,
  total,
  size = "md",
  showLabel = true,
  className,
}: DocumentProgressRingProps) {
  const config = sizeConfig[size];
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Color logic: red if < 50%, amber if 50-99%, emerald if 100%
  const getColor = () => {
    if (percentage === 100) return "hsl(142.1 76.2% 36.3%)"; // emerald-600
    if (percentage >= 50) return "hsl(45.4 93.4% 47.5%)"; // amber-500
    return "hsl(var(--primary))";
  };

  const color = getColor();

  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: config.dimension, height: config.dimension }}>
        <svg
          width={config.dimension}
          height={config.dimension}
          viewBox={`0 0 ${config.dimension} ${config.dimension}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={config.dimension / 2}
            cy={config.dimension / 2}
            r={config.radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={config.strokeWidth}
          />

          {/* Progress circle */}
          <circle
            cx={config.dimension / 2}
            cy={config.dimension / 2}
            r={config.radius}
            fill="none"
            stroke={color}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: "stroke-dashoffset 0.6s ease-out, stroke 0.3s ease-out",
            }}
          />
        </svg>

        {/* Center text */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          aria-label={`${completed} of ${total} documents complete`}
        >
          <span className={cn("font-display font-bold text-foreground", config.fontSize)}>
            {completed}
          </span>
          <span className="text-[0.6em] text-muted-foreground font-mono">of {total}</span>
        </div>
      </div>

      {showLabel && (
        <span className="text-xs text-muted-foreground font-medium">
          {percentage === 100 ? "Complete" : "Documents"}
        </span>
      )}
    </div>
  );
}
