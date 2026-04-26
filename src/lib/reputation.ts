import { getRedis } from "./redis";
import {
  SCORE_MAX,
  SCORE_MIN,
  type SlashEvent,
  type Tier,
  type WalletState,
} from "./types";

// Redis layout owned exclusively by this module. No other module writes these.
const K_WALLET = (wallet: string) => `acrux:stake:wallet:${wallet}`;
const K_STAKERS = "acrux:stake:stakers";
const K_POOL = "acrux:stake:pool";
const K_TOTAL = "acrux:stake:total";
const K_SLASHLOG = "acrux:stake:slashlog";

const SLASHLOG_CAP = 50;

// Score → tier mapping (locked).
//   score ≥ +50      → trusted    (0.5×, eligible for yield)
//   0 ≤ score < +50  → neutral    (1.0×, default)
//   -50 ≤ score < 0  → suspicious (2.0×)
//   score < -50      → abusive    (10.0×, eligible for slash)
export function tierFromScore(score: number): Tier {
  if (score >= 50) return "trusted";
  if (score >= 0) return "neutral";
  if (score >= -50) return "suspicious";
  return "abusive";
}

export function walletMultiplier(score: number): number {
  switch (tierFromScore(score)) {
    case "trusted":
      return 0.5;
    case "neutral":
      return 1.0;
    case "suspicious":
      return 2.0;
    case "abusive":
      return 10.0;
  }
}

function clampScore(score: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));
}

function defaultState(wallet: string): WalletState {
  return {
    wallet,
    stakeSats: 0,
    score: 0,
    yieldSats: 0,
    tier: "neutral",
  };
}

function toInt(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function parseState(
  wallet: string,
  raw: Record<string, unknown> | null,
): WalletState {
  if (!raw || Object.keys(raw).length === 0) return defaultState(wallet);
  const score = clampScore(toInt(raw.score, 0));
  return {
    wallet,
    stakeSats: Math.max(0, toInt(raw.stake, 0)),
    score,
    yieldSats: Math.max(0, toInt(raw.yield, 0)),
    tier: tierFromScore(score),
  };
}

export async function getWallet(wallet: string): Promise<WalletState> {
  const redis = getRedis();
  const raw = await redis.hgetall<Record<string, unknown>>(K_WALLET(wallet));
  return parseState(wallet, raw);
}

export async function deposit(
  wallet: string,
  sats: number,
): Promise<WalletState> {
  if (!Number.isFinite(sats) || sats <= 0) {
    throw new Error("Acrux: deposit must be a positive integer of sats.");
  }
  const redis = getRedis();
  const amount = Math.floor(sats);
  const newStake = await redis.hincrby(K_WALLET(wallet), "stake", amount);
  await Promise.all([
    redis.zadd(K_STAKERS, { score: newStake, member: wallet }),
    redis.incrby(K_TOTAL, amount),
  ]);
  return getWallet(wallet);
}

export async function bumpScore(
  wallet: string,
  delta: number,
  _reason?: string,
): Promise<WalletState> {
  const redis = getRedis();
  const next = await redis.hincrby(
    K_WALLET(wallet),
    "score",
    Math.trunc(delta),
  );
  // hincrby has no clamp — re-pin to the legal range if we overshot.
  if (next > SCORE_MAX || next < SCORE_MIN) {
    await redis.hset(K_WALLET(wallet), { score: clampScore(next) });
  }
  return getWallet(wallet);
}

export async function slash(
  wallet: string,
  fraction: number,
  reason: string = "manual",
): Promise<{ state: WalletState; event: SlashEvent }> {
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
    throw new Error("Acrux: slash fraction must be in (0, 1].");
  }
  const redis = getRedis();
  const before = await getWallet(wallet);
  const slashedSats = Math.floor(before.stakeSats * fraction);
  const remaining = before.stakeSats - slashedSats;

  if (slashedSats > 0) {
    await Promise.all([
      redis.hset(K_WALLET(wallet), { stake: remaining }),
      redis.zadd(K_STAKERS, { score: remaining, member: wallet }),
      redis.incrby(K_POOL, slashedSats),
      redis.incrby(K_TOTAL, -slashedSats),
    ]);
  }

  const event: SlashEvent = {
    wallet,
    slashedSats,
    reason,
    remainingStake: remaining,
    at: new Date().toISOString(),
  };

  await redis.lpush(K_SLASHLOG, JSON.stringify(event));
  await redis.ltrim(K_SLASHLOG, 0, SLASHLOG_CAP - 1);

  const state = await getWallet(wallet);
  return { state, event };
}

export async function getPool(): Promise<number> {
  const redis = getRedis();
  const raw = await redis.get<string | number>(K_POOL);
  return Math.max(0, toInt(raw, 0));
}

export async function getTotalStaked(): Promise<number> {
  const redis = getRedis();
  const raw = await redis.get<string | number>(K_TOTAL);
  return Math.max(0, toInt(raw, 0));
}

export async function listTopStakers(
  limit: number = 10,
): Promise<WalletState[]> {
  const redis = getRedis();
  // Highest stake first.
  const wallets = await redis.zrange<string[]>(K_STAKERS, 0, limit - 1, {
    rev: true,
  });
  if (!wallets.length) return [];
  return Promise.all(wallets.map((w) => getWallet(w)));
}

export async function listRecentSlashes(
  limit: number = 20,
): Promise<SlashEvent[]> {
  const redis = getRedis();
  const items = await redis.lrange(K_SLASHLOG, 0, limit - 1);
  // Upstash's REST client auto-parses any value whose string body is valid
  // JSON — so an item we LPUSH'd as JSON.stringify(event) comes back already
  // shaped as the object. We tolerate both shapes here so the reader stays
  // correct against any Upstash SDK version.
  return items
    .map((it) => {
      if (it && typeof it === "object") return it as SlashEvent;
      if (typeof it === "string") {
        try {
          return JSON.parse(it) as SlashEvent;
        } catch {
          return null;
        }
      }
      return null;
    })
    .filter((e): e is SlashEvent => e !== null);
}

// Distribute the slash pool pro-rata to trusted-tier stakers and zero the pool.
// Demo flow: spam bot gets slashed → pool fills → admin calls distribute →
// honest stakers' yieldSats counters jump on the dashboard.
export async function distributeYield(): Promise<{
  distributed: number;
  recipients: number;
  poolBefore: number;
  poolAfter: number;
}> {
  const redis = getRedis();
  const poolBefore = await getPool();
  if (poolBefore <= 0) {
    return { distributed: 0, recipients: 0, poolBefore: 0, poolAfter: 0 };
  }

  const top = await listTopStakers(100);
  const trusted = top.filter((s) => s.tier === "trusted" && s.stakeSats > 0);
  if (trusted.length === 0) {
    return { distributed: 0, recipients: 0, poolBefore, poolAfter: poolBefore };
  }

  const totalTrustedStake = trusted.reduce(
    (sum, s) => sum + s.stakeSats,
    0,
  );

  let distributed = 0;
  let recipients = 0;
  for (const staker of trusted) {
    const share = Math.floor(
      (poolBefore * staker.stakeSats) / totalTrustedStake,
    );
    if (share > 0) {
      await redis.hincrby(K_WALLET(staker.wallet), "yield", share);
      distributed += share;
      recipients += 1;
    }
  }

  const remaining = poolBefore - distributed;
  await redis.set(K_POOL, remaining);

  return { distributed, recipients, poolBefore, poolAfter: remaining };
}
