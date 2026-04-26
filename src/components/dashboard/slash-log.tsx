import type { SlashEvent } from "@/lib/types";

const SAT_FMT = new Intl.NumberFormat("en-US");

export function SlashLog({ events }: { events: SlashEvent[] }) {
  return (
    <article className="rounded-lg border border-[color:var(--color-border)] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-subtle)]">
          slash log
        </div>
        <div className="font-mono text-xs text-[color:var(--color-subtle)]">
          last {events.length} event{events.length === 1 ? "" : "s"}
        </div>
      </div>
      {events.length === 0 ? (
        <div className="font-mono text-sm text-[color:var(--color-subtle)]">
          no slashes yet — abusive wallets at score floor will land here
        </div>
      ) : (
        <ul className="space-y-2 font-mono text-xs">
          {events.map((e, i) => (
            <li
              key={`${e.wallet}-${e.at}-${i}`}
              className="flex items-baseline justify-between gap-3 border-t border-[color:var(--color-border)] pt-2 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-col">
                <span className="text-[color:var(--color-foreground)]">
                  {truncate(e.wallet)}
                </span>
                <span className="text-[color:var(--color-subtle)]">
                  {e.reason} · remaining {SAT_FMT.format(e.remainingStake)} sat
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-semibold text-[color:var(--color-accent)] tabular-nums">
                  −{SAT_FMT.format(e.slashedSats)} sat
                </span>
                <span className="text-[color:var(--color-subtle)]">
                  {formatTime(e.at)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function truncate(wallet: string): string {
  if (wallet.length <= 18) return wallet;
  return `${wallet.slice(0, 8)}…${wallet.slice(-6)}`;
}

function formatTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Date(ts).toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
