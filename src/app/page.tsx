import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { FieldCopy } from "@/components/landing/agent-field";
import { LiveStatus } from "@/components/landing/live-status";
import { Story, type StoryStep } from "@/components/landing/story";
import { getDashboardSnapshot } from "@/lib/dashboard-snapshot";
import {
  composeFinalPriceSats,
  pricingConfig,
  surgeMultiplier,
} from "@/lib/pricing";
import { walletMultiplier } from "@/lib/reputation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NUM = new Intl.NumberFormat("en-US");
const BASE = pricingConfig.basePriceSats;

// Every number the story shows is computed from the live pricing engine so
// the copy can't drift from what /api/price actually charges.
//
// Top of each load band on the surge curve (see surgeMultiplier).
const SURGE_BANDS = [
  { band: "idle", multiplier: surgeMultiplier(1) },
  { band: "light", multiplier: surgeMultiplier(10) },
  { band: "hot", multiplier: surgeMultiplier(100) },
  { band: "attack", multiplier: pricingConfig.maxMultiplier },
].map((b) => ({ ...b, sats: composeFinalPriceSats(BASE, b.multiplier, 1) }));

const HOT = SURGE_BANDS[2];

// One representative score per reputation tier (see tierFromScore).
const TIERS = [
  { tier: "trusted", multiplier: walletMultiplier(50) },
  { tier: "neutral", multiplier: walletMultiplier(0) },
  { tier: "suspicious", multiplier: walletMultiplier(-50) },
  { tier: "abusive", multiplier: walletMultiplier(-51) },
].map((t) => ({
  ...t,
  sats: composeFinalPriceSats(BASE, HOT.multiplier, t.multiplier),
}));

const TRUSTED = TIERS[0];
const ABUSIVE = TIERS[3];

const FIELD_COPY: FieldCopy = {
  surge: SURGE_BANDS.map(({ band, sats }) => ({ band, sats })),
  trusted: { label: `trusted ${NUM.format(TRUSTED.multiplier)}×`, sats: TRUSTED.sats },
  abusive: { label: `abusive ${NUM.format(ABUSIVE.multiplier)}×`, sats: ABUSIVE.sats },
};

const H2 =
  "max-w-[420px] text-balance text-3xl leading-[1.1] tracking-[-0.04em] sm:text-4xl";
const BODY = "max-w-[44ch] text-[14px] leading-[1.6] text-muted-foreground";

export default async function Home() {
  // SSR-seed the live panel so a cold visit paints the real system state
  // (or the offline notice) on first frame, no skeleton flash.
  const initialSnapshot = await getDashboardSnapshot();

  const steps: StoryStep[] = [
    { id: "hero", label: "agents", content: <Hero /> },
    { id: "swarm", label: "swarm", content: <Swarm /> },
    { id: "surge", label: "surge", content: <Surge /> },
    { id: "wallet", label: "wallet", content: <Wallet /> },
    { id: "stake", label: "stake", content: <Stake /> },
    { id: "live", label: "live", content: <Live initial={initialSnapshot} /> },
  ];

  return <Story steps={steps} copy={FIELD_COPY} />;
}

// Panel children are direct children of the story panel so each one picks
// up its own stagger delay (see .story-panel in globals.css). Fragments keep
// it that way.

function Hero() {
  return (
    <>
      <h1 className="text-4xl leading-[1.05] tracking-[-0.04em] sm:text-5xl">
        <span className="block">Price attackers out</span>
        <span className="block text-muted-foreground">pay honest agents back</span>
      </h1>
      <p className={BODY}>
        <strong className="font-bold text-foreground">acrux</strong> is drop-in
        Lightning middleware. Every call is priced by server load and by the
        wallet paying for it.
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link
          href="/dashboard"
          className="group inline-flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-[13px] font-medium text-background transition-[background-color,transform] hover:bg-foreground/90 active:scale-[0.97]"
        >
          network economics
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/api/price"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1.5 font-mono text-[12px] font-medium text-foreground backdrop-blur transition-[background-color,transform] hover:bg-card active:scale-[0.97]"
        >
          curl /api/price
        </Link>
      </div>
    </>
  );
}

