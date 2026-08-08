import { PageHeader } from "@/components/layout/PageHeader";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title="Privacy Policy" />

      <section className="mt-8 space-y-6">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Information we process</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            SRAMS processes account identity, role-based access information, and
            operational audit context for business continuity, security, and
            compliance. Audit records may include a hashed request IP digest in the
            legacy audit-log channel to support accountability without retaining
            raw IP addresses.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Legal basis</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            We process this information as part of the system’s legitimate
            operational and security obligations for access-control monitoring,
            workflow accountability, and financial-operation auditability.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Retention</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Audit records are retained only for the period required for finance,
            security, and compliance operations. The system’s current retention
            target is 365 days, after which older records should be purged by a
            scheduled cleanup or database TTL workflow.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Consent & notices</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Users are informed through the school’s operational privacy notices that
            account access, workflow actions, and security event metadata may be
            logged for accountability. No direct consent banner is required for a
            staff-only internal administrative system unless a wider public or
            external data-processing workflow is introduced.
          </p>
        </div>
      </section>
    </main>
  );
}
