import { requireAdmin } from "@/lib/admin-auth";
import { isRedisConfigured } from "@/lib/redis";
import { distributeYield } from "@/lib/reputation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-shot payout that drains the slash pool pro-rata to trusted-tier
// stakers. Idempotent in the sense that calling it twice in a row when the
// pool is empty is a no-op.
export async function POST(req: Request) {
  const fail = requireAdmin(req);
  if (fail) return fail;

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

  try {
    const summary = await distributeYield();
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json(
      { ok: false, error: "distribute_failed", message },
      { status: 500 },
    );
  }
}
