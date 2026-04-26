"use client";

import { useDashboard } from "@/lib/use-dashboard";

export default function DashboardPage() {
  const { data, error, status, lastUpdated } = useDashboard(1000);

  return (
    <div className="min-h-screen px-6 py-10 sm:py-14">
      <main className="mx-auto w-full max-w-6xl space-y-10">
        <DashboardHeader status={status} lastUpdated={lastUpdated} />
        {error ? (
          <ErrorPanel error={error} />
        ) : !data ? (
          <LoadingPanel />
        ) : (
          <Placeholder data={data} />
        )}
      </main>
    </div>
  );
}

function DashboardHeader({
  status,
  lastUpdated,
}: {
  status: "idle" | "loading" | "live" | "error";
  lastUpdated: number | null;
}) {
  return (
    <header className="flex items-center justify-between border-b border-[color:var(--color-border)] pb-4">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--color-accent)]">
        <span aria-hidden>⚡</span>
        <span>acrux</span>
        <span className="text-[color:var(--color-subtle)]">·</span>
        <span className="text-[color:var(--color-subtle)]">dashboard</span>
      </div>
      <StatusPill status={status} lastUpdated={lastUpdated} />
    </header>
  );
}

function StatusPill({
  status,
  lastUpdated,
}: {
  status: "idle" | "loading" | "live" | "error";
  lastUpdated: number | null;
}) {
  const label =
    status === "live"
      ? "live"
      : status === "loading"
        ? "loading"
        : status === "error"
          ? "offline"
          : "—";
  const color =
    status === "live"
      ? "var(--color-accent)"
      : status === "error"
        ? "#f87171"
        : "var(--color-subtle)";
  const ts =
    lastUpdated && status === "live"
      ? new Date(lastUpdated).toLocaleTimeString([], {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "—";

  return (
    <div className="flex items-center gap-3 font-mono text-xs text-[color:var(--color-subtle)]">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span style={{ color }}>{label}</span>
      </span>
      <span>updated {ts}</span>
    </div>
  );
}

function LoadingPanel() {
  return (
    <section className="rounded-lg border border-[color:var(--color-border)] p-8 text-center font-mono text-sm text-[color:var(--color-subtle)]">
      polling /api/dashboard…
    </section>
  );
}

function ErrorPanel({
  error,
}: {
  error: { error: string; hint?: string };
}) {
  return (
    <section className="rounded-lg border border-[color:var(--color-border)] bg-red-500/[0.04] p-6 font-mono text-sm">
      <div className="mb-2 font-semibold text-red-300">
        dashboard offline · {error.error}
      </div>
      {error.hint ? (
        <div className="text-[color:var(--color-muted)]">{error.hint}</div>
      ) : null}
    </section>
  );
}

function Placeholder({
  data,
}: {
  data: { generatedAt: string };
}) {
  return (
    <section className="rounded-lg border border-[color:var(--color-border)] p-6 font-mono text-xs text-[color:var(--color-subtle)]">
      <div className="mb-2 uppercase tracking-wider">scaffolded</div>
      <div className="text-[color:var(--color-muted)]">
        Live snapshot received at {data.generatedAt}. Widgets land in the next
        commit.
      </div>
    </section>
  );
}
