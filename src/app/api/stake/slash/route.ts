import { requireAdmin } from "@/lib/admin-auth";
import { isRedisConfigured } from "@/lib/redis";
import { slash } from "@/lib/reputation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const { wallet, fraction, reason } = (body ?? {}) as {
    wallet?: unknown;
    fraction?: unknown;
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
  if (
    typeof fraction !== "number" ||
    !Number.isFinite(fraction) ||
    fraction <= 0 ||
    fraction > 1
  ) {
    return Response.json(
      { ok: false, error: "invalid_fraction" },
      { status: 400 },
    );
  }

  const reasonStr =
    typeof reason === "string" ? reason.slice(0, 128) : "manual";

  try {
    const { state, event } = await slash(wallet, fraction, reasonStr);
    return Response.json({ ok: true, state, event });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json(
      { ok: false, error: "slash_failed", message },
      { status: 500 },
    );
  }
}
