import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  accent?: boolean;
  tone?: "default" | "danger";
}

export function StatCard({ label, value, caption, accent, tone = "default" }: StatCardProps) {
  const valueColor =
    tone === "danger"
      ? "#f87171"
      : accent
        ? "var(--color-accent)"
        : "var(--color-foreground)";
  return (
    <article className="rounded-lg border border-[color:var(--color-border)] bg-white/[0.02] p-5">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-subtle)]">
        {label}
      </div>
      <div
        className="font-mono text-3xl font-semibold tabular-nums tracking-tight"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      {caption ? (
        <div className="mt-2 font-mono text-xs text-[color:var(--color-muted)]">
          {caption}
        </div>
      ) : null}
    </article>
  );
}
