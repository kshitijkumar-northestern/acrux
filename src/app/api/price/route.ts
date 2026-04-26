import { currentPriceForWallet, pricingConfig } from "@/lib/pricing";
import { isRedisConfigured } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WALLET_HEADER = "x-acrux-wallet";

// Header is canonical; ?wallet= is the fallback for cases where setting headers
// is awkward (browser GETs, demo curls). Header wins when both are present.
function resolveWallet(req: Request): string | null {
  const fromHeader = req.headers.get(WALLET_HEADER)?.trim();
  if (fromHeader) return fromHeader;
  const fromQuery = new URL(req.url).searchParams.get("wallet")?.trim();
  return fromQuery && fromQuery.length > 0 ? fromQuery : null;
}

export async function GET(req: Request) {
  if (!isRedisConfigured()) {
    return Response.json(
      {
        ok: false,
        error: "redis_not_configured",
        hint:
          "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local. " +
          "Free tier at https://upstash.com.",
        config: pricingConfig,
      },
      { status: 503 },
    );
  }

  try {
    const wallet = resolveWallet(req);
    const quote = await currentPriceForWallet(wallet);
    return Response.json(
      {
        ok: true,
        ...quote,
        note: "Free quote. Live price changes with load. Pay-per-request via L402.",
      },
      {
        headers: {
          "X-Acrux-Multiplier": String(quote.walletMultiplier),
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json(
      { ok: false, error: "pricing_failed", message },
      { status: 500 },
    );
  }
}
