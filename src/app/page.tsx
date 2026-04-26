import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-24 px-6 py-20 sm:py-24 lg:gap-32 lg:px-8 lg:py-28">
      <Hero />
      <Primitives />
      <BuildStatus />
      <TryIt />
    </div>
  );
}

function Hero() {
  return (
    <section className="flex flex-col gap-6">
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Hacknation Challenge 02 · economic immune system
      </span>
      <h1 className="max-w-4xl text-balance text-5xl leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
        Price attackers out.{" "}
        <span className="text-muted-foreground">Pay honest agents back.</span>
      </h1>
      <p className="max-w-2xl text-[15px] leading-[1.6] text-muted-foreground sm:text-base">
        Acrux is a drop-in Lightning Network middleware. Per-load surge pricing,
        per-wallet attacker pricing, and reputation staking with slashing —
        every transaction settles in milliseconds. No signups, no API keys, no
        chargebacks.
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Link
          href="/dashboard"
          className="group inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
        >
          Open dashboard
          <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
        <Link
          href="/api/price"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-transparent px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-card"
        >
          curl /api/price
        </Link>
      </div>
    </section>
  );
}

function Primitives() {
  return (
    <section className="flex flex-col gap-8">
      <SectionLabel
        eyebrow="Primitives"
        description="Three things Acrux does that nothing else can."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {PRIMITIVES.map((p) => (
          <Card
            key={p.label}
            className="transition-colors hover:border-foreground/20"
            size="sm"
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-[color:var(--color-lightning)]/40 bg-[color:var(--color-lightning-soft)] text-[color:var(--color-lightning)]"
                >
                  {p.label}
                </Badge>
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  primitive
                </span>
              </div>
              <CardTitle className="text-[15px] font-semibold tracking-tight">
                {p.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] leading-[1.6] text-muted-foreground">
                {p.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function BuildStatus() {
  return (
    <section className="flex flex-col gap-8">
      <SectionLabel
        eyebrow="Build status"
        description="signet (mutinynet) · mainnet swap @ H21"
      />
      <Card size="sm">
        <CardContent>
          <ul className="flex flex-col gap-2 font-mono text-[13px]">
            {STATUS.map((s) => (
              <li key={s.hour} className="flex items-baseline gap-3">
                <span className="w-12 shrink-0 text-muted-foreground">
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
    </section>
  );
}

function TryIt() {
  return (
    <section className="flex flex-col gap-8">
      <SectionLabel
        eyebrow="Try it"
        description="Live on signet — copy-paste, no auth."
      />
      <Card size="sm" className="bg-black/40">
        <CardContent className="flex flex-col gap-2 font-mono text-[12px] leading-[1.6]">
          <div className="text-muted-foreground">
            # Free price quote — read the live surge multiplier
          </div>
          <div>
            <span className="text-[color:var(--color-lightning)]">$</span> curl
            localhost:3000/api/price
          </div>
          <div className="pt-2 text-muted-foreground">
            # Paywalled ping — returns 402 + Lightning invoice on first hit
          </div>
          <div>
            <span className="text-[color:var(--color-lightning)]">$</span> curl
            -i localhost:3000/api/ping
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function SectionLabel({
  eyebrow,
  description,
}: {
  eyebrow: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </span>
      <p className="text-[13px] leading-[1.6] text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
