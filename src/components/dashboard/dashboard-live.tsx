"use client";

import { NetworkStatus } from "@/components/dashboard/network-status";
import {
  PoolCounter,
  TotalStakedCounter,
} from "@/components/dashboard/pool-counter";
import { PriceTicker } from "@/components/dashboard/price-ticker";
import { RecentPayments } from "@/components/dashboard/recent-payments";
import { RpsSparkline } from "@/components/dashboard/rps-sparkline";
import { SlashLog } from "@/components/dashboard/slash-log";
import { TopStakers } from "@/components/dashboard/top-stakers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  useDashboard,
  type DashboardError,
  type DashboardHealth,
  type DashboardResponse,
  type DashboardSnapshot,
} from "@/lib/use-dashboard";

export function DashboardLive({ initial }: { initial: DashboardResponse }) {
  const { data, error, status, lastUpdated } = useDashboard(initial, 1000);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-6 py-12 sm:py-16 lg:px-8">
      <DashboardHeader
        status={status}
        lastUpdated={lastUpdated}
        health={data?.health ?? null}
      />
      {data ? (
        <Tiles data={data} />
      ) : error ? (
        <ErrorPanel error={error} />
      ) : null}
    </div>
  );
}

function DashboardHeader({
  status,
  lastUpdated,
  health,
}: {
  status: "idle" | "loading" | "live" | "error";
  lastUpdated: number | null;
  health: DashboardHealth | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Live metrics
          </span>
          <h1 className="text-3xl leading-[1.1] tracking-[-0.03em] sm:text-4xl">
            Live network economics
          </h1>
          <p className="text-[13px] leading-[1.6] text-muted-foreground">
            1Hz poll of{" "}
            <code className="rounded bg-card px-1.5 py-0.5 text-[12px]">
              /api/dashboard
            </code>
            . All numbers are live Redis state.
          </p>
        </div>
        <StatusPill status={status} lastUpdated={lastUpdated} />
      </div>
      <NetworkStatus health={health} />
    </div>
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
  const dotClass = cn(
    "inline-block size-1.5 rounded-full",
    status === "live" && "bg-[color:var(--color-success)]",
    status === "error" && "bg-destructive",
    status !== "live" && status !== "error" && "bg-muted-foreground",
  );
  const labelClass = cn(
    status === "live" && "text-foreground",
    status === "error" && "text-destructive",
    status !== "live" && status !== "error" && "text-muted-foreground",
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
    <div className="flex shrink-0 items-center gap-2.5 rounded-md border border-border bg-card/40 px-3 py-1.5 font-mono text-[12px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className={dotClass} />
        <span className={labelClass}>{label}</span>
      </span>
      <span className="text-muted-foreground/60">·</span>
      <span>updated {ts}</span>
    </div>
  );
}

function ErrorPanel({ error }: { error: DashboardError }) {
  return (
    <Alert variant="destructive">
      <AlertTitle className="font-mono">
        dashboard offline · {error.error}
      </AlertTitle>
      {error.hint ? <AlertDescription>{error.hint}</AlertDescription> : null}
    </Alert>
  );
}

function Tiles({ data }: { data: DashboardSnapshot }) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PriceTicker price={data.price} />
        <PoolCounter
          poolSats={data.stake.pool}
          recentSlashCount={data.recentSlashes.length}
        />
        <TotalStakedCounter
          totalStakedSats={data.stake.totalStaked}
          walletCount={data.topStakers.length}
        />
      </section>
      <RpsSparkline
        rps={data.price.rps}
        load={data.price.load}
        multiplier={data.price.multiplier}
        generatedAt={data.generatedAt}
      />
      <section className="grid gap-4 lg:grid-cols-2">
        <TopStakers stakers={data.topStakers} />
        <SlashLog events={data.recentSlashes} />
      </section>
      <RecentPayments events={data.recentPayments} />
    </>
  );
}
