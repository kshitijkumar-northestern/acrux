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
import { cn } from "@/lib/utils";
import type { Tier, WalletState } from "@/lib/types";

const SAT_FMT = new Intl.NumberFormat("en-US");

export function TopStakers({ stakers }: { stakers: WalletState[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-4">
          <CardTitle className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            top stakers
          </CardTitle>
          <CardDescription className="font-mono text-[12px]">
            {stakers.length} wallet{stakers.length === 1 ? "" : "s"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {stakers.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            no stakers yet — first POST /api/stake/deposit appears here
          </p>
        ) : (
          <Table className="font-mono text-[12px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>wallet</TableHead>
                <TableHead className="text-right">stake</TableHead>
                <TableHead className="text-right">score</TableHead>
                <TableHead className="text-right">tier</TableHead>
                <TableHead className="text-right">yield</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stakers.map((s, i) => (
                <TableRow key={s.wallet}>
                  <TableCell className="text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {truncate(s.wallet)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-[color:var(--color-lightning)]">
                    {SAT_FMT.format(s.stakeSats)}
                  </TableCell>
                  <TableCell
                    className={cn("text-right tabular-nums", scoreClass(s.score))}
                  >
                    {s.score >= 0 ? "+" : ""}
                    {s.score}
                  </TableCell>
                  <TableCell className="text-right">
                    <TierBadge tier={s.tier} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-[color:var(--color-lightning)]">
                    {SAT_FMT.format(s.yieldSats)}
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

function scoreClass(score: number): string {
  if (score >= 50) return "text-[color:var(--color-lightning)]";
  if (score >= 0) return "text-foreground";
  if (score >= -50) return "text-amber-400";
  return "text-destructive";
}

function TierBadge({ tier }: { tier: Tier }) {
  const className = {
    trusted:
      "border-[color:var(--color-lightning)]/40 bg-[color:var(--color-lightning-soft)] text-[color:var(--color-lightning)]",
    neutral: "",
    suspicious: "border-amber-400/40 bg-amber-400/10 text-amber-400",
    abusive: "border-destructive/40 bg-destructive/10 text-destructive",
  }[tier];
  return (
    <Badge
      variant="outline"
      className={cn(
        "uppercase tracking-wider text-[10px]",
        className
      )}
    >
      {tier}
    </Badge>
  );
}
