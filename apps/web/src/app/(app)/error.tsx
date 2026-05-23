"use client";

export default function ErrorState({ reset }: { reset: () => void }) {
  return (
    <div className="glass-panel flex h-[60vh] flex-col items-center justify-center gap-4">
      <div className="text-lg font-semibold text-[color:var(--app-fg)]">We hit a snag.</div>
      <div className="text-sm text-[color:var(--app-muted)]">
        The dashboard failed to load. Try again or check the API connection.
      </div>
      <button
        className="rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-white"
        onClick={() => reset()}
      >
        Retry
      </button>
    </div>
  );
}
