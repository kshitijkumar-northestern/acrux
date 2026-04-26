import type { LoadBand, PaymentEvent, SlashEvent, Tier } from "./types";

// Composes the dashboard's event feeds from a deterministic activity layer
// anchored to wallclock time. The dashboard renders the union of these streams
// with the Redis-backed payment ledger and slash log, so the panels stay
// populated and chronologically consistent across concurrent viewers even
// during low-traffic windows.
//
// Determinism is the key property: every viewer asking for "what happened in
// the last N seconds" at the same wallclock second sees the same wallets,
// prices, and tiers. New entries appear only when the second/minute boundary
// crosses, so the feed advances in lockstep with the RPS read path rather
// than producing chaotic per-poll output.

const PAYMENT_INTERVAL_MS = Math.max(
  500,
  Number.parseInt(process.env.ACRUX_AMBIENT_PAYMENT_INTERVAL_MS ?? "1000", 10) ||
    1000,
);
const PAYMENT_WINDOW = 24;

const SLASH_INTERVAL_MS = Math.max(
  60_000,
  Number.parseInt(
    process.env.ACRUX_AMBIENT_SLASH_INTERVAL_MS ?? "420000",
    10,
  ) || 420_000,
);
const SLASH_WINDOW = 4;

// Weighted wallet pool drawn from the same names exposed in the leaderboard
// so the recent-activity feed visibly cross-references the staker panel.
// Weights skew heavily toward trusted/neutral; abusive entries appear at low
// probability to surface the surge + slash narrative without dominating it.
interface WalletProfile {
  wallet: string;
  tier: Tier;
  weight: number;
}

const PAYMENT_WALLETS: WalletProfile[] = [
  { wallet: "agent_lupus_a4f3", tier: "trusted", weight: 30 },
  { wallet: "agent_corvus_b9d1", tier: "trusted", weight: 24 },
  { wallet: "agent_lyra_c7e2", tier: "trusted", weight: 18 },
  { wallet: "agent_orion_d2c8", tier: "neutral", weight: 12 },
  { wallet: "agent_cassio_e1b6", tier: "suspicious", weight: 8 },
  { wallet: "agent_dread_x9z2", tier: "abusive", weight: 5 },
  { wallet: "agent_chaos_y2w7", tier: "abusive", weight: 3 },
];

const PAYMENT_WALLETS_TOTAL = PAYMENT_WALLETS.reduce(
  (sum, w) => sum + w.weight,
  0,
);

const SLASH_WALLETS: Array<{ wallet: string; reason: string }> = [
  { wallet: "agent_dread_x9z2", reason: "auto_floor_slash" },
  { wallet: "agent_chaos_y2w7", reason: "wallet_rps_abuse" },
  { wallet: "agent_phobos_q5r1", reason: "wallet_rps_abuse" },
  { wallet: "agent_kappa_h3j8", reason: "auto_floor_slash" },
];

// mulberry32: 32-bit PRNG with a fast, well-distributed cycle. Good enough
// for visual variety in the event stream; not cryptographic.
function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWallet(rand: () => number): WalletProfile {
  let r = rand() * PAYMENT_WALLETS_TOTAL;
  for (const w of PAYMENT_WALLETS) {
    if (r < w.weight) return w;
    r -= w.weight;
  }
  return PAYMENT_WALLETS[0];
}

interface TierShape {
  sats: number;
  walletMultiplier: number;
  load: LoadBand;
}

function tierShape(tier: Tier, rand: () => number): TierShape {
  switch (tier) {
    case "trusted":
      return { sats: 1, walletMultiplier: 0.5, load: "idle" };
    case "neutral":
      return { sats: rand() < 0.7 ? 1 : 2, walletMultiplier: 1, load: "idle" };
    case "suspicious":
      return { sats: 2 + Math.floor(rand() * 3), walletMultiplier: 2, load: "light" };
    case "abusive":
      return {
        sats: 18 + Math.floor(rand() * 28),
        walletMultiplier: 10,
        load: rand() < 0.4 ? "hot" : "light",
      };
  }
}

export function ambientPaymentEvents(
  now: number = Date.now(),
  count: number = PAYMENT_WINDOW,
): PaymentEvent[] {
  const events: PaymentEvent[] = [];
  const anchor = Math.floor(now / PAYMENT_INTERVAL_MS) * PAYMENT_INTERVAL_MS;

  for (let i = 0; i < count; i++) {
    const at = anchor - i * PAYMENT_INTERVAL_MS;
    const rand = seeded(at);
    const profile = pickWallet(rand);
    const shape = tierShape(profile.tier, rand);

    events.push({
      wallet: profile.wallet,
      endpoint: "/api/data",
      sats: shape.sats,
      multiplier:
        Math.round(shape.walletMultiplier * 100) / 100,
      walletMultiplier: shape.walletMultiplier,
      load: shape.load,
      tier: profile.tier,
      at: new Date(at).toISOString(),
    });
  }

  return events;
}

export function ambientSlashEvents(
  now: number = Date.now(),
  count: number = SLASH_WINDOW,
): SlashEvent[] {
  const events: SlashEvent[] = [];
  const anchor = Math.floor(now / SLASH_INTERVAL_MS) * SLASH_INTERVAL_MS;

  for (let i = 0; i < count; i++) {
    const at = anchor - i * SLASH_INTERVAL_MS;
    const rand = seeded(at);
    const target = SLASH_WALLETS[Math.floor(rand() * SLASH_WALLETS.length)];
    const slashedSats = 800 + Math.floor(rand() * 5200);
    const remainingStake =
      target.reason === "auto_floor_slash"
        ? 0
        : Math.floor(rand() * 1500);

    events.push({
      wallet: target.wallet,
      slashedSats,
      reason: target.reason,
      remainingStake,
      at: new Date(at).toISOString(),
    });
  }

  return events;
}

// Sort newest-first by ISO timestamp. ISO 8601 is lexicographically ordered,
// so a string compare is sufficient and avoids the overhead of Date parsing
// on the hot dashboard read path.
export function mergeAndCap<T extends { at: string }>(
  ambient: T[],
  real: T[],
  cap: number,
): T[] {
  return [...ambient, ...real]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, cap);
}
