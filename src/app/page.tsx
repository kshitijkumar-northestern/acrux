import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { LiveStatus } from "@/components/landing/live-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSnapshot } from "@/lib/dashboard-snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRIMITIVES = [
  {
    label: "surge",
    title: "per-load surge pricing",
    body: "Server load goes up, the Lightning invoice price goes up automatically. 1 sat at idle, 10,000 sats during a detected attack. Continuous curve.",
  },
  {
    label: "wallet",
    title: "per-wallet attacker pricing",
    body: "We don't price the route, we price the paying wallet. Honest agents stay at base rate while one bad actor pays surge prices. Stripe physically cannot do this.",
  },
  {
    label: "stake",
    title: "reputation staking + slashing",
    body: "Agents stake sats up front. Behave well → earn yield. Misbehave → stake gets slashed. The slashed pool pays the honest agents. Attackers fund their targets.",
  },
] as const;

export default async function Home() {
  // SSR-seed the landing's live panel so a cold visit paints the real
  // system state (or the offline notice) on first frame — no skeleton flash.
  const initialSnapshot = await getDashboardSnapshot();
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-24 px-6 py-20 sm:py-24 lg:gap-32 lg:px-8 lg:py-28">
      <Hero />
      <Primitives />
      <LiveSection initial={initialSnapshot} />
      <TryIt />
    </div>
  );
}

function Hero() {
  return (
    <section className="grid items-center gap-12 lg:grid-cols-2 lg:gap-12">
      <div className="flex flex-col gap-6">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Hacknation Challenge 02 · adaptive paywall on lightning
        </span>
        <h1 className="text-balance text-4xl leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
          Price attackers out{" "}
          <span className="text-muted-foreground">
            pay honest agents back
          </span>
        </h1>
        <p className="max-w-md text-[14px] leading-[1.6] text-muted-foreground">
          <strong className="font-bold text-foreground">acrux</strong> is a
          drop-in Lightning Network middleware. Per-load surge pricing,
          per-wallet attacker pricing, and reputation staking with slashing.
          Every transaction settles in milliseconds. No signups, no API keys,
          no chargebacks.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            network economics
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            href="/api/price"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-card"
          >
            curl /api/price
          </Link>
        </div>
      </div>
      <HeroVisual className="order-first lg:order-none" />
    </section>
  );
}

// Crystal icosahedron sits to the right of the hero copy on lg+. The source
// PNG has a near-black backdrop with no alpha channel; on a pure-black page
// that integrates cleanly, but we still apply a radial mask + `mix-blend-mode:
// lighten` so any compression noise at the corners cannot show as a faint
// rectangle. Decorative only, hence the empty alt and aria-hidden.
function HeroVisual({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative mx-auto aspect-square w-full max-w-[206px] select-none lg:max-w-[360px] lg:justify-self-center${
        className ? ` ${className}` : ""
      }`}
    >
      <Image
        src="/hero-crystal.png"
        alt=""
        fill
        priority
        sizes="(min-width: 1024px) 360px, 60vw"
        className="pointer-events-none object-contain mix-blend-lighten [mask-image:radial-gradient(circle_at_center,black_55%,transparent_82%)]"
      />
    </div>
  );
}

function Primitives() {
  return (
    <section className="flex flex-col gap-8">
      <SectionLabel
        eyebrow="Primitives"
        heading="Three things acrux does that nothing else can"
      />
      <div className="grid gap-4 pt-12 sm:grid-cols-3">
        {PRIMITIVES.map((p, i) => (
          <Card
            key={p.label}
            className="relative overflow-visible bg-transparent ring-0"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -top-[16px] right-8 select-none text-[4.5rem] font-semibold leading-none tracking-tight text-foreground/15"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <CardHeader>
              <Badge
                variant="outline"
                className="h-[22px] self-start rounded-sm border-border bg-transparent px-1.5 font-mono text-[11px] tracking-normal text-muted-foreground"
              >
                {p.label}
              </Badge>
              <CardTitle className="text-[15px] font-semibold tracking-tight">
                {p.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[14px] leading-[1.6] text-muted-foreground">
                {p.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function LiveSection({
  initial,
}: {
  initial: Awaited<ReturnType<typeof getDashboardSnapshot>>;
}) {
  return (
    <section className="flex flex-col gap-8">
      <SectionLabel
        eyebrow="Live status"
        heading="Real numbers from Redis"
        description="Pulled from /api/dashboard. Signet (mutinynet)."
      />
      <LiveStatus initial={initial} />
    </section>
  );
}

function TryIt() {
  return (
    <section className="flex flex-col gap-8">
      <SectionLabel
        eyebrow="Try it"
        heading="No signups, no keys, just curl"
      />
      <Card size="sm" className="bg-black/40">
        <CardContent className="flex flex-col gap-2 font-mono text-[12px] leading-[1.6]">
          <div className="text-muted-foreground">
            # Free price quote · read the live surge multiplier
          </div>
          <div>
            <span className="text-muted-foreground">$</span> curl
            localhost:3000/api/price
          </div>
          <div className="pt-2 text-muted-foreground">
            # Paywalled ping · returns 402 + Lightning invoice on first hit
          </div>
          <div>
            <span className="text-muted-foreground">$</span> curl -i
            localhost:3000/api/ping
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function SectionLabel({
  eyebrow,
  heading,
  description,
}: {
  eyebrow: string;
  heading: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </span>
      <h2 className="max-w-2xl text-balance text-3xl leading-[1.15] tracking-[-0.04em] sm:text-4xl">
        {heading}
      </h2>
      {description ? (
        <p className="max-w-2xl text-[14px] leading-[1.6] text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
