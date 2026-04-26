# Demo: Dueling Bots

The demo proves the per-wallet pricing claim end-to-end: two bots, two different wallets, hitting the same paywalled endpoint, and only the bad one pays surge.

## What you'll see

1. **Honest agent** (`scripts/bots/honest-agent.py`) calls `/api/data` once every 2 seconds for 60 seconds, paying every L402 invoice promptly. Its reputation score climbs.
2. **Spam bot** (`scripts/bots/spam-bot.py`) hammers the same endpoint as fast as it can from a different wallet. Its per-wallet RPS climbs, the surge engine targets *its* wallet specifically, and the price for its next call escalates while the honest agent keeps paying ~1 sat.
3. **Operator slash** — a one-shot admin call demotes the spam bot's stake. The slashed sats land in the pool. The honest agent earns them at the next distribution.

The dashboard at `/dashboard` reflects all of this in real time (1Hz poll).

## Running it

Easiest path:

```bash
pnpm demo
```

This calls `scripts/bots/run-demo.py`, the orchestrator. It:

1. Sanity-checks `pnpm dev` is reachable.
2. Spawns the honest agent and the spam bot as subprocesses.
3. Tails their stdout in interleaved colors.
4. Hits `/api/stake/slash` against the spam bot's wallet at T+30s.
5. Shuts everything down at T+60s.

Open [`/dashboard`](http://localhost:3000/dashboard) in another window before launching to watch the price and slash log react live.

## Running the bots manually

If you want fine control:

```bash
# Terminal 1
python3 scripts/bots/honest-agent.py

# Terminal 2 (in parallel)
python3 scripts/bots/spam-bot.py

# Terminal 3 — slash the spam bot whenever
curl -X POST http://localhost:3000/api/stake/slash \
  -H "Authorization: Bearer $ACRUX_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"wallet":"<spam-bot-walletId>","sats":500,"reason":"abuse"}'
```

Each bot prints the wallet ID it's using on startup, so you'll know what to slash.

## What the dashboard tells you

Watch four widgets on `/dashboard`:

- **Price ticker** — the live `/api/price` response. Should stay near 1 sat for the honest wallet and climb sharply for the spam wallet.
- **Per-wallet RPS sparklines** — two distinct lines, one per wallet, diverging over time.
- **Top stakers** — leaderboard by reputation score. Honest agent rises, spam bot falls.
- **Slash log** — appends a row when you slash; the entry shows up within 1s.

## Why this matters

The demo is the smallest-possible counterexample to the claim "Stripe could do this with rate limits and chargebacks." Stripe physically cannot price one buyer differently from another on the same endpoint at sub-second latency without involving identity. Lightning + a per-wallet RPS counter does it in 30 lines of Redis code.

That's the whole pitch.
