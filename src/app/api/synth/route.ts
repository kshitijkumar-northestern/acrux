import { withPayment } from "@moneydevkit/nextjs/server";
import { recordPayment } from "@/lib/payments";
import { currentPriceForWallet, recordRequest } from "@/lib/pricing";
import { isRedisConfigured } from "@/lib/redis";
import { bumpScore, getWallet, slash } from "@/lib/reputation";
import { SCORE_AUTO_SLASH, type SlashEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WALLET_HEADER = "x-acrux-wallet";
const CURSOR_DEFAULT_ENDPOINT = "https://api.cursor.sh/v1/chat/completions";
const CURSOR_DEFAULT_MODEL = "cursor-small";
const CURSOR_TIMEOUT_MS = 20_000;

function readWallet(req: Request): string | null {
  const raw = req.headers.get(WALLET_HEADER);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const dynamicAmount = async (req: Request): Promise<number> => {
  if (!isRedisConfigured()) {
    throw new Error("redis_not_configured");
  }
  await recordRequest();
  const wallet = readWallet(req);
  const quote = await currentPriceForWallet(wallet);
  return quote.finalPriceSats;
};

async function callCursor(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string,
): Promise<
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string; body?: string }
> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CURSOR_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: ac.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: "cursor_failed", body };
    }
    const data = (await res.json()) as unknown;
    return { ok: true, data };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 502,
      error: aborted ? "cursor_timeout" : "cursor_unreachable",
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
    const prompt =
      body && typeof body === "object" && "prompt" in body
        ? String((body as { prompt: unknown }).prompt ?? "").trim()
        : "";
    if (!prompt) {
      return Response.json(
        {
          ok: false,
          error: "missing_prompt",
          hint: "POST { prompt: string, model?: string }",
        },
        { status: 400 },
      );
    }
    const model =
      body && typeof body === "object" && "model" in body
        ? String((body as { model: unknown }).model ?? "").trim() ||
          CURSOR_DEFAULT_MODEL
        : CURSOR_DEFAULT_MODEL;

    const apiKey = process.env.CURSOR_API_KEY;
    if (!apiKey) {
      return Response.json(
        {
          ok: false,
          error: "cursor_not_configured",
          hint: "Set CURSOR_API_KEY in .env.local.",
        },
        { status: 503 },
      );
    }
    const endpoint = process.env.CURSOR_API_URL ?? CURSOR_DEFAULT_ENDPOINT;

    const upstream = await callCursor(endpoint, apiKey, model, prompt);
    if (!upstream.ok) {
      return Response.json(
        {
          ok: false,
          error: upstream.error,
          status: upstream.status,
          body: upstream.body,
        },
        { status: upstream.status },
      );
    }

    let postState = wallet
      ? await bumpScore(wallet, 1, "paid_request")
      : null;

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
      endpoint: "/api/synth",
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
        endpoint: "/api/synth",
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
          provider: "cursor",
          model,
          prompt,
          completion: upstream.data,
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
      { ok: false, error: "synth_failed", message },
      { status: 500 },
    );
  }
};

export const POST = withPayment(
  { amount: dynamicAmount, currency: "SAT" },
  handler,
);
