"use client";

import {
  PoolCounter,
  TotalStakedCounter,
} from "@/components/dashboard/pool-counter";
import { PriceTicker } from "@/components/dashboard/price-ticker";
import { RpsSparkline } from "@/components/dashboard/rps-sparkline";
import { SlashLog } from "@/components/dashboard/slash-log";
import { TopStakers } from "@/components/dashboard/top-stakers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDashboard, type DashboardSnapshot } from "@/lib/use-dashboard";

export default function DashboardPage() {
  const { data, error, status, lastUpdated } = useDashboard(1000);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 sm:py-16">
      <DashboardHeader status={status} lastUpdated={lastUpdated} />
      {error ? (
        <ErrorPanel error={error} />
      ) : !data ? (
        <LoadingPanel />
      ) : (
        <Tiles data={data} />
      )}
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Live metrics
        </span>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          The economic immune system, live.
        </h1>
        <p className="text-sm text-muted-foreground">
          1Hz poll of <code className="rounded bg-card px-1 py-0.5 text-[11px]">/api/dashboard</code>.
          All numbers are live Redis state.
        </p>
      </div>
      <StatusPill status={status} lastUpdated={lastUpdated} />
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
    status === "live" && "bg-[color:var(--color-lightning)]",
    status === "error" && "bg-destructive",
    status !== "live" && status !== "error" && "bg-muted-foreground"
  );
  const labelClass = cn(
    "font-mono",
    status === "live" && "text-[color:var(--color-lightning)]",
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
    <div className="flex shrink-0 items-center gap-3 rounded-md border border-border bg-card/40 px-3 py-1.5 font-mono text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className={dotClass} />
        <span className={labelClass}>{label}</span>
      </span>
      <span className="text-muted-foreground/60">·</span>
      <span>updated {ts}</span>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-3 py-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ErrorPanel({ error }: { error: { error: string; hint?: string } }) {
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
    </>
  );
}
