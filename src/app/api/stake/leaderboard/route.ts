import { getTotalStaked, listTopStakers } from "@/lib/reputation";
import { isRedisConfigured } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

export async function GET(req: Request) {
  if (!isRedisConfigured()) {
    return Response.json(
      {
        ok: false,
        error: "redis_not_configured",
        hint:
          "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local.",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get("limit");
  const parsed = raw === null ? DEFAULT_LIMIT : Number.parseInt(raw, 10);
  const limit =
    Number.isFinite(parsed) && parsed > 0
      ? Math.min(parsed, MAX_LIMIT)
      : DEFAULT_LIMIT;

  try {
    const [stakers, totalStaked] = await Promise.all([
      listTopStakers(limit),
      getTotalStaked(),
    ]);
    return Response.json({
      ok: true,
      count: stakers.length,
      totalStaked,
      stakers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json(
      { ok: false, error: "leaderboard_failed", message },
      { status: 500 },
    );
  }
}
