import { withPayment } from "@moneydevkit/nextjs/server";
import { currentPrice, recordRequest } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Each challenge issuance counts toward the load it influences, so attackers
// spamming invoices raise the next attacker's price.
const dynamicAmount = async (): Promise<number> => {
  await recordRequest();
  const { priceSats } = await currentPrice();
  return priceSats;
};

const handler = async () => {
  await recordRequest();
  const price = await currentPrice();
  return Response.json({
    ok: true,
    service: "acrux",
    endpoint: "/api/data",
    paid: {
      sats: price.priceSats,
      multiplier: price.multiplier,
      load: price.load,
      rps: price.rps,
      basePriceSats: price.basePriceSats,
    },
    payload: {
      headline:
        "The agent economy is forming. Acrux is its immune system.",
      source:
        "acrux demo payload — swap for Tavily real-time search at Hour 3+",
      timestamp: new Date().toISOString(),
    },
    note:
      "this 200 was unlocked by a real Lightning payment via L402 (bLIP-26)",
  });
};

export const GET = withPayment(
  { amount: dynamicAmount, currency: "SAT" },
  handler,
);

export const POST = withPayment(
  { amount: dynamicAmount, currency: "SAT" },
  handler,
);