function Swarm() {
  return (
    <>
      <h2 className={H2}>A million agents, one API</h2>
      <p className={BODY}>
        Autonomous agents will all hit the same endpoints. A swarm that rotates
        IPs looks like everyone else, so rate limits and captchas can&apos;t
        see it.
      </p>
      <p className={`${BODY} italic`}>
        Charging for the API alone doesn&apos;t fix it. A rich attacker just
        outspends the defense.
      </p>
    </>
  );
}

function Surge() {
  return (
    <>
      <h2 className={H2}>Load goes up, so does the price</h2>
      <p className={BODY}>
        Every call returns a Lightning invoice priced off live load. Agents
        read the curve for free at{" "}
        <code className="text-[13px] text-foreground">/api/price</code> before
        they pay.
      </p>
      <div className="flex flex-col gap-2">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border font-mono sm:grid-cols-4">
          {SURGE_BANDS.map((b) => (
            <div key={b.band} className="flex flex-col gap-1 bg-background px-3 py-2.5">
              <dt className="text-[11px] text-muted-foreground">
                {b.band} {NUM.format(b.multiplier)}×
              </dt>
              <dd className="text-[13px] tabular-nums text-lightning">
                {NUM.format(b.sats)} sat
              </dd>
            </div>
          ))}
        </dl>
        <span className="font-mono text-[11px] text-muted-foreground">
          per call, base price {NUM.format(BASE)} sat
        </span>
      </div>
    </>
  );
}

function Wallet() {
  return (
    <>
      <h2 className={H2}>We price the wallet, not the route</h2>
      <p className={BODY}>
        Each L402 payment is tied to a wallet. Reputation sets that
        wallet&apos;s multiplier, so under the same load an abusive wallet
        pays {NUM.format(ABUSIVE.multiplier / TRUSTED.multiplier)}× what a
        trusted one does.
      </p>
      <div className="flex flex-col gap-2">
        <dl className="grid grid-cols-[1fr_auto_auto] gap-x-8 gap-y-2 rounded-md border border-border bg-background px-3.5 py-3 font-mono text-[13px]">
          {TIERS.map((t) => {
            // The two tiers the field labels get full weight; the middle
            // tiers recede so the table reads like the picture.
            const featured = t === TRUSTED || t === ABUSIVE;
            return (
              <div key={t.tier} className="contents">
                <dt className={featured ? "text-foreground" : "text-muted-foreground"}>
                  {t.tier}
                </dt>
                <dd
                  className={`text-right tabular-nums ${featured ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {NUM.format(t.multiplier)}×
                </dd>
                <dd
                  className={`text-right tabular-nums ${featured ? "text-lightning" : "text-lightning/55"}`}
                >
                  {NUM.format(t.sats)} sat
                </dd>
              </div>
            );
          })}
        </dl>
        <span className="font-mono text-[11px] text-muted-foreground">
          per call at hot load ({NUM.format(HOT.multiplier)}× surge)
        </span>
      </div>
    </>
  );
}

function Stake() {
  return (
    <>
      <h2 className={H2}>Attackers fund the agents they attack</h2>
      <p className={BODY}>
        Agents stake sats up front. Abusive wallets get slashed into a shared
        pool, and the pool pays trusted stakers back pro-rata.
      </p>
      <p className={`${BODY} italic`}>
        Cards can&apos;t do this. A chargeback would reverse the slash.
      </p>
    </>
  );
}

function Live({
  initial,
}: {
  initial: Awaited<ReturnType<typeof getDashboardSnapshot>>;
}) {
  return (
    <>
      <h2 className={H2}>Real numbers from Redis</h2>
      <p className={BODY}>
        Polled from <code className="text-[13px] text-foreground">/api/dashboard</code>{" "}
        every two seconds, on signet (mutinynet).
      </p>
      <LiveStatus initial={initial} />
      <div className="flex flex-col gap-1 font-mono text-[12px] leading-[1.6]">
        <div>
          <span className="text-muted-foreground">$</span> curl
          localhost:3000/api/price
        </div>
        <div>
          <span className="text-muted-foreground">$</span> curl -i
          localhost:3000/api/ping{" "}
          <span className="hidden text-muted-foreground sm:inline"># 402 + invoice</span>
        </div>
      </div>
    </>
  );
}
