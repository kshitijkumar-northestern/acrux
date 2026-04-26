// Locked contracts shared across pricing, reputation, and the data plane.
// Append-only. Mutating an existing field requires a PR review (see
// docs/private/TEAM-PLAN.md §"Locked contracts").

export type Tier = "trusted" | "neutral" | "suspicious" | "abusive";

export type LoadBand = "idle" | "light" | "hot" | "attack";

export const SCORE_MIN = -100;
export const SCORE_MAX = 100;

// Score floor that triggers a 100% auto-slash on the next paid request.
export const SCORE_AUTO_SLASH = -100;

export interface WalletState {
  wallet: string;
  stakeSats: number;
  score: number; // SCORE_MIN … SCORE_MAX
  yieldSats: number;
  tier: Tier;
}

export interface SlashEvent {
  wallet: string;
  slashedSats: number;
  reason: string;
  remainingStake: number;
  at: string; // ISO 8601
}

export interface PriceQuote {
  basePriceSats: number;
  rps: number;
  multiplier: number; // surge multiplier from the load curve
  priceSats: number; // basePriceSats × surge, no wallet adjustment
  load: LoadBand;
  maxMultiplier: number;
  quotedAt: string; // ISO 8601
}

export interface WalletPriceQuote extends PriceQuote {
  wallet: string | null;
  walletScore: number | null;
  walletTier: Tier | null;
  walletMultiplier: number; // 0.5 / 1 / 2 / 10
  walletStakeSats: number | null;
  finalPriceSats: number; // basePriceSats × surge × walletMultiplier — what we charge
}
