import { withPayment } from "@moneydevkit/nextjs/server";
import { currentPriceForWallet, recordRequest } from "@/lib/pricing";
import { bumpScore, getWallet, slash } from "@/lib/reputation";
import { SCORE_AUTO_SLASH, type SlashEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WALLET_HEADER = "x-acrux-wallet";
const CURSOR_DEFAULT_ENDPOINT = "https://api.cursor.sh/v1/chat/completions";
const CURSOR_DEFAULT_MODEL = "cursor-small";

function readWallet(req: Request): string | null {
  const raw = req.headers.get(WALLET_HEADER);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const dynamicAmount = async (req: Request): Promise<number> => {
  await recordRequest();
  const wallet = readWallet(req);
  const quote = await currentPriceForWallet(wallet);
  return quote.finalPriceSats;
};

const handler = async (req: Request) => {
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
      { ok: false, error: "cursor_not_configured" },
      { status: 503 },
    );
  }
  const endpoint = process.env.CURSOR_API_URL ?? CURSOR_DEFAULT_ENDPOINT;

  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return Response.json(
      {
        ok: false,
        error: "cursor_failed",
        status: upstream.status,
        body: text,
      },
      { status: 502 },
    );
  }
  const data = (await upstream.json()) as unknown;

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
        completion: data,
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
};

export const POST = withPayment(
  { amount: dynamicAmount, currency: "SAT" },
  handler,
);
