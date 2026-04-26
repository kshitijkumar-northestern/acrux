import { withPayment } from "@moneydevkit/nextjs/server";
import { recordPayment } from "@/lib/payments";

export const runtime = "nodejs";

const PRICE_SATS = 1;
const WALLET_HEADER = "x-acrux-wallet";

const handler = async (req: Request) => {
  const at = new Date().toISOString();
  const wallet = req.headers.get(WALLET_HEADER)?.trim() || null;
  // Best-effort — recordPayment swallows Redis errors so /api/ping stays
  // dependency-free for the simplest L402 smoke test.
  void recordPayment({
    wallet,
    endpoint: "/api/ping",
    sats: PRICE_SATS,
    multiplier: 1,
    walletMultiplier: 1,
    load: "idle",
    tier: null,
    at,
  });
  return Response.json({
    ok: true,
    service: "acrux",
    message: "pong",
    paid: PRICE_SATS,
    note: "this 200 was unlocked by a real Lightning payment via L402 (bLIP-26)",
    timestamp: at,
  });
};

export const GET = withPayment(
  { amount: PRICE_SATS, currency: "SAT" },
  handler,
);

export const POST = withPayment(
  { amount: PRICE_SATS, currency: "SAT" },
  handler,
);
