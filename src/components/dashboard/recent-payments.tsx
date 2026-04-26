import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LoadBand, PaymentEvent, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

const SAT_FMT = new Intl.NumberFormat("en-US");
const TIME_FMT = new Intl.DateTimeFormat([], {
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function RecentPayments({ events }: { events: PaymentEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-4">
          <CardTitle className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            recent payments
          </CardTitle>
          <CardDescription className="font-mono text-[12px]">
            {events.length === 0
              ? "awaiting first paid request"
              : `${events.length} event${events.length === 1 ? "" : "s"}`}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            no settled payments yet — first 200 from /api/data, /api/search,
            /api/synth or /api/ping appears here.
          </p>
        ) : (
          <Table className="font-mono text-[12px]">
            <TableHeader>
              <TableRow>
                <TableHead>endpoint</TableHead>
                <TableHead>wallet</TableHead>
                <TableHead className="text-right">price</TableHead>
                <TableHead className="text-right">×</TableHead>
                <TableHead className="text-right">load</TableHead>
                <TableHead className="text-right">time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e, i) => (
                <TableRow key={`${e.at}-${i}`}>
                  <TableCell className="text-foreground">{e.endpoint}</TableCell>
                  <TableCell className={cn(walletClass(e.tier))}>
                    {e.wallet ? truncate(e.wallet) : "anonymous"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {SAT_FMT.format(e.sats)} sat
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatMultiplier(e.multiplier)}×
                  </TableCell>
                  <TableCell className="text-right">
                    <LoadBadge load={e.load} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatTime(e.at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function truncate(wallet: string): string {
  if (wallet.length <= 18) return wallet;
  return `${wallet.slice(0, 8)}…${wallet.slice(-6)}`;
}

function walletClass(tier: Tier | null): string {
  if (tier === "abusive") return "text-destructive";
  if (tier === "trusted") return "text-foreground";
  return "text-muted-foreground";
}

function formatMultiplier(m: number): string {
  if (m >= 100) return Math.round(m).toString();
  if (m >= 10) return m.toFixed(1);
  return m.toFixed(2).replace(/\.?0+$/, "");
}

function formatTime(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "—";
  return TIME_FMT.format(d);
}

function LoadBadge({ load }: { load: LoadBand }) {
  if (load === "attack") {
    return (
      <Badge
        variant="outline"
        className="border-destructive/40 bg-destructive/10 text-destructive uppercase tracking-wider text-[10px]"
      >
        {load}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="uppercase tracking-wider text-[10px] text-muted-foreground"
    >
      {load}
    </Badge>
  );
}
