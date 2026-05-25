import { GithubSignInButton } from "./GithubSignInButton";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="glass-panel flex w-full max-w-3xl flex-col gap-8 px-6 py-6 sm:px-8 sm:py-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
        <div className="order-2 lg:order-1">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">DevFlow AI</div>
          <h1 className="brand-title text-3xl font-semibold text-[color:var(--app-fg)]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-[color:var(--app-muted)]">
            Sign in with GitHub to manage reviews, risk signals, and AI governance from one control center.
          </p>

          <div className="mt-5 space-y-3">
            {[
              "Connect repositories securely",
              "Enable AI review policies for teams",
              "Get risk alerts in one control center",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-sm text-[color:var(--app-fg)]">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--app-accent)]/20 text-xs font-bold text-[color:var(--app-accent)]">
                  ✓
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-2">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-panel-strong)]/40 px-4 py-3 text-xs text-[color:var(--app-muted)]">
            Onboarding is usually under 2 minutes and includes repo sync, team access, and notification setup.
          </div>
          <GithubSignInButton />
          <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3 text-xs text-[color:var(--app-muted)]">
            By continuing you agree to the DevFlow AI terms and the GitHub OAuth authorization flow.
          </div>
          <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3 text-xs text-[color:var(--app-muted)]">
            Trusted by security, platform, and developer experience teams for fast demo-ready review workflows.
          </div>
        </div>
      </div>
    </div>
  );
}
