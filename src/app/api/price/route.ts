import { currentPrice, pricingConfig } from "@/lib/pricing";
import { isRedisConfigured } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
    const price = await currentPrice();
    return Response.json({
      ok: true,
      ...price,
      note: "Free quote. Live price changes with load. Pay-per-request via L402.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json(
      { ok: false, error: "pricing_failed", message },
      { status: 500 },
    );
  }
}
