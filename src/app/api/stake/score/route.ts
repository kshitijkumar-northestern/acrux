import { requireAdmin } from "@/lib/admin-auth";
import { isRedisConfigured } from "@/lib/redis";
import { bumpScore } from "@/lib/reputation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_DELTA = -200;
const MAX_DELTA = 200;

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const { wallet, delta, reason } = (body ?? {}) as {
    wallet?: unknown;
    delta?: unknown;
    reason?: unknown;
  };

  if (
    typeof wallet !== "string" ||
    wallet.length === 0 ||
    wallet.length > 256
  ) {
    return Response.json(
      { ok: false, error: "invalid_wallet" },
      { status: 400 },
    );
  }
  if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
    return Response.json(
      { ok: false, error: "invalid_delta" },
      { status: 400 },
    );
  }
  if (delta < MIN_DELTA || delta > MAX_DELTA) {
    return Response.json(
      {
        ok: false,
        error: "delta_out_of_range",
        min: MIN_DELTA,
        max: MAX_DELTA,
      },
      { status: 400 },
    );
  }

  const reasonStr =
    typeof reason === "string" ? reason.slice(0, 128) : undefined;

  try {
    const state = await bumpScore(wallet, Math.trunc(delta), reasonStr);
    return Response.json({ ok: true, ...state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json(
      { ok: false, error: "score_bump_failed", message },
      { status: 500 },
    );
  }
}
