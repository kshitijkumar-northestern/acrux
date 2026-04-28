import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "docs · acrux",
  description:
    "Programmable paywall for the agent economy. Per-load surge pricing, per-wallet attacker pricing, and reputation staking with slashing, all settled on Lightning.",
};

export default function DocsPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-20 sm:py-24 lg:px-8 lg:py-28">
      <div className="flex max-w-[760px] flex-col gap-10">
        <h1 className="text-pretty text-3xl leading-[1.15] tracking-[-0.04em] sm:text-4xl">
          A programmable paywall for the agent economy.
        </h1>

        <article className="flex flex-col gap-6 text-[15px] leading-[1.75] text-muted-foreground">
        <p>
          Millions of autonomous agents are coming online and they will all
          hammer the same APIs. Traditional defenses like IP rate limits,
          captchas, and edge bot filters assume a small number of
          identifiable callers, and fail against distributed swarms with
          rotating addresses. Charging for the API does not fix it either: a
          well-funded attacker just outspends your defense. Card rails carry
          a thirty-cent floor on a single charge and take days to settle, so
          they physically cannot price one request at one satoshi or hand a
          refund-proof discount to an honest agent in the next second. The
          agent economy needs a payment-native security and trust layer.
        </p>

        <p>
          The Wikimedia Foundation, which runs Wikipedia, is already living
          through the dress rehearsal. Since January 2024 its multimedia
          bandwidth has climbed{" "}
          <strong className="font-semibold text-foreground">50%</strong>,
          driven almost entirely by AI training scrapers rather than human
          readers, and{" "}
          <strong className="font-semibold text-foreground">65%</strong> of
          its most expensive datacenter requests now come from bots that
          account for only{" "}
          <strong className="font-semibold text-foreground">35%</strong> of
          pageviews. The crawlers ignore robots.txt, spoof user agents, and
          rotate residential IPs, so blocking them is an open-ended arms race
          that the foundation absorbs in dollars while the value of the
          scraped content accrues to the AI labs. A per-request paywall
          settled in sats would let Wikimedia keep humans free, charge
          commercial scrapers a fraction of a cent per file, and finally
          route the cost of training data to where the value lands.
        </p>

        <p>
          <strong className="font-semibold text-foreground">acrux</strong>{" "}
          puts that layer in front of any HTTP endpoint with a single
          middleware. Each request begins as a{" "}
          <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[13px] text-foreground">
            402 Payment Required
          </code>{" "}
          carrying a Lightning invoice over the L402 protocol. The price is
          computed live from a Redis-backed RPS sketch (one satoshi at idle,
          fifty when warm, ten thousand under attack) and then multiplied by
          a per-wallet score keyed off the L402 macaroon, so honest wallets
          stay at the base rate while a single bad actor absorbs the surge
          alone. Agents can also lock sats up front as a stake: behave and
          you accrue yield from a shared pool, misbehave and that stake is
          slashed, with the slashed sats routed straight back into the same
          yield pool. Attackers literally fund the salaries of the bots they
          are attacking.
        </p>

        <p>
          The shipped surface is small on purpose. The free, unauthenticated{" "}
          <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[13px] text-foreground">
            /api/price
          </code>{" "}
          quote returns the live multiplier, the load band, and the exact
          final price the next paid request would cost for your wallet, so
          clients can back off voluntarily before they get priced out. The
          paywalled{" "}
          <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[13px] text-foreground">
            /api/ping
          </code>{" "}
          is the smoke test: hit it once, take the invoice from the 402, pay
          it on signet, retry with the preimage, and you get a 200. Every
          settlement is real Lightning against a real node in milliseconds,
          with no signups, API keys, or chargebacks. The dashboard streams
          the same numbers the protocol is using, one request per second.
        </p>
        </article>
      </div>
    </div>
  );
}
