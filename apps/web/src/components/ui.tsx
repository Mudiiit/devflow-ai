import React from "react";

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="glass-panel px-4 py-4 sm:px-5 sm:py-5">{children}</div>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
          {subtitle ?? ""}
        </div>
        <h2 className="brand-title text-xl font-semibold text-[color:var(--app-fg)]">
          {title}
        </h2>
      </div>
    </div>
  );
}

export function StatCard({ label, value, delta, tone }: { label: string; value: string; delta?: string; tone?: "good" | "warn" | "bad" }) {
  const toneClass = tone === "bad"
    ? "text-[color:var(--app-danger)]"
    : tone === "warn"
      ? "text-[color:var(--app-accent-2)]"
      : "text-[color:var(--app-success)]";

  return (
    <div className="glass-panel flex flex-col gap-3 px-5 py-4">
      <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
        {label}
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="text-2xl font-semibold text-[color:var(--app-fg)]">
          {value}
        </div>
        {delta ? <div className={`text-xs font-semibold ${toneClass}`}>{delta}</div> : null}
      </div>
    </div>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const toneClass = tone === "bad"
    ? "bg-[color:var(--app-danger)] text-white"
    : tone === "warn"
      ? "bg-[color:var(--app-accent-2)] text-[color:var(--app-fg)]"
      : tone === "good"
        ? "bg-[color:var(--app-success)] text-white"
        : "bg-[color:var(--app-panel-strong)] text-[color:var(--app-fg)]";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {label}
    </span>
  );
}

export function Divider() {
  return <div className="h-px w-full bg-[color:var(--app-border)]" />;
}

export function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 40 - ((value - min) / range) * 40;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 40" className="h-10 w-full">
      <path d={path} fill="none" stroke="var(--app-accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-[color:var(--app-panel-strong)]/70 ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBlock
          // Keep varied widths so the placeholder reads as content.
          key={index}
          className={`h-3 ${index === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}
