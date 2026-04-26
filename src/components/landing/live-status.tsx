"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useDashboard, type DashboardSnapshot } from "@/lib/use-dashboard";

const SAT_FMT = new Intl.NumberFormat("en-US");
const POLL_MS = 2000;

interface Row {
  label: string;
  value: string;
  done: boolean;
}

export function LiveStatus() {
  const { data, status, lastUpdated } = useDashboard(POLL_MS);
  const rows = buildRows(data, status);

  return (
    <Card size="sm">
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
      </CardContent>
    </Card>
  );
}

function buildRows(
  data: DashboardSnapshot | null,
  status: "idle" | "loading" | "live" | "error"
): Row[] {
  const live = status === "live" && data !== null;
  if (!live || !data) {
    return [
      { label: "L402 paywall", value: "—", done: false },
      { label: "Surge engine", value: "—", done: false },
      { label: "Reputation staking", value: "—", done: false },
      { label: "Per-wallet pricing", value: "—", done: false },
      { label: "Slash log", value: "—", done: false },
    ];
  }
  const abusive = data.topStakers.filter((s) => s.tier === "abusive").length;
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
      value: `${SAT_FMT.format(data.stake.totalStaked)} sat · ${data.topStakers.length} wallet${data.topStakers.length === 1 ? "" : "s"}`,
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
      value: `${data.recentSlashes.length} recent event${data.recentSlashes.length === 1 ? "" : "s"} · ${SAT_FMT.format(data.stake.pool)} sat in pool`,
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
