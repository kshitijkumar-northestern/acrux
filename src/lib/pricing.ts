import { getRedis } from "./redis";
import { getWallet, walletMultiplier } from "./reputation";
import type { LoadBand, PriceQuote, WalletPriceQuote } from "./types";

export type { LoadBand, PriceQuote, WalletPriceQuote };

const RPS_KEY = "acrux:rps:requests";
const WALLET_RPS_KEY = (wallet: string) => `acrux:rps:wallet:${wallet}`;
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

// Anonymous requests (no X-Acrux-Wallet header) are priced at the neutral tier.
const NEUTRAL_MULTIPLIER = 1;

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

// Per-wallet RPS sketch. Same shape as the global one, but keyed per wallet so
// we can detect a single wallet flooding the shield even when global load is
// otherwise quiet. Same trim policy keeps the structure bounded.
export async function recordWalletRequest(wallet: string): Promise<void> {
  const redis = getRedis();
  const now = Date.now();
  const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
  const key = WALLET_RPS_KEY(wallet);
  await Promise.all([
    redis.zadd(key, { score: now, member }),
    redis.zremrangebyscore(key, 0, now - RPS_TRIM_MS),
  ]);
}

export async function currentWalletRps(wallet: string): Promise<number> {
  const redis = getRedis();
  const now = Date.now();
  const count = await redis.zcount(
    WALLET_RPS_KEY(wallet),
    now - RPS_WINDOW_MS,
    now,
  );
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

// Resolves a wallet's reputation multiplier. A null score (request without
// X-Acrux-Wallet) is treated as neutral so anonymous callers pay base × surge.
export function walletMultiplierForScore(score: number | null): number {
  return score === null ? NEUTRAL_MULTIPLIER : walletMultiplier(score);
}

// Composes the surge multiplier and wallet multiplier into the single factor
// applied to the base price. Centralised so /api/data, /api/price, /api/search
// and /api/synth all charge identically.
export function composeMultiplier(
  surge: number,
  walletMul: number,
): number {
  return surge * walletMul;
}

// The locked pricing formula:
//   finalPriceSats = max(1, ceil(basePriceSats × surge × walletMultiplier))
// Returns at least 1 sat so MDK always has a chargeable invoice amount.
export function composeFinalPriceSats(
  basePriceSats: number,
  surge: number,
  walletMul: number,
): number {
  return Math.max(
    1,
    Math.ceil(basePriceSats * composeMultiplier(surge, walletMul)),
  );
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

// Per-wallet quote. Anonymous callers (wallet = null) collapse to base × surge.
// Reads reputation through getWallet so the locked Redis layout stays exclusive
// to reputation.ts — pricing never touches acrux:stake:* keys directly.
export async function currentPriceForWallet(
  wallet: string | null,
): Promise<WalletPriceQuote> {
  const base = await currentPrice();
  const state = wallet ? await getWallet(wallet) : null;

  const walletScore = state ? state.score : null;
  const walletMul = walletMultiplierForScore(walletScore);
  const finalPriceSats = composeFinalPriceSats(
    BASE_PRICE_SATS,
    surgeMultiplier(base.rps),
    walletMul,
  );

  return {
    ...base,
    wallet: wallet ?? null,
    walletScore,
    walletTier: state ? state.tier : null,
    walletMultiplier: walletMul,
    walletStakeSats: state ? state.stakeSats : null,
    finalPriceSats,
  };
}

export const pricingConfig = {
  basePriceSats: BASE_PRICE_SATS,
  maxMultiplier: MAX_MULTIPLIER,
  rpsWindowMs: RPS_WINDOW_MS,
} as const;
