"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Card, SectionTitle, StatCard } from "@/components/ui";
import { fetchApi } from "@/lib/api";

type JobState = "queued" | "running" | "completed" | "failed";

type JobMonitoringRow = {
  readonly id: string;
  readonly status: string;
  readonly retryCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly leasedAt: string | null;
  readonly leaseExpiresAt: string | null;
  readonly completedAt: string | null;
  readonly failedAt: string | null;
  readonly errorMessage: string | null;
  readonly repositoryName: string;
  readonly pullRequestNumber: number;
  readonly pullRequestTitle: string;
  readonly executionMs: number | null;
  readonly riskScore: number | null;
  readonly confidenceScore: number | null;
  readonly overallSeverity: string | null;
};

type JobMonitoringResponse = {
  readonly summary: {
    readonly queued: number;
    readonly running: number;
    readonly completed: number;
    readonly failed: number;
  };
  readonly jobs: JobMonitoringRow[];
};

const refreshIntervalMs = 10_000;

function getJobState(status: string): JobState {
  if (status === "completed") {
    return "completed";
  }

  if (status === "failed" || status === "cancelled") {
    return "failed";
  }

  if (status === "queued") {
    return "queued";
  }

  return "running";
}

function stateTone(state: JobState): "good" | "warn" | "bad" | "neutral" {
  if (state === "completed") {
    return "good";
  }

  if (state === "failed") {
    return "bad";
  }

  if (state === "running") {
    return "warn";
  }

  return "neutral";
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null || !Number.isFinite(durationMs)) {
    return "-";
  }

  const totalSeconds = Math.max(Math.round(durationMs / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function resolveDuration(job: JobMonitoringRow): number | null {
  if (job.status === "completed" && job.executionMs !== null) {
    return job.executionMs;
  }

  const startedAt = job.startedAt ?? job.leasedAt ?? job.createdAt;
  const endedAt = job.completedAt ?? job.failedAt;
  const startTime = new Date(startedAt).getTime();
  const endTime = new Date(endedAt ?? new Date().toISOString()).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return null;
  }

  return Math.max(endTime - startTime, 0);
}

function severityTone(severity: string | null): "good" | "warn" | "bad" | "neutral" {
  if (severity === "critical") {
    return "bad";
  }

  if (severity === "warning") {
    return "warn";
  }

  if (severity === "info") {
    return "good";
  }

  return "neutral";
}

export default function JobMonitorPage() {
  const [data, setData] = useState<JobMonitoringResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const snapshot = await fetchApi<JobMonitoringResponse>("/dashboard/jobs?limit=25");
      setData(snapshot);
      setError(null);
      setLastUpdatedAt(new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load job monitoring data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();

    const timer = window.setInterval(() => {
      void loadJobs();
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadJobs]);

  const jobs = data?.jobs ?? [];

  const queueLabel = useMemo(
    () => (isRefreshing ? "Refreshing" : `Polling every ${refreshIntervalMs / 1000}s`),
    [isRefreshing],
  );

  return (
    <div className="flex flex-col gap-6" aria-busy={isLoading || isRefreshing} aria-live="polite">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Queued"
          value={String(data?.summary.queued ?? 0)}
          delta="Waiting for a worker"
          tone="warn"
        />
        <StatCard
          label="Running"
          value={String(data?.summary.running ?? 0)}
          delta="Leased or processing"
          tone="good"
        />
        <StatCard
          label="Completed"
          value={String(data?.summary.completed ?? 0)}
          delta="Published review output"
          tone="good"
        />
        <StatCard
          label="Failed"
          value={String(data?.summary.failed ?? 0)}
          delta="Retry or inspect errors"
          tone="bad"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle title="Background jobs" subtitle="Review workers and queue state" />
              <div className="flex flex-wrap items-center gap-2">
                <Badge label={queueLabel} tone={isRefreshing ? "warn" : "neutral"} />
                <button
                  type="button"
                  onClick={() => {
                    void loadJobs();
                  }}
                  className="rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-fg)] transition hover:bg-[color:var(--app-panel-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
                >
                  Refresh now
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-[color:var(--app-danger)]/30 bg-[color:var(--app-danger)]/10 px-4 py-3 text-sm text-[color:var(--app-fg)]">
                {error}
              </div>
            ) : null}

            {isLoading ? (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-4">
                    <div className="h-4 w-1/2 animate-pulse rounded bg-[color:var(--app-panel-strong)]" />
                    <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-[color:var(--app-panel-strong)]" />
                    <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-[color:var(--app-panel-strong)]" />
                  </div>
                ))}
              </div>
            ) : null}

            {!isLoading && jobs.length === 0 ? (
              <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-10 text-center text-sm text-[color:var(--app-muted)]">
                No jobs found for this workspace.
              </div>
            ) : null}

            {!isLoading && jobs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
                      <th scope="col" className="px-4 py-2">Job</th>
                      <th scope="col" className="px-4 py-2">State</th>
                      <th scope="col" className="px-4 py-2">Duration</th>
                      <th scope="col" className="px-4 py-2">Timestamps</th>
                      <th scope="col" className="px-4 py-2">Retries</th>
                      <th scope="col" className="px-4 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => {
                      const state = getJobState(job.status);
                      const durationMs = resolveDuration(job);
                      return (
                        <tr key={job.id} className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-panel-strong)]/40 transition hover:bg-[color:var(--app-panel-strong)]/70">
                          <td className="rounded-l-2xl px-4 py-4 align-top">
                            <div className="flex flex-col gap-1">
                              <Link href={`/reviews/${job.id}`} className="text-sm font-semibold text-[color:var(--app-fg)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]">
                                {job.repositoryName} #{job.pullRequestNumber}
                              </Link>
                              <div className="text-xs text-[color:var(--app-muted)]">{job.pullRequestTitle}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-1">
                              <Badge label={state} tone={stateTone(state)} />
                              <div className="text-xs text-[color:var(--app-muted)]">{job.status}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-sm text-[color:var(--app-fg)]">
                            <div>{formatDuration(durationMs)}</div>
                            <div className="text-xs text-[color:var(--app-muted)]">
                              {state === "queued" ? "Queue wait" : "Execution"}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-xs text-[color:var(--app-muted)]">
                            <div>Created {formatTimestamp(job.createdAt)}</div>
                            <div>Updated {formatTimestamp(job.updatedAt)}</div>
                            <div>Started {formatTimestamp(job.startedAt)}</div>
                            {job.leaseExpiresAt ? <div>Lease expires {formatTimestamp(job.leaseExpiresAt)}</div> : null}
                            {job.completedAt ? <div>Completed {formatTimestamp(job.completedAt)}</div> : null}
                            {job.failedAt ? <div>Failed {formatTimestamp(job.failedAt)}</div> : null}
                          </td>
                          <td className="px-4 py-4 align-top text-sm text-[color:var(--app-fg)]">{job.retryCount}</td>
                          <td className="rounded-r-2xl px-4 py-4 align-top">
                            <div className="flex flex-col gap-2">
                              {job.overallSeverity ? (
                                <Badge label={job.overallSeverity} tone={severityTone(job.overallSeverity)} />
                              ) : (
                                <Badge label="pending metrics" tone="neutral" />
                              )}
                              <div className="text-xs text-[color:var(--app-muted)]">
                                {job.riskScore !== null ? `Risk ${job.riskScore}` : "No risk score yet"}
                              </div>
                              <div className="text-xs text-[color:var(--app-muted)]">
                                {job.confidenceScore !== null ? `Confidence ${job.confidenceScore}` : "No confidence score yet"}
                              </div>
                              {job.errorMessage ? (
                                <div className="rounded-xl bg-[color:var(--app-danger)]/10 px-3 py-2 text-xs text-[color:var(--app-fg)]">
                                  {job.errorMessage}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Execution states" subtitle="Worker lifecycle" />
          <div className="mt-4 space-y-3">
            {[
              { label: "Queued", value: data?.summary.queued ?? 0, tone: "warn" as const, note: "Awaiting lease" },
              { label: "Running", value: data?.summary.running ?? 0, tone: "good" as const, note: "Chunking or analyzing" },
              { label: "Completed", value: data?.summary.completed ?? 0, tone: "good" as const, note: "Review published" },
              { label: "Failed", value: data?.summary.failed ?? 0, tone: "bad" as const, note: "Needs retry or inspection" },
            ].map((item) => (
              <div key={item.label} className="glass-panel flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-[color:var(--app-fg)]">{item.label}</div>
                  <div className="text-xs text-[color:var(--app-muted)]">{item.note}</div>
                </div>
                <Badge label={String(item.value)} tone={item.tone} />
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-[color:var(--app-border)] px-4 py-4 text-sm text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-panel-strong)]/20">
            Live data is refreshed with polling every 10 seconds. Use the refresh button for an immediate update.
          </div>

          <div className="mt-4 rounded-2xl bg-[color:var(--app-panel-strong)] px-4 py-4 text-sm text-[color:var(--app-fg)] transition hover:translate-y-[-1px]">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
              Last refresh
            </div>
            <div className="mt-2 font-semibold">
              {lastUpdatedAt ? formatTimestamp(lastUpdatedAt) : "Waiting for first snapshot"}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}