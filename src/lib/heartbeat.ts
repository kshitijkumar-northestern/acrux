import { recordPayment } from "./payments";
import {
  currentPriceForWallet,
  recordRequest,
  recordWalletRequest,
} from "./pricing";
import { getRedis, isRedisConfigured } from "./redis";
import {
  bumpScore,
  deposit,
  distributeYield,
  getWallet,
  slash,
} from "./reputation";
import type { PaymentEvent } from "./types";

// Heartbeat — drives a continuous trickle of real Redis writes against the
// same stake / score / payment / slash surfaces production traffic uses, so
// the dashboard's "live" mode (which strips the observability composition
// layer and surfaces only attributable Redis state) stays populated even
// without a bot fleet running on a developer's laptop.
//
// Triggers:
//   1. Vercel Cron once per minute via /api/cron/heartbeat (Pro plan; on
//      Hobby, runs at the per-day cadence the plan enforces).
//   2. Best-effort fire-on-fetch from getDashboardSnapshot, gated by the
//      same lock so concurrent triggers fold into one tick.
//
// Rate limited via a Redis NX lock with TTL — concurrent callers all attempt
// to claim the lock; only one wins and runs the tick. Subsequent attempts
// inside the TTL window short-circuit on the lock check (~one round trip).

const HEARTBEAT_LOCK = "acrux:heartbeat:lock:v1";
const HEARTBEAT_TTL_S = 30;

// Long-lived wallet identities that survive across ticks. The trusted pool
// matches the bootstrap baseline so the leaderboard remains coherent — the
// heartbeat only nudges the same wallets that already exist there. The
// abuser is a separate identity so its cycle (climb-RPS → score floor →
// slash → re-stake) doesn't pollute the trusted set.
const TRUSTED_POOL = [
  "agent_lupus_a4f3",
  "agent_corvus_b9d1",
  "agent_lyra_c7e2",
  "agent_orion_d2c8",
];
const SUSPICIOUS_WALLET = "agent_cassio_e1b6";
const ABUSIVE_WALLET = "agent_dread_x9z2";

const ABUSE_RESTAKE_MIN_SATS = 4000;
const ABUSE_RESTAKE_RANGE_SATS = 4000;
const ABUSE_SLASH_PROBABILITY = 0.25;
const DISTRIBUTE_PROBABILITY = 0.125;

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export interface HeartbeatResult {
  ran: boolean;
  reason?: string;
  payments?: number;
  slashed?: boolean;
  distributed?: number;
}

export async function tickHeartbeat(): Promise<HeartbeatResult> {
  if (!isRedisConfigured()) {
    return { ran: false, reason: "redis_not_configured" };
  }
  const redis = getRedis();

  // Single NX claim with TTL gates the entire tick. Concurrent callers all
  // race on this; the loser sees `null` and bails after one round trip.
  const claimed = await redis.set(HEARTBEAT_LOCK, "1", {
    nx: true,
    ex: HEARTBEAT_TTL_S,
  });
  if (claimed === null) return { ran: false, reason: "rate_limited" };

  try {
    return await runTick();
  } catch (err) {
    return {
      ran: false,
      reason: err instanceof Error ? err.message : "tick_failed",
    };
  }
}

async function runTick(): Promise<HeartbeatResult> {
  // 2-3 trusted wallets settle a paid request this tick.
  const settling = shuffle(TRUSTED_POOL).slice(
    0,
    2 + Math.floor(Math.random() * 2),
  );

  // Burst RPS for the abuser so the surge curve and the load band visibly
  // react. Trusted wallets contribute one hit each below.
  const abuseHits = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < abuseHits; i++) {
    await Promise.all([recordRequest(), recordWalletRequest(ABUSIVE_WALLET)]);
  }

  let payments = 0;
  for (const wallet of settling) {
    await Promise.all([recordRequest(), recordWalletRequest(wallet)]);
    // Quote at the strict measured RPS so the recorded payment matches what
    // a real charge would have settled at this moment.
    const quote = await currentPriceForWallet(wallet, { ambient: false });
    const event: PaymentEvent = {
      wallet,
      endpoint: "/api/data",
      sats: quote.finalPriceSats,
      multiplier: Math.round(quote.multiplier * 100) / 100,
      walletMultiplier: quote.walletMultiplier,
      load: quote.load,
      tier: quote.walletTier,
      at: new Date().toISOString(),
    };
    await recordPayment(event);
    payments += 1;
  }

  await Promise.all([
    ...settling.map((w) => bumpScore(w, 1, "paid_request")),
    bumpScore(ABUSIVE_WALLET, -5, "rps_abuse"),
    bumpScore(SUSPICIOUS_WALLET, -1, "rps_anomaly"),
  ]);

  let slashed = false;
  if (Math.random() < ABUSE_SLASH_PROBABILITY) {
    const state = await getWallet(ABUSIVE_WALLET);
    if (state.stakeSats > 200) {
      const fraction = Math.min(0.4, 0.1 + Math.random() * 0.3);
      await slash(ABUSIVE_WALLET, fraction, "rps_floor_slash");
      slashed = true;
    } else {
      // Re-up so the next slash has something to take.
      await deposit(
        ABUSIVE_WALLET,
        ABUSE_RESTAKE_MIN_SATS +
          Math.floor(Math.random() * ABUSE_RESTAKE_RANGE_SATS),
      );
    }
  }

  let distributed = 0;
  if (Math.random() < DISTRIBUTE_PROBABILITY) {
    const result = await distributeYield();
    distributed = result.distributed;
  }

  return { ran: true, payments, slashed, distributed };
}
