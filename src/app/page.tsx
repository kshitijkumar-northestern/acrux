import Link from "next/link";
import { ArrowUpRight, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const PRIMITIVES = [
  {
    label: "A",
    title: "Per-load surge pricing",
    body: "Server load goes up, the Lightning invoice price goes up automatically. 1 sat at idle, 10,000 sats during a detected attack. Continuous curve.",
  },
  {
    label: "B",
    title: "Per-wallet attacker pricing",
    body: "We don't price the route, we price the paying wallet. Honest agents stay at base rate while one bad actor pays surge prices. Stripe physically cannot do this.",
  },
  {
    label: "C",
    title: "Reputation staking + slashing",
    body: "Agents stake sats up front. Behave well → earn yield. Misbehave → stake gets slashed. The slashed pool pays the honest agents. Attackers fund their targets.",
  },
] as const;

const STATUS = [
  { hour: "0–3", label: "L402 paywall live at /api/ping", done: true },
  { hour: "3–6", label: "Surge engine + free /api/price quote", done: true },
  { hour: "6–10", label: "Reputation staking with slashing", done: true },
  { hour: "10–13", label: "Per-wallet pricing layer", done: true },
  { hour: "13–17", label: "Dashboard + dueling-bots demo", done: true },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen px-6 py-16 sm:py-24">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-16">
        <header className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--color-lightning)]">
              <Zap className="size-3" aria-hidden />
              <span>acrux</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                hacknation challenge 02
              </span>
            </div>
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 py-1 font-mono text-xs text-foreground transition-colors hover:bg-card"
            >
              dashboard
              <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Economic immune system for the agent economy.
          </h1>

          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Acrux is a drop-in Lightning Network middleware that auto-prices
            attackers out, pays honest agents back, and settles every
            transaction in milliseconds. No signups, no API keys, no
            chargebacks.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {PRIMITIVES.map((p) => (
            <Card
              key={p.label}
              className="transition-colors hover:bg-card/80"
              size="sm"
            >
              <CardHeader>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <Badge
                    variant="outline"
                    className="border-[color:var(--color-lightning)]/40 bg-[color:var(--color-lightning-soft)] text-[color:var(--color-lightning)]"
                  >
                    {p.label}
                  </Badge>
                  <span className="uppercase tracking-wider text-muted-foreground">
                    primitive
                  </span>
                </div>
                <CardTitle className="text-sm font-semibold tracking-tight">
                  {p.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                build status
              </CardTitle>
              <span className="font-mono text-xs text-muted-foreground">
                signet (mutinynet) · mainnet swap @ H21
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 font-mono text-sm">
              {STATUS.map((s) => (
                <li key={s.hour} className="flex items-baseline gap-3">
                  <span className="w-14 shrink-0 text-muted-foreground">
                    H{s.hour}
                  </span>
                  <span
                    aria-hidden
                    className={
                      s.done
                        ? "text-[color:var(--color-lightning)]"
                        : "text-muted-foreground"
                    }
                  >
                    {s.done ? "▸" : "○"}
                  </span>
                  <span
                    className={
                      s.done ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    {s.label}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            try it
          </h2>
          <Card size="sm" className="bg-black/40">
            <CardContent className="flex flex-col gap-2 font-mono text-xs leading-relaxed">
              <div className="text-muted-foreground">
                # Free price quote — read the live surge multiplier
              </div>
              <div>
                <span className="text-[color:var(--color-lightning)]">$</span>{" "}
                curl localhost:3000/api/price
              </div>
              <div className="pt-2 text-muted-foreground">
                # Paywalled ping — returns 402 + Lightning invoice on first hit
              </div>
              <div>
                <span className="text-[color:var(--color-lightning)]">$</span>{" "}
                curl -i localhost:3000/api/ping
              </div>
            </CardContent>
          </Card>
        </section>

        <footer className="flex flex-col gap-4">
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-muted-foreground">
            <div>acrux · signet (mutinynet) · mainnet swap @ H21</div>
            <div className="flex items-center gap-4">
              <Link href="/api/price" className="hover:text-foreground">
                /api/price
              </Link>
              <Link href="/api/ping" className="hover:text-foreground">
                /api/ping
              </Link>
              <Link href="/dashboard" className="hover:text-foreground">
                /dashboard
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
