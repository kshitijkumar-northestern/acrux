import { deposit } from "@/lib/reputation";
import { isRedisConfigured } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hard cap on a single demo deposit. Production should gate this behind a
// settled Lightning invoice rather than trusting the request body.
const MAX_DEPOSIT_SATS = 1_000_000_000;

export async function POST(req: Request) {
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

  const { wallet, sats } = (body ?? {}) as {
    wallet?: unknown;
    sats?: unknown;
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
  if (typeof sats !== "number" || !Number.isFinite(sats) || sats <= 0) {
    return Response.json(
      { ok: false, error: "invalid_sats" },
      { status: 400 },
    );
  }
  if (sats > MAX_DEPOSIT_SATS) {
    return Response.json(
      { ok: false, error: "exceeds_demo_cap", maxSats: MAX_DEPOSIT_SATS },
      { status: 400 },
    );
  }

  try {
    const state = await deposit(wallet, Math.floor(sats));
    return Response.json({
      ok: true,
      ...state,
      note: "Demo deposit. Production gates this on a settled Lightning invoice.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json(
      { ok: false, error: "deposit_failed", message },
      { status: 500 },
    );
  }
}
