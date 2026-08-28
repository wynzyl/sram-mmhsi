import Image from "next/image";
import Link from "next/link";
import { FOOTER_HQ, FOOTER_LINKS } from "@/lib/constants/footer-links";
import { cn } from "@/lib/utils/cn";

// ─── Icons ─────────────────────────────────────────────────────────────────

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

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
                <p className="font-bold text-foreground text-sm tracking-wide">
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
                <CheckCircleIcon className="text-success" />v{version}
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
                <MapPinIcon className="shrink-0 mt-0.5" />
                <span>{FOOTER_HQ.address}</span>
              </p>
              <a
                href={`mailto:${FOOTER_HQ.email}`}
                className={cn(
                  "flex items-center gap-1.5 text-sm text-muted-foreground",
                  "hover:text-primary transition-colors"
                )}
              >
                <MailIcon className="shrink-0" />
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
