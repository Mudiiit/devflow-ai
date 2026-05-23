import Link from "next/link";
import { clientEnv } from "@devflow/config";

export default function LoginPage() {
  const apiBase = clientEnv.NEXT_PUBLIC_API_URL ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="glass-panel flex w-full max-w-xl flex-col gap-6 px-8 py-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">DevFlow AI</div>
          <h1 className="brand-title text-3xl font-semibold text-[color:var(--app-fg)]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-[color:var(--app-muted)]">
            Sign in with GitHub to manage reviews, risk signals, and AI governance.
          </p>
        </div>
        <Link
          href={`${apiBase}/auth/github/login`}
          className="rounded-full bg-[color:var(--app-accent)] px-5 py-3 text-center text-sm font-semibold text-white"
        >
          Continue with GitHub
        </Link>
        <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3 text-xs text-[color:var(--app-muted)]">
          By continuing you agree to the DevFlow AI terms and the GitHub OAuth authorization flow.
        </div>
      </div>
    </div>
  );
}
