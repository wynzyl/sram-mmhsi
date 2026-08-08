/**
 * Footer link configuration for the application layout.
 * Centralized definition for consistent footer navigation across portals.
 */

export const FOOTER_LINKS = {
  academicPortals: [
    { label: "Active Student Directory", href: "/staff/students" },
    { label: "Curriculums & Strands", href: "/staff/academics/curriculums" },
    { label: "Assessments & Invoices", href: "/staff/finance/assessments" },
    { label: "Registrar Approvals", href: "/staff/registrations" },
  ],
  compliance: [
    { label: "System Uptime & Logs", href: "#" },
    { label: "Data Privacy & FERPA", href: "#" },
    { label: "IT Helpdesk & Tickets", href: "#" },
    { label: "Academic Calendar", href: "#" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms of Service", href: "#" },
    { label: "Security Controls", href: "#" },
  ],
} as const;

export const FOOTER_HQ = {
  name: "Merryland Montessori and High School",
  address: "Urdaneta City, Pangasinan, PH",
  email: "support@merryland.edu.ph",
} as const;

export type FooterLinkCategory = keyof typeof FOOTER_LINKS;
export type FooterLink = { label: string; href: string };
