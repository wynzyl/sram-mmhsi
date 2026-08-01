import Image from "next/image";
import Link from "next/link";
import { FOOTER_LINKS, FOOTER_HQ } from "@/lib/constants/footer-links";
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

// ─── Footer Link Section ───────────────────────────────────────────────────

interface FooterLinkSectionProps {
  title: string;
  links: readonly { label: string; href: string }[];
}

function FooterLinkSection({ title, links }: FooterLinkSectionProps) {
  return (
    <div>
      <h4
        className={cn(
          "text-[0.65rem] font-semibold uppercase tracking-wider",
          "text-muted-foreground mb-3"
        )}
      >
        {title}
      </h4>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              className={cn(
                "text-sm text-muted-foreground",
                "hover:text-foreground hover:underline",
                "transition-colors"
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── AppFooter ─────────────────────────────────────────────────────────────

interface AppFooterProps {
  schoolYear?: string;
}

export function AppFooter({ schoolYear }: AppFooterProps) {
  const currentYear = new Date().getFullYear();
  const version = process.env.npm_package_version ?? "1.0.0";

  return (
    <footer className={cn("mt-auto bg-sidebar border-t border-border")}>
      {/* Main footer content */}
      <div className="px-6 py-8">
        <div
          className={cn(
            "grid gap-8",
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          )}
        >
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
                  MERRYLAND MONTESSORI AND HIGH SCHOOL inc.
                </p>
                <p className="text-[0.65rem] text-muted-foreground">
                  School Registration & Accounts Monitoring
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4 max-w-[240px]">
              Empowering K-12 education with streamlined enrollment, assessment tracking, and
              payment management.
            </p>
            {/* System status badge */}
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1",
                "bg-success/10 border border-success/20 rounded-full"
              )}
            >
              <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              <span className="text-[0.65rem] font-medium text-success">
                All Systems Operational
              </span>
            </div>
          </div>

          {/* Column 2: Academic Portals */}
          <FooterLinkSection title="Academic Portals" links={FOOTER_LINKS.academicPortals} />

          {/* Column 3: Compliance & Support */}
          <FooterLinkSection title="Compliance & Support" links={FOOTER_LINKS.compliance} />

          {/* Column 4: HQ Info */}
          <div>
            <h4
              className={cn(
                "text-[0.65rem] font-semibold uppercase tracking-wider",
                "text-muted-foreground mb-3"
              )}
            >
              Headquarters
            </h4>
            <address className="not-italic space-y-2">
              <p className="text-sm font-medium text-foreground">{FOOTER_HQ.name}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPinIcon className="shrink-0" />
                {FOOTER_HQ.address}
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
            {/* Version badge */}
            <div className="mt-4 flex items-center gap-2">
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
        </div>
      </div>

      {/* Copyright bar */}
      <div
        className={cn(
          "px-6 py-4 border-t border-border",
          "flex flex-col sm:flex-row items-center justify-between gap-2"
        )}
      >
        <p className="text-xs text-muted-foreground">
          &copy; {currentYear} Merryland Academy. All rights reserved.
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
