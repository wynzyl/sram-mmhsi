import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to the SRAMS school operations system.",
};

export default function LoginPage() {
  return (
    <main className="login-root">
      <div className="login-brand">
        <div className="login-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect width="40" height="40" rx="8" fill="var(--color-primary)" />
            <path
              d="M10 28 L20 12 L30 28"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M14 22 H26" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h1 className="login-title">SRAMS</h1>
          <p className="login-subtitle">
            School Registration &amp; Accounts Monitoring System
          </p>
        </div>
      </div>

      <div className="login-card">
        <h2 className="login-card-title">Sign in to your account</h2>
        <p className="login-card-desc">Enter your credentials to access the system.</p>

        <LoginForm />

        <p className="login-footer">
          Having trouble? Contact your system administrator.
        </p>
      </div>

      <style>{`
        .login-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2rem;
          padding: 2rem;
          background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 40%, #1f2937 100%);
        }
        .login-brand { display: flex; align-items: center; gap: 1rem; }
        .login-logo { flex-shrink: 0; }
        .login-title { font-size: 1.75rem; font-weight: 800; color: #fff; letter-spacing: 0.05em; }
        .login-subtitle { font-size: 0.8rem; color: rgba(255,255,255,0.7); margin-top: 2px; max-width: 260px; }
        .login-card {
          background: #fff;
          border-radius: var(--radius-xl);
          padding: 2rem;
          width: 100%;
          max-width: 400px;
          box-shadow: var(--shadow-lg);
        }
        .login-card-title { font-size: 1.125rem; font-weight: 700; color: var(--color-text); margin-bottom: 0.25rem; }
        .login-card-desc { font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 1.5rem; }
        .login-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-field { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: var(--color-text-2); }
        .form-input {
          height: 38px;
          padding: 0 0.75rem;
          border: 1px solid var(--color-border-2);
          border-radius: var(--radius);
          font-size: 0.875rem;
          color: var(--color-text);
          background: var(--color-surface);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .form-input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(155, 28, 28, 0.15);
        }
        .form-input--error { border-color: var(--color-error); }
        .form-input:disabled { opacity: 0.6; cursor: not-allowed; }
        .form-error { font-size: 0.75rem; color: var(--color-error); margin-top: 2px; }
        .login-alert {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: var(--radius);
          color: var(--color-error);
          font-size: 0.8rem;
          font-weight: 500;
        }
        .btn-primary {
          margin-top: 0.5rem;
          height: 40px;
          background: var(--color-primary);
          color: #fff;
          border: none;
          border-radius: var(--radius);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-primary:hover:not(:disabled) { background: #7f1d1d; }
        .btn-primary:active:not(:disabled) { transform: scale(0.99); }
        .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
        .btn-loading { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-footer { margin-top: 1.25rem; font-size: 0.75rem; color: var(--color-text-muted); text-align: center; }
      `}</style>
    </main>
  );
}
