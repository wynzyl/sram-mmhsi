import {
  Globe,
  Languages,
  BookOpen,
  Calculator,
  FlaskConical,
  Music,
  Heart,
  Wrench,
  GraduationCap,
} from "lucide-react";

type SubjectIconType =
  | "globe"
  | "language"
  | "book"
  | "calculator"
  | "flask"
  | "music"
  | "heart"
  | "tools"
  | "default";

const ICON_MAP = {
  globe: Globe,
  language: Languages,
  book: BookOpen,
  calculator: Calculator,
  flask: FlaskConical,
  music: Music,
  heart: Heart,
  tools: Wrench,
  default: GraduationCap,
} as const;

/**
 * Maps subject code prefix to icon type
 */
function getIconTypeFromCode(code: string): SubjectIconType {
  const prefix = code.replace(/\d+$/, "").toUpperCase();

  const codeIconMap: Record<string, SubjectIconType> = {
    // Language subjects
    MTB: "globe",
    ENG: "globe",
    FIL: "language",
    // Core subjects
    MTH: "calculator",
    MATH: "calculator",
    SCI: "flask",
    // Social studies
    AP: "book",
    // Arts and PE
    MAPEH: "music",
    PE: "music",
    MUSIC: "music",
    ARTS: "music",
    // Values
    ESP: "heart",
    VALUES: "heart",
    // Technical
    EPP: "tools",
    TLE: "tools",
    TECH: "tools",
  };

  return codeIconMap[prefix] || "default";
}

interface SubjectIconProps {
  code: string;
  className?: string;
}

/**
 * Colored icon for a subject based on its code
 */
export default function SubjectIcon({ code, className = "" }: SubjectIconProps) {
  const iconType = getIconTypeFromCode(code);
  const Icon = ICON_MAP[iconType];

  return (
    <div className={`subject-icon subject-icon-${iconType} ${className}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}
