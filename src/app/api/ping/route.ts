import { withPayment } from "@moneydevkit/nextjs/server";

export const runtime = "nodejs";

const PRICE_SATS = 1;

const handler = async () => {
  return Response.json({
    ok: true,
    service: "acrux",
    message: "pong",
    paid: PRICE_SATS,
    note: "this 200 was unlocked by a real Lightning payment via L402 (bLIP-26)",
    timestamp: new Date().toISOString(),
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
