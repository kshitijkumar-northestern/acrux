import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SlashEvent } from "@/lib/types";

const SAT_FMT = new Intl.NumberFormat("en-US");

export function SlashLog({ events }: { events: SlashEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-4">
          <CardTitle className="font-mono text-[11px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
            slash log
          </CardTitle>
          <CardDescription className="font-mono text-xs">
            last {events.length} event{events.length === 1 ? "" : "s"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="font-mono text-sm text-muted-foreground">
            no slashes yet — abusive wallets at score floor will land here
          </p>
        ) : (
          <ul className="flex flex-col gap-2 font-mono text-xs">
            {events.map((e, i) => (
              <li
                key={`${e.wallet}-${e.at}-${i}`}
                className="flex flex-col gap-2"
              >
                {i > 0 ? <Separator /> : null}
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-foreground">
                      {truncate(e.wallet)}
                    </span>
                    <span className="text-muted-foreground">
                      {e.reason} · remaining {SAT_FMT.format(e.remainingStake)}{" "}
                      sat
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-semibold text-[color:var(--color-lightning)] tabular-nums">
                      −{SAT_FMT.format(e.slashedSats)} sat
                    </span>
                    <span className="text-muted-foreground">
                      {formatTime(e.at)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
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
