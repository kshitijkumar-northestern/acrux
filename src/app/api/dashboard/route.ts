import { listRecentPayments } from "@/lib/payments";
import { currentPriceForWallet, pricingConfig } from "@/lib/pricing";
import {
  getPool,
  getTotalStaked,
  listRecentSlashes,
  listTopStakers,
} from "@/lib/reputation";
import { getRedis, isRedisConfigured } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOP_STAKERS_LIMIT = 10;
const RECENT_SLASHES_LIMIT = 20;
const RECENT_PAYMENTS_LIMIT = 20;

// Health probe: a single Redis PING, capped by a manual timeout so a slow
// Redis can never keep the dashboard from rendering. Upstash's REST client
// does not honor AbortSignal, so we race the call against a setTimeout.
// MDK is detected purely by env presence — MDK does not expose a synchronous
// health endpoint at this layer.
const REDIS_PROBE_TIMEOUT_MS = 750;

async function probeRedis(): Promise<{
  ok: boolean;
  latencyMs: number | null;
  error?: string;
}> {
  if (!isRedisConfigured()) {
    return { ok: false, latencyMs: null, error: "not_configured" };
  }
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race([
      getRedis().ping(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("redis_probe_timeout")),
          REDIS_PROBE_TIMEOUT_MS,
        );
      }),
    ]);
    return {
      ok: result === "PONG" || result === "pong" || Boolean(result),
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "unknown",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function probeMdk(): { configured: boolean } {
  return {
    configured: Boolean(
      process.env.MDK_ACCESS_TOKEN && process.env.MDK_MNEMONIC,
    ),
  };
}

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
  // wallet pricing happens at /api/price?wallet=. Health is probed in parallel
  // so a slow Redis surfaces as `health.redis.ok=false` without blocking.
  try {
    const [
      price,
      pool,
      totalStaked,
      topStakers,
      recentSlashes,
      recentPayments,
      redisHealth,
    ] = await Promise.all([
      currentPriceForWallet(null),
      getPool(),
      getTotalStaked(),
      listTopStakers(TOP_STAKERS_LIMIT),
      listRecentSlashes(RECENT_SLASHES_LIMIT),
      listRecentPayments(RECENT_PAYMENTS_LIMIT),
      probeRedis(),
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
      recentPayments,
      health: {
        redis: redisHealth,
        mdk: probeMdk(),
      },
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
