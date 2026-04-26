import { withPayment } from "@moneydevkit/nextjs/server";
import { recordPayment } from "@/lib/payments";
import { currentPriceForWallet, recordRequest } from "@/lib/pricing";
import { isRedisConfigured } from "@/lib/redis";
import { bumpScore, getWallet, slash } from "@/lib/reputation";
import { SCORE_AUTO_SLASH, type SlashEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WALLET_HEADER = "x-acrux-wallet";
const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const TAVILY_MAX_RESULTS = 5;
const TAVILY_TIMEOUT_MS = 12_000;

function readWallet(req: Request): string | null {
  const raw = req.headers.get(WALLET_HEADER);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Issuing the invoice is itself load — count it so a flood of paywall hits
// drives the next attacker's price up before they've even paid.
const dynamicAmount = async (req: Request): Promise<number> => {
  if (!isRedisConfigured()) {
    throw new Error("redis_not_configured");
  }
  await recordRequest();
  const wallet = readWallet(req);
  const quote = await currentPriceForWallet(wallet);
  return quote.finalPriceSats;
};

async function callTavily(
  apiKey: string,
  query: string,
): Promise<
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string; body?: string }
> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TAVILY_TIMEOUT_MS);
  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: TAVILY_MAX_RESULTS,
      }),
      signal: ac.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: "tavily_failed", body };
    }
    const data = (await res.json()) as unknown;
    return { ok: true, data };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 502,
      error: aborted ? "tavily_timeout" : "tavily_unreachable",
      body: err instanceof Error ? err.message : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

const handler = async (req: Request) => {
  if (!isRedisConfigured()) {
    return Response.json(
      {
        ok: false,
        error: "redis_not_configured",
        hint:
          "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local. " +
          "Free tier at https://upstash.com.",
      },
      { status: 503 },
    );
  }

  try {
    await recordRequest();
    const wallet = readWallet(req);
    const price = await currentPriceForWallet(wallet);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { ok: false, error: "invalid_json" },
        { status: 400 },
      );
    }
    const query =
      body && typeof body === "object" && "q" in body
        ? String((body as { q: unknown }).q ?? "").trim()
        : "";
    if (!query) {
      return Response.json(
        { ok: false, error: "missing_q", hint: "POST { q: string }" },
        { status: 400 },
      );
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return Response.json(
        {
          ok: false,
          error: "tavily_not_configured",
          hint: "Set TAVILY_API_KEY in .env.local. Free tier at https://tavily.com.",
        },
        { status: 503 },
      );
    }

    const tav = await callTavily(apiKey, query);
    if (!tav.ok) {
      return Response.json(
        { ok: false, error: tav.error, status: tav.status, body: tav.body },
        { status: tav.status },
      );
    }

    // Reward the paid request. Anonymous callers (no X-Acrux-Wallet) skip the
    // ledger write entirely so we never invent a synthetic identity.
    let postState = wallet
      ? await bumpScore(wallet, 1, "paid_request")
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

    void recordPayment({
      wallet,
      endpoint: "/api/search",
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
        endpoint: "/api/search",
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
            }
          : null,
        slash: slashEvent,
        payload: {
          provider: "tavily",
          query,
          results: tav.data,
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
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json(
      { ok: false, error: "search_failed", message },
      { status: 500 },
    );
  }
};

export const POST = withPayment(
  { amount: dynamicAmount, currency: "SAT" },
  handler,
);
