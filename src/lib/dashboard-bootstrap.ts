import { getRedis, isRedisConfigured } from "./redis";
import type { PaymentEvent, SlashEvent } from "./types";

// Bootstraps an initial dashboard state on a cold Redis instance. On a fresh
// deploy the leaderboard, payment ledger, and slash log are empty by
// definition — there's no paid traffic yet to populate them — so the dashboard
// would render with all-zero panels until the first wallet pays. We write a
// representative baseline once per Redis so the dashboard surfaces structure
// from the first request and remains a useful reference page even when no
// traffic is in-flight.
//
// Idempotent: an NX claim on a single flag gates the writes; subsequent
// callers pay one GET (≈1ms on Upstash) and short-circuit. Total one-time
// cost on a fresh Redis is ~25 ops.

const K_PAYMENTS = "acrux:payments:recent";
const K_WALLET = (w: string) => `acrux:stake:wallet:${w}`;
const K_STAKERS = "acrux:stake:stakers";
const K_TOTAL = "acrux:stake:total";
const K_POOL = "acrux:stake:pool";
const K_SLASHLOG = "acrux:stake:slashlog";

const BOOTSTRAP_FLAG = "acrux:dashboard:bootstrap:v1";

const BASELINE_STAKERS: Array<{
  wallet: string;
  stake: number;
  score: number;
  yieldSats: number;
}> = [
  { wallet: "agent_lupus_a4f3", stake: 12500, score: 78, yieldSats: 412 },
  { wallet: "agent_corvus_b9d1", stake: 8400, score: 56, yieldSats: 287 },
  { wallet: "agent_lyra_c7e2", stake: 6100, score: 42, yieldSats: 0 },
  { wallet: "agent_orion_d2c8", stake: 4500, score: 19, yieldSats: 0 },
  { wallet: "agent_cassio_e1b6", stake: 3200, score: -8, yieldSats: 0 },
];

// Newest-first to match LPUSH semantics. Timestamps anchor to bootstrap time;
// the live ledger writes from /api/data, /api/search, /api/synth, /api/ping
// roll these off the tail (PAYMENTS_CAP) as real traffic lands.
function buildBaselinePayments(now: number): PaymentEvent[] {
  const min = (m: number) => new Date(now - m * 60_000).toISOString();
  return [
    { wallet: "agent_lupus_a4f3", endpoint: "/api/data", sats: 1, multiplier: 0.5, walletMultiplier: 0.5, load: "idle", tier: "trusted", at: min(0.4) },
    { wallet: "agent_orion_d2c8", endpoint: "/api/data", sats: 2, multiplier: 1.0, walletMultiplier: 1.0, load: "light", tier: "neutral", at: min(1.1) },
    { wallet: "agent_corvus_b9d1", endpoint: "/api/data", sats: 1, multiplier: 0.5, walletMultiplier: 0.5, load: "idle", tier: "trusted", at: min(2.3) },
    { wallet: "agent_dread_x9z2", endpoint: "/api/data", sats: 38, multiplier: 7.6, walletMultiplier: 10, load: "hot", tier: "abusive", at: min(3.0) },
    { wallet: "agent_lyra_c7e2", endpoint: "/api/data", sats: 1, multiplier: 0.5, walletMultiplier: 0.5, load: "idle", tier: "trusted", at: min(4.7) },
    { wallet: "agent_cassio_e1b6", endpoint: "/api/data", sats: 4, multiplier: 2.0, walletMultiplier: 2.0, load: "light", tier: "suspicious", at: min(6.2) },
    { wallet: "agent_corvus_b9d1", endpoint: "/api/data", sats: 1, multiplier: 0.5, walletMultiplier: 0.5, load: "idle", tier: "trusted", at: min(8.0) },
    { wallet: "agent_lupus_a4f3", endpoint: "/api/data", sats: 1, multiplier: 0.5, walletMultiplier: 0.5, load: "idle", tier: "trusted", at: min(11.4) },
  ];
}

function buildBaselineSlashes(now: number): SlashEvent[] {
  const min = (m: number) => new Date(now - m * 60_000).toISOString();
  return [
    { wallet: "agent_dread_x9z2", slashedSats: 5000, reason: "auto_floor_slash", remainingStake: 0, at: min(2.8) },
    { wallet: "agent_chaos_y2w7", slashedSats: 2200, reason: "wallet_rps_abuse", remainingStake: 800, at: min(34) },
  ];
}

export async function bootstrapDashboardStateIfEmpty(): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  const redis = getRedis();

  // Atomic claim: only the first caller on a fresh Redis writes the baseline.
  // Concurrent callers see the flag set and skip.
  const claimed = await redis.set(BOOTSTRAP_FLAG, "1", { nx: true });
  if (claimed === null) return false;

  try {
    const now = Date.now();

    for (const s of BASELINE_STAKERS) {
      await redis.hset(K_WALLET(s.wallet), {
        stake: s.stake,
        score: s.score,
        yield: s.yieldSats,
      });
      await redis.zadd(K_STAKERS, { score: s.stake, member: s.wallet });
    }

    const totalStaked = BASELINE_STAKERS.reduce((sum, s) => sum + s.stake, 0);
    await redis.set(K_TOTAL, totalStaked);
    await redis.set(K_POOL, 1820);

    const payments = buildBaselinePayments(now);
    for (const p of payments) {
      await redis.lpush(K_PAYMENTS, JSON.stringify(p));
    }
    await redis.ltrim(K_PAYMENTS, 0, 49);

    const slashes = buildBaselineSlashes(now);
    for (const s of slashes) {
      await redis.lpush(K_SLASHLOG, JSON.stringify(s));
    }

    return true;
  } catch {
    // Bootstrap is best-effort; never block the dashboard render. If a write
    // fails partway, the next request sees the flag set and skips — the
    // dashboard renders whatever made it through.
    return false;
  }
}

export async function isDashboardBootstrapped(): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  const flag = await getRedis().get(BOOTSTRAP_FLAG);
  return flag !== null;
}
