import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to the SRAMS school operations system.",
};

export default function LoginPage() {
  return (
    <main className="editorial-login">
      {/* Decorative grain + paper texture layer */}
      <div className="editorial-grain" aria-hidden="true" />

      {/* Top masthead — runs across the full page like a journal header */}
      <header className="editorial-masthead">
        <div className="editorial-masthead-left">
          <span className="editorial-masthead-mark">M.M.H.S.I.</span>
          <span className="editorial-rule-h" aria-hidden="true" />
          <span className="editorial-masthead-meta">
            Est. MCMXCVIII · Pasig City
          </span>
        </div>
        <div className="editorial-masthead-right">
          <span className="editorial-masthead-meta">
            Folio &nbsp;<span className="editorial-folio">001 / α</span>
          </span>
        </div>
      </header>

      <div className="editorial-grid">
        {/* ── Left: Archival plate ─────────────────────────── */}
        <section className="editorial-plate" aria-label="Institution">
          <div className="editorial-plate-frame" aria-hidden="true">
            <Image
              src="/Hero.png"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="editorial-plate-img"
            />
            <span className="editorial-plate-tag">Plate I.</span>
          </div>

          <figcaption className="editorial-caption">
            <span className="editorial-caption-num">i.</span>
            <p>
              <span className="editorial-caption-title">
                Merryland Montessori &amp; High School, Inc.
              </span>{" "}
              — a record of registration, accounts, and the quiet
              arithmetic of a school year. Photograph held in the
              registrar&rsquo;s archive.
            </p>
          </figcaption>

          {/* Vertical sidebar marks running down the plate */}
          <div className="editorial-plate-side" aria-hidden="true">
            <span>S</span>
            <span>R</span>
            <span>A</span>
            <span>M</span>
            <span>S</span>
          </div>
        </section>

        {/* ── Right: Sign-in folio ─────────────────────────── */}
        <section className="editorial-folio-pane">
          <article className="editorial-article animate-editorial-rise">
            {/* Section eyebrow */}
            <div className="editorial-eyebrow">
              <span className="editorial-eyebrow-num">§ I.</span>
              <span className="editorial-eyebrow-text">Identification</span>
              <span className="editorial-rule-h editorial-rule-grow" aria-hidden="true" />
            </div>

            {/* Display headline with drop cap */}
            <h1 className="editorial-headline">
              <span className="editorial-dropcap">W</span>
              elcome back to the operations desk of{" "}
              <span className="editorial-italic">
                Merryland Montessori &amp; High School
              </span>
              <span className="editorial-period">.</span>
            </h1>

            <p className="editorial-deck">
              Please present your credentials. The system records every
              entry, every receipt, and every grade encoded — therein lies
              its discipline, and yours.
            </p>

            {/* Form block */}
            <div className="editorial-form-block">
              <div className="editorial-form-rule" aria-hidden="true">
                <span className="editorial-form-rule-mark">§ II.</span>
                <span className="editorial-form-rule-label">
                  Credentials
                </span>
              </div>

              <LoginForm />
            </div>

            {/* Foot matter */}
            <footer className="editorial-footmatter">
              <div className="editorial-footmatter-row">
                <span className="editorial-footmatter-key">Volume</span>
                <span className="editorial-footmatter-val">XII</span>
              </div>
              <div className="editorial-footmatter-row">
                <span className="editorial-footmatter-key">Build</span>
                <span className="editorial-footmatter-val">
                  26.05.13 · v2.1
                </span>
              </div>
              <div className="editorial-footmatter-row">
                <span className="editorial-footmatter-key">Custodian</span>
                <span className="editorial-footmatter-val">
                  Office of the Registrar
                </span>
              </div>

              <p className="editorial-colophon">
                Difficulty signing in? Address your administrator at the
                Registrar&rsquo;s Office, or write to{" "}
                <span className="editorial-mono">
                  it@mmhsi.edu.ph
                </span>
                . — <em>Fin.</em>
              </p>
            </footer>
          </article>
        </section>
      </div>

      {/* Bottom rule — page foot */}
      <footer className="editorial-pagefoot">
        <span>SRAMS</span>
        <span className="editorial-rule-h editorial-rule-grow" aria-hidden="true" />
        <span>—</span>
        <span className="editorial-rule-h editorial-rule-grow" aria-hidden="true" />
        <span className="editorial-mono">001</span>
      </footer>
    </main>
  );
}
