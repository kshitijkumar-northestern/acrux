import { cn } from "@/lib/utils";
import type { DashboardHealth } from "@/lib/use-dashboard";

// Compact MDK + Redis health strip. Lives next to the main StatusPill so the
// top-right of the dashboard always tells the operator whether the underlying
// dependencies (Lightning custody + state store) are reachable, not just
// whether the API responded.
export function NetworkStatus({ health }: { health: DashboardHealth | null }) {
  const redis = health?.redis;
  const mdk = health?.mdk;

  return (
    <div className="flex items-center gap-2 font-mono text-[12px]">
      <Pill
        label="redis"
        ok={Boolean(redis?.ok)}
        detail={
          !redis
            ? "—"
            : redis.ok
              ? redis.latencyMs !== null
                ? `${redis.latencyMs}ms`
                : "ok"
              : redis.error ?? "down"
        }
      />
      <Pill
        label="mdk"
        ok={Boolean(mdk?.configured)}
        detail={mdk?.configured ? "configured" : "not configured"}
      />
    </div>
  );
}

function Pill({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1.5">
      <span
        aria-hidden
        className={cn(
          "inline-block size-1.5 rounded-full",
          ok ? "bg-[color:var(--color-success)]" : "bg-destructive",
        )}
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground/60">·</span>
      <span className={ok ? "text-foreground" : "text-destructive"}>
        {detail}
      </span>
    </div>
  );
}
