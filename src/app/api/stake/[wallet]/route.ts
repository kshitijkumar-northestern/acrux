import { getWallet } from "@/lib/reputation";
import { isRedisConfigured } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Static siblings (deposit, leaderboard, slashlog) take precedence in
// Next.js routing. A wallet literally named "deposit" would be shadowed —
// acceptable for the demo; production should namespace under /wallet/[wallet].
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
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

  const { wallet } = await params;
  if (!wallet || wallet.length > 256) {
    return Response.json(
      { ok: false, error: "invalid_wallet" },
      { status: 400 },
    );
  }

  try {
    const state = await getWallet(wallet);
    return Response.json({ ok: true, ...state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json(
      { ok: false, error: "stake_lookup_failed", message },
      { status: 500 },
    );
  }
}
