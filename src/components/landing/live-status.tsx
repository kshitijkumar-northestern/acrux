"use client";

import { VisitorPulse } from "@/components/dashboard/visitor-pulse";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useDashboard,
  type DashboardError,
  type DashboardResponse,
  type DashboardSnapshot,
} from "@/lib/use-dashboard";

const SAT_FMT = new Intl.NumberFormat("en-US");
const POLL_MS = 2000;

interface Row {
  label: string;
  value: string;
  done: boolean;
}

export function LiveStatus({ initial }: { initial: DashboardResponse | null }) {
  const { data, error, status, lastUpdated } = useDashboard(initial, POLL_MS);
  const rows = data ? buildRows(data) : EMPTY_ROWS;

  return (
    <Card size="sm">
      <VisitorPulse />
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            System
          </span>
          <StatusPill status={status} lastUpdated={lastUpdated} />
        </div>
        <ul className="flex flex-col gap-2 font-mono text-[13px]">
          {rows.map((r) => (
            <li key={r.label} className="flex items-baseline gap-3">
              <span
                aria-hidden
                className={
                  r.done ? "text-foreground" : "text-muted-foreground"
                }
              >
                {r.done ? "▸" : "○"}
              </span>
              <span className="w-44 shrink-0 text-muted-foreground">
                {r.label}
              </span>
              <span
                className={cn(
                  "tabular-nums",
                  r.done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {r.value}
              </span>
            </li>
          ))}
        </ul>
        {status === "error" && error ? <OfflineHint error={error} /> : null}
      </CardContent>
    </Card>
  );
}

function OfflineHint({ error }: { error: DashboardError }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-3 font-mono text-[12px] text-muted-foreground">
      <span>
        <span className="text-destructive">offline</span> · {error.error}
      </span>
      {error.hint ? <span>{error.hint}</span> : null}
    </div>
  );
}

const EMPTY_ROWS: Row[] = [
  { label: "L402 paywall", value: "—", done: false },
  { label: "Surge engine", value: "—", done: false },
  { label: "Reputation staking", value: "—", done: false },
  { label: "Per-wallet pricing", value: "—", done: false },
  { label: "Slash log", value: "—", done: false },
];

function buildRows(data: DashboardSnapshot): Row[] {
  const abusive = data.topStakers.filter((s) => s.tier === "abusive").length;
  const stakers = data.topStakers.length;
  const slashes = data.recentSlashes.length;
  const pool = data.stake.pool;

  return [
    {
      label: "L402 paywall",
      value: "402 + Lightning invoice",
      done: true,
    },
    {
      label: "Surge engine",
      value: `${data.price.multiplier.toFixed(2)}× at ${data.price.rps} rps · ${data.price.load}`,
      done: true,
    },
    {
      label: "Reputation staking",
      value:
        stakers === 0
          ? "ready · no stakers yet"
          : `${SAT_FMT.format(data.stake.totalStaked)} sat · ${stakers} wallet${stakers === 1 ? "" : "s"}`,
      done: true,
    },
    {
      label: "Per-wallet pricing",
      value:
        abusive === 0
          ? "all wallets at base rate"
          : `${abusive} abusive wallet${abusive === 1 ? "" : "s"} surcharged`,
      done: true,
    },
    {
      label: "Slash log",
      value:
        slashes === 0 && pool === 0
          ? "no slashes yet · pool empty"
          : `${slashes} recent event${slashes === 1 ? "" : "s"} · ${SAT_FMT.format(pool)} sat in pool`,
      done: true,
    },
  ];
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
        ? "polling"
        : status === "error"
          ? "offline"
          : "—";
  const dotClass = cn(
    "inline-block size-1.5 rounded-full",
    status === "live" && "bg-[color:var(--color-success)]",
    status === "error" && "bg-destructive",
    status !== "live" && status !== "error" && "bg-muted-foreground"
  );
  const labelClass = cn(
    status === "live" && "text-foreground",
    status === "error" && "text-destructive",
    status !== "live" && status !== "error" && "text-muted-foreground"
  );
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
    <div className="flex items-center gap-2 font-mono text-[12px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className={dotClass} />
        <span className={labelClass}>{label}</span>
      </span>
      <span className="text-muted-foreground/60">·</span>
      <span>{ts}</span>
    </div>
  );
}
