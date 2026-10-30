import type { DashboardSnapshot } from "./dashboard-snapshot";
import {
  ambientPaymentEvents,
  ambientSlashEvents,
  seeded,
} from "./event-stream";
import {
  ambientRps,
  loadBand,
  pricingConfig,
  surgeMultiplier,
} from "./pricing";
import { tierFromScore } from "./reputation";
import type { WalletPriceQuote, WalletState } from "./types";

// Fully synthetic dashboard snapshot — zero Redis round trips. Serves two
// jobs:
//   1. Explicit dummy API: /api/dashboard?mode=mock always returns this, so
//      the dashboard can be exercised end-to-end with no backing store.
//   2. Sandbox fallback: getDashboardSnapshot serves this when Redis is
//      unconfigured or failing (e.g. Upstash request quota exhausted), so the
//      public dashboard never renders empty panels.
//
// Everything is anchored to wallclock buckets through the same deterministic
// PRNG the ambient event stream uses, so concurrent viewers see identical
// state and values drift tick-to-tick instead of thrashing per poll. Wallets
// mirror the event-stream pool so the leaderboard cross-references the
// payment feed and slash log.

// Stakers advance on a slow bucket so the leaderboard visibly breathes
// without reordering every second.
const STAKER_DRIFT_INTERVAL_MS = 60_000;

const MOCK_STAKERS: Array<{
  wallet: string;
  stake: number;
  score: number;
  yieldSats: number;
}> = [
  { wallet: "agent_lupus_a4f3", stake: 12500, score: 78, yieldSats: 412 },
  { wallet: "agent_corvus_b9d1", stake: 8400, score: 56, yieldSats: 287 },
  { wallet: "agent_lyra_c7e2", stake: 6100, score: 42, yieldSats: 138 },
  { wallet: "agent_orion_d2c8", stake: 4500, score: 19, yieldSats: 0 },
  { wallet: "agent_cassio_e1b6", stake: 3200, score: -8, yieldSats: 0 },
  { wallet: "agent_dread_x9z2", stake: 2600, score: -72, yieldSats: 0 },
  { wallet: "agent_chaos_y2w7", stake: 900, score: -64, yieldSats: 0 },
];

const POOL_BASE_SATS = 1820;

function mockTopStakers(now: number): WalletState[] {
  const bucket = Math.floor(now / STAKER_DRIFT_INTERVAL_MS);
  return MOCK_STAKERS.map((s, i) => {
    const rand = seeded(bucket * 31 + i);
    // ±2% stake drift and ±2 score drift per bucket — enough to read as a
    // live ledger, small enough to never reorder the board.
    const stakeSats = Math.max(
      0,
      Math.round(s.stake * (0.98 + rand() * 0.04)),
    );
    const score = Math.max(
      -100,
      Math.min(100, s.score + Math.floor(rand() * 5) - 2),
    );
    return {
      wallet: s.wallet,
      stakeSats,
      score,
      yieldSats: s.yieldSats,
      tier: tierFromScore(score),
    };
  }).sort((a, b) => b.stakeSats - a.stakeSats);
}

function mockPrice(now: number): WalletPriceQuote {
  const rps = Math.round(ambientRps(now) * 100) / 100;
  const multiplier = surgeMultiplier(rps);
  const priceSats = Math.max(
    1,
    Math.ceil(pricingConfig.basePriceSats * multiplier),
  );
  // Anonymous quote — same shape currentPriceForWallet(null) returns.
  return {
    basePriceSats: pricingConfig.basePriceSats,
    rps,
    multiplier: Math.round(multiplier * 100) / 100,
    priceSats,
    load: loadBand(rps),
    maxMultiplier: pricingConfig.maxMultiplier,
    quotedAt: new Date(now).toISOString(),
    wallet: null,
    walletScore: null,
    walletTier: null,
    walletMultiplier: 1,
    walletStakeSats: null,
    finalPriceSats: priceSats,
  };
}

export function buildMockSnapshot(now: number = Date.now()): DashboardSnapshot {
  const topStakers = mockTopStakers(now);
  const totalStaked = topStakers.reduce((sum, s) => sum + s.stakeSats, 0);

  const bucket = Math.floor(now / STAKER_DRIFT_INTERVAL_MS);
  const rand = seeded(bucket);
  const pool = POOL_BASE_SATS + Math.floor(rand() * 400);

  return {
    ok: true,
    source: "mock",
    price: mockPrice(now),
    stake: { pool, totalStaked },
    topStakers,
    recentSlashes: ambientSlashEvents(now),
    recentPayments: ambientPaymentEvents(now),
    health: {
      // Simulated store — reported healthy so every panel renders fully.
      // `source: "mock"` above is the honest marker that no Redis state
      // backs this snapshot.
      redis: { ok: true, latencyMs: 2 + Math.floor(rand() * 4) },
      mdk: {
        configured: Boolean(
          process.env.MDK_ACCESS_TOKEN && process.env.MDK_MNEMONIC,
        ),
      },
    },
    generatedAt: new Date(now).toISOString(),
  };
}
