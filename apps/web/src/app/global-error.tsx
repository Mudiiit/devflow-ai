"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body className="bg-[color:var(--app-bg)] text-[color:var(--app-fg)]">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="glass-panel w-full max-w-xl p-8">
            <h1 className="text-xl font-semibold">Unexpected application failure</h1>
            <p className="mt-3 text-sm text-[color:var(--app-muted)]">
              DevFlow AI hit an unrecoverable error. Retry the view or contact support with your request ID.
            </p>
            <button
              className="mt-6 rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-white"
              onClick={() => reset()}
            >
              Retry session
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
