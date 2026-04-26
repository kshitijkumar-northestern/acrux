import { withPayment } from "@moneydevkit/nextjs/server";
import { recordPayment } from "@/lib/payments";
import {
  currentPriceForWallet,
  currentWalletRps,
  recordRequest,
  recordWalletRequest,
} from "@/lib/pricing";
import { isRedisConfigured } from "@/lib/redis";
import { bumpScore, getWallet, slash } from "@/lib/reputation";
import { SCORE_AUTO_SLASH, type SlashEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WALLET_HEADER = "x-acrux-wallet";

const REDIS_NOT_CONFIGURED = Response.json(
  {
    ok: false,
    error: "redis_not_configured",
    hint:
      "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local. " +
      "Free tier at https://upstash.com.",
  },
  { status: 503 },
);

function fail(status: number, error: string, message?: unknown): Response {
  return Response.json(
    {
      ok: false,
      error,
      message:
        message instanceof Error
          ? message.message
          : typeof message === "string"
            ? message
            : undefined,
    },
    { status },
  );
}

// Per-wallet RPS abuse thresholds (env-overridable for live demo tuning).
//   ABUSE_RPS    — sustained req/s from a single wallet that flips us into
//                  decay mode. 5 covers normal bursty agents.
//   ABUSE_DECAY  — score points removed per abusive request. -10 per call
//                  reaches the SCORE_AUTO_SLASH floor (-100) in ~10 hits,
//                  visible on the demo dashboard but not one-burst hostile.
const ABUSE_RPS = Math.max(
  1,
  Number.parseInt(process.env.ACRUX_ABUSE_RPS ?? "5", 10) || 5,
);
const ABUSE_DECAY = Math.max(
  1,
  Number.parseInt(process.env.ACRUX_ABUSE_DECAY ?? "10", 10) || 10,
);

function readWallet(req: Request): string | null {
  const raw = req.headers.get(WALLET_HEADER);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Each challenge issuance counts toward the load it influences, so attackers
// spamming invoices raise the next attacker's price. Both global and
// per-wallet sketches are written so the abuse detector sees invoice spam too.
const dynamicAmount = async (req: Request): Promise<number> => {
  if (!isRedisConfigured()) {
    // MDK rejects non-numeric returns; throw and let withPayment surface 5xx.
    throw new Error("redis_not_configured");
  }
  await recordRequest();
  const wallet = readWallet(req);
  if (wallet) await recordWalletRequest(wallet);
  const quote = await currentPriceForWallet(wallet);
  return quote.finalPriceSats;
};

const handler = async (req: Request) => {
  if (!isRedisConfigured()) return REDIS_NOT_CONFIGURED;

  try {
    await recordRequest();
    const wallet = readWallet(req);
    if (wallet) await recordWalletRequest(wallet);
    const price = await currentPriceForWallet(wallet);

    // Detect per-wallet abuse before writing score: a single wallet exceeding
    // ABUSE_RPS in the 1s window flips this request into decay mode instead of
    // the +1 reward. Anonymous callers can't be attributed and skip both paths.
    const walletRps = wallet ? await currentWalletRps(wallet) : 0;
    const abusive = wallet !== null && walletRps > ABUSE_RPS;

    // Reward (+1) or decay (-N) the paid request. Anonymous callers skip the
    // ledger write entirely so we never invent a synthetic identity.
    let postState = wallet
      ? await bumpScore(
          wallet,
          abusive ? -ABUSE_DECAY : 1,
          abusive ? "wallet_rps_abuse" : "paid_request",
        )
      : null;

    // Auto-slash at the floor: 100% of stake → pool, then re-read state so the
    // response reflects the post-slash balance. Skip if there's no stake to
    // take so the call stays idempotent on already-slashed wallets.
    let slashEvent: SlashEvent | null = null;
    if (
      wallet &&
      postState &&
      postState.score <= SCORE_AUTO_SLASH &&
      postState.stakeSats > 0
    ) {
      const result = await slash(wallet, 1, "auto_floor_slash");
      slashEvent = result.event;
      postState = await getWallet(wallet);
    }

    // Best-effort ledger entry — never blocks or fails the paid response.
    void recordPayment({
      wallet,
      endpoint: "/api/data",
      sats: price.finalPriceSats,
      multiplier: Math.round(price.multiplier * 100) / 100,
      walletMultiplier: price.walletMultiplier,
      load: price.load,
      tier: postState?.tier ?? price.walletTier,
      at: new Date().toISOString(),
    });

    return Response.json(
      {
        ok: true,
        service: "acrux",
        endpoint: "/api/data",
        paid: {
          sats: price.finalPriceSats,
          multiplier: price.multiplier,
          load: price.load,
          rps: price.rps,
          basePriceSats: price.basePriceSats,
          walletMultiplier: price.walletMultiplier,
        },
        wallet: wallet
          ? {
              wallet,
              score: postState?.score ?? price.walletScore,
              tier: postState?.tier ?? price.walletTier,
              stakeSats: postState?.stakeSats ?? price.walletStakeSats,
              rps: walletRps,
              abusive,
            }
          : null,
        slash: slashEvent,
        payload: {
          headline:
            "The agent economy is forming. acrux is the paywall layer.",
          source:
            "acrux demo payload · swap for Tavily real-time search at Hour 3+",
          timestamp: new Date().toISOString(),
        },
        note:
          "this 200 was unlocked by a real Lightning payment via L402 (bLIP-26)",
      },
      {
        headers: {
          "X-Acrux-Multiplier": String(price.walletMultiplier),
        },
      },
    );
  } catch (err) {
    return fail(500, "data_failed", err);
  }
};

export const GET = withPayment(
  { amount: dynamicAmount, currency: "SAT" },
  handler,
);

export const POST = withPayment(
  { amount: dynamicAmount, currency: "SAT" },
  handler,
);
