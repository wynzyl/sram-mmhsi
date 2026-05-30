import type { Metadata } from "next";
import Image from "next/image";
import { ChangePasswordForm } from "@/features/auth";
import { logoutAction } from "@/features/auth/auth.actions";

export const metadata: Metadata = {
  title: "Change Password · SRAMS",
  description: "Change your password to continue using SRAMS.",
};

export default function ChangePasswordPage() {
  return (
    <main className="min-h-dvh grid place-items-center p-8 relative isolate font-sans text-foreground bg-[radial-gradient(60%_70%_at_50%_-10%,rgba(122,13,16,0.18)_0%,transparent_70%),radial-gradient(48%_60%_at_100%_100%,rgba(122,13,16,0.10)_0%,transparent_70%),radial-gradient(40%_50%_at_0%_100%,rgba(122,13,16,0.06)_0%,transparent_70%),#fbf7f5] dark:bg-[radial-gradient(60%_70%_at_50%_-10%,rgba(198,50,50,0.22)_0%,transparent_70%),radial-gradient(48%_60%_at_100%_100%,rgba(198,50,50,0.12)_0%,transparent_70%),#14100f]">
      {/* Grain texture overlay */}
      <div className="absolute inset-0 -z-10 pointer-events-none opacity-50 mix-blend-multiply dark:mix-blend-screen dark:opacity-35 bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22160%22%20height=%22160%22><filter%20id=%22n%22><feTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.9%22%20numOctaves=%222%22%20stitchTiles=%22stitch%22/><feColorMatrix%20values=%220%200%200%200%200%20%200%200%200%200%200%20%200%200%200%200%200%20%200%200%200%200.06%200%22/></filter><rect%20width=%22100%25%22%20height=%22100%25%22%20filter=%22url(%23n)%22/></svg>')]" aria-hidden="true" />

      <section className="w-full max-w-[440px] bg-white dark:bg-[#1c1716] border border-[#e4ddd5] dark:border-[#2e2724] rounded-[14px] px-9 pt-10 pb-7 shadow-[0_1px_0_rgba(0,0,0,0.02),0_2px_6px_-2px_rgba(60,20,20,0.06),0_24px_48px_-24px_rgba(122,13,16,0.22)] animate-in slide-in-from-bottom-2 fade-in duration-300 max-[480px]:px-6 max-[480px]:rounded-xl" aria-labelledby="change-password-title">
        <header className="text-center mb-7">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white dark:bg-[#1c1716] border border-[#d4cabf] dark:border-[#3d3431] mb-4 overflow-hidden" aria-hidden="true">
            <Image
              src="/Hero.png"
              alt=""
              width={56}
              height={56}
              priority
              className="w-full h-full object-cover"
            />
          </span>

          <p className="text-[0.6875rem] font-medium tracking-[0.14em] uppercase text-[#8a8079] dark:text-[#87807a] m-0 mb-2">Merryland Montessori &amp; High School, Inc.</p>
          <h1 id="change-password-title" className="font-serif text-[1.625rem] font-semibold tracking-tight text-[#1a1410] dark:text-[#f1ece6] m-0 leading-tight max-[480px]:text-[1.4rem]">
            Change <span className="text-[#7a0d10] dark:text-[#c63232] italic font-normal mx-0.5">Password</span>
          </h1>
          <p className="text-[0.8125rem] text-[#5b524a] dark:text-[#b8aea4] mt-2 leading-relaxed">
            You must change your password before continuing.
          </p>
          <span className="block w-10 h-px bg-[#d4cabf] dark:bg-[#3d3431] mx-auto mt-4" aria-hidden="true" />
        </header>

        <ChangePasswordForm />

        <footer className="flex items-center justify-center mt-7 pt-5 border-t border-[#e8e0d8] dark:border-[#2b2422]">
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-xs tracking-[0.06em] uppercase text-[#8a8079] dark:text-[#87807a] bg-transparent border-none cursor-pointer no-underline border-b border-transparent transition-colors hover:text-[#7a0d10] dark:hover:text-[#c63232] focus-visible:outline-2 focus-visible:outline-[rgba(122,13,16,0.18)] focus-visible:outline-offset-2 focus-visible:rounded-sm"
            >
              Sign out instead
            </button>
          </form>
        </footer>
      </section>
    </main>
  );
}
