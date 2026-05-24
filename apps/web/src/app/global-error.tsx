"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { reset: () => void }) {
  const supportReference = `df-${Date.now().toString(36)}`;

  return (
    <html>
      <body className="bg-[color:var(--app-bg)] text-[color:var(--app-fg)]">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="glass-panel w-full max-w-xl p-8">
            <h1 className="text-xl font-semibold">Unexpected application failure</h1>
            <p className="mt-3 text-sm text-[color:var(--app-muted)]">
              DevFlow AI hit an unrecoverable error. Retry the view or contact support with your request ID.
            </p>
            <div className="mt-3 rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-xs text-[color:var(--app-muted)]">
              Support reference: <span className="font-semibold text-[color:var(--app-fg)]">{supportReference}</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-white"
                onClick={() => reset()}
              >
                Retry session
              </button>
              <Link
                href="/"
                className="rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-fg)]"
              >
                Back to landing
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
