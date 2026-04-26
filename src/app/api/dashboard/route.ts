import { currentPriceForWallet, pricingConfig } from "@/lib/pricing";
import {
  getPool,
  getTotalStaked,
  listRecentSlashes,
  listTopStakers,
} from "@/lib/reputation";
import { isRedisConfigured } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOP_STAKERS_LIMIT = 10;
const RECENT_SLASHES_LIMIT = 20;

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

  // Fan-out the reads so the dashboard polls cheaply at 1Hz. The price quote
  // is anonymous (wallet=null) — the dashboard shows base × surge, individual
  // wallet pricing happens at /api/price?wallet=.
  try {
    const [price, pool, totalStaked, topStakers, recentSlashes] =
      await Promise.all([
        currentPriceForWallet(null),
        getPool(),
        getTotalStaked(),
        listTopStakers(TOP_STAKERS_LIMIT),
        listRecentSlashes(RECENT_SLASHES_LIMIT),
      ]);

    return Response.json({
      ok: true,
      price,
      stake: {
        pool,
        totalStaked,
      },
      topStakers,
      recentSlashes,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json(
      { ok: false, error: "dashboard_failed", message },
      { status: 500 },
    );
  }
}
