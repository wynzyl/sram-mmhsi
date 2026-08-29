import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Mail, MapPin } from "lucide-react";
import { FOOTER_HQ, FOOTER_LINKS } from "@/lib/constants/footer-links";
import { cn } from "@/lib/utils/cn";

// ─── PortalFooter ─────────────────────────────────────────────────────────────

interface PortalFooterProps {
  schoolYear?: string;
}

/**
 * Simplified footer for the Student Portal.
 * Mobile-first design with only essential information:
 * - School branding
 * - Contact information
 * - Copyright
 */
export function PortalFooter({ schoolYear }: PortalFooterProps) {
  const currentYear = new Date().getFullYear();
  const version = process.env.npm_package_version ?? "1.0.0";

  return (
    <footer className={cn("mt-auto bg-sidebar border-t border-border")}>
      {/* Main footer content */}
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2">
          {/* Column 1: Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <Image
                src="/MLAND LOGO.png"
                alt="Merryland logo"
                width={28}
                height={28}
              />
              <div>
                <p className="font-[family-name:var(--font-crimson)] font-bold text-foreground text-sm tracking-wide">
                  MERRYLAND MONTESSORI AND HIGH SCHOOL, Inc.
                </p>
                <p className="text-[0.65rem] text-muted-foreground">
                  Student Portal
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4 max-w-[280px]">
              Access your assessments, payments, and grades through your student portal.
            </p>
            {/* Version badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5",
                  "bg-muted border border-border rounded text-[0.65rem]",
                  "font-mono text-muted-foreground"
                )}
              >
                <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />v{version}
              </span>
              {schoolYear && (
                <span
                  className={cn(
                    "inline-flex px-2 py-0.5",
                    "bg-primary/10 border border-primary/20 rounded text-[0.65rem]",
                    "font-medium text-primary"
                  )}
                >
                  SY {schoolYear}
                </span>
              )}
            </div>
          </div>

          {/* Column 2: Contact */}
          <div>
            <h4
              className={cn(
                "text-[0.65rem] font-semibold uppercase tracking-wider",
                "text-muted-foreground mb-3"
              )}
            >
              Contact Us
            </h4>
            <address className="not-italic space-y-2">
              <p className="text-sm font-medium text-foreground">{FOOTER_HQ.name}</p>
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{FOOTER_HQ.address}</span>
              </p>
              <a
                href={`mailto:${FOOTER_HQ.email}`}
                className={cn(
                  "flex items-center gap-1.5 text-sm text-muted-foreground",
                  "hover:text-primary transition-colors"
                )}
              >
                <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                {FOOTER_HQ.email}
              </a>
            </address>
          </div>
        </div>
      </div>

      {/* Copyright bar */}
      <div
        className={cn(
          "px-4 sm:px-6 py-3 sm:py-4 border-t border-border",
          "flex flex-col sm:flex-row items-center justify-between gap-2"
        )}
      >
        <p className="text-xs text-muted-foreground text-center sm:text-left">
          &copy; {currentYear} Merryland Montessori & High School, Inc.
        </p>
        <nav className="flex items-center gap-4">
          {FOOTER_LINKS.legal.map((link) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              className={cn(
                "text-xs text-muted-foreground",
                "hover:text-foreground hover:underline",
                "transition-colors"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
