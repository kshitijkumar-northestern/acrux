import { withPayment } from "@moneydevkit/nextjs/server";
import { currentPriceForWallet, recordRequest } from "@/lib/pricing";
import { bumpScore, getWallet, slash } from "@/lib/reputation";
import { SCORE_AUTO_SLASH, type SlashEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WALLET_HEADER = "x-acrux-wallet";

function readWallet(req: Request): string | null {
  const raw = req.headers.get(WALLET_HEADER);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Each challenge issuance counts toward the load it influences, so attackers
// spamming invoices raise the next attacker's price.
const dynamicAmount = async (req: Request): Promise<number> => {
  await recordRequest();
  const wallet = readWallet(req);
  const quote = await currentPriceForWallet(wallet);
  return quote.finalPriceSats;
};

const handler = async (req: Request) => {
  await recordRequest();
  const wallet = readWallet(req);
  const price = await currentPriceForWallet(wallet);

  // Reward the paid request. Anonymous callers (no X-Acrux-Wallet) skip the
  // ledger write entirely so we never invent a synthetic identity.
  let postState = wallet
    ? await bumpScore(wallet, 1, "paid_request")
    : null;

  // Auto-slash at the floor: 100% of stake → pool, then re-read state so the
  // response reflects the post-slash balance. Skip if there's no stake to
  // take so the call stays idempotent on already-slashed wallets.
  let slashEvent: SlashEvent | null = null;
  if (
    wallet &&
    postState &&
    postState.score <= SCORE_AUTO_SLASH &&
    postState.stakeSats > 0
  ) {
    const result = await slash(wallet, 1, "auto_floor_slash");
    slashEvent = result.event;
    postState = await getWallet(wallet);
  }

  return Response.json(
    {
      ok: true,
      service: "acrux",
      endpoint: "/api/data",
      paid: {
        sats: price.finalPriceSats,
        multiplier: price.multiplier,
        load: price.load,
        rps: price.rps,
        basePriceSats: price.basePriceSats,
        walletMultiplier: price.walletMultiplier,
      },
      wallet: wallet
        ? {
            wallet,
            score: postState?.score ?? price.walletScore,
            tier: postState?.tier ?? price.walletTier,
            stakeSats: postState?.stakeSats ?? price.walletStakeSats,
          }
        : null,
      slash: slashEvent,
      payload: {
        headline:
          "The agent economy is forming. Acrux is its immune system.",
        source:
          "acrux demo payload — swap for Tavily real-time search at Hour 3+",
        timestamp: new Date().toISOString(),
      },
      note:
        "this 200 was unlocked by a real Lightning payment via L402 (bLIP-26)",
    },
    {
      headers: {
        "X-Acrux-Multiplier": String(price.walletMultiplier),
      },
    },
  );
};

export const GET = withPayment(
  { amount: dynamicAmount, currency: "SAT" },
  handler,
);

export const POST = withPayment(
  { amount: dynamicAmount, currency: "SAT" },
  handler,
);
