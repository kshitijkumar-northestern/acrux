import { getRedis } from "./redis";

const RPS_KEY = "acrux:rps:requests";
const RPS_WINDOW_MS = 1_000;
const RPS_TRIM_MS = 5_000;

const BASE_PRICE_SATS = Math.max(
  1,
  Number.parseInt(process.env.ACRUX_BASE_PRICE_SATS ?? "1", 10) || 1,
);
const MAX_MULTIPLIER = Math.max(
  1,
  Number.parseInt(process.env.ACRUX_MAX_SURGE_MULTIPLIER ?? "10000", 10) ||
    10_000,
);

export type LoadBand = "idle" | "light" | "hot" | "attack";

export interface PriceQuote {
  basePriceSats: number;
  rps: number;
  multiplier: number;
  priceSats: number;
  load: LoadBand;
  maxMultiplier: number;
  quotedAt: string;
}

// Sketch backed by a Redis sorted set keyed on timestamp. Trimmed on every
// write so the structure stays bounded under attack.
export async function recordRequest(): Promise<void> {
  const redis = getRedis();
  const now = Date.now();
  const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
  await Promise.all([
    redis.zadd(RPS_KEY, { score: now, member }),
    redis.zremrangebyscore(RPS_KEY, 0, now - RPS_TRIM_MS),
  ]);
}

export async function currentRps(): Promise<number> {
  const redis = getRedis();
  const now = Date.now();
  const count = await redis.zcount(RPS_KEY, now - RPS_WINDOW_MS, now);
  return Number(count) || 0;
}

// Continuous, monotonic, capped at MAX_MULTIPLIER.
//   idle    rps in [0, 1]    →  1×
//   light   rps in (1, 10]   →  1–5.5×
//   hot     rps in (10, 100] →  5.5–50.5×
//   attack  rps in (100, ∞)  →  exponential blow-up to cap
export function surgeMultiplier(rps: number): number {
  const safe = Math.max(0, rps);
  if (safe <= 1) return 1;
  if (safe <= 10) return 1 + (safe - 1) * 0.5;
  if (safe <= 100) return 5.5 + (safe - 10) * 0.5;
  const overload = (safe - 100) / 10;
  const surge = 50.5 * Math.pow(1.5, overload);
  return Math.min(surge, MAX_MULTIPLIER);
}

export function loadBand(rps: number): LoadBand {
  if (rps <= 1) return "idle";
  if (rps <= 10) return "light";
  if (rps <= 100) return "hot";
  return "attack";
}

export async function currentPrice(): Promise<PriceQuote> {
  const rps = await currentRps();
  const multiplier = surgeMultiplier(rps);
  const priceSats = Math.max(1, Math.ceil(BASE_PRICE_SATS * multiplier));
  return {
    basePriceSats: BASE_PRICE_SATS,
    rps,
    multiplier: Math.round(multiplier * 100) / 100,
    priceSats,
    load: loadBand(rps),
    maxMultiplier: MAX_MULTIPLIER,
    quotedAt: new Date().toISOString(),
  };
}

export const pricingConfig = {
  basePriceSats: BASE_PRICE_SATS,
  maxMultiplier: MAX_MULTIPLIER,
  rpsWindowMs: RPS_WINDOW_MS,
} as const;
