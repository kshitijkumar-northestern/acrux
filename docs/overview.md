# Overview and Primitives

acrux is a Next.js middleware that turns any HTTP route into a Lightning-paywalled, attack-priced, reputation-aware endpoint. It exists because the agent economy has a problem traditional payment rails physically cannot solve: when bots spend money, you can't price-discriminate per buyer, and chargebacks don't exist as a defense.

acrux replaces all three classical defenses (rate limits, API keys, captchas) with one Lightning rail and three economic primitives.

## The three primitives

### 1. Per-load surge pricing

Server load goes up → the Lightning invoice price goes up automatically. The price isn't a static `$0.001 per call`. It's a continuous function of measured RPS:

- 1 sat at idle
- ~10 sats under normal load
- up to 10,000 sats during a detected attack (configurable via `ACRUX_MAX_SURGE_MULTIPLIER`)

Honest users barely notice. Attackers price themselves out.

### 2. Per-wallet attacker pricing

This is the part Stripe can't do. acrux doesn't price the route — it prices the **paying wallet**. Each wallet has its own RPS counter in Redis. One bad actor hammering an endpoint will see surge prices targeted at *its* wallet, while every other wallet keeps paying base rate.

The result: a single attacker can't poison the price for honest agents. Their own behavior is what makes their next call expensive.

### 3. Reputation staking with slashing

Agents stake sats up front via `/api/stake/deposit`. Behave well → earn yield from a shared pool. Misbehave → stake gets slashed and added to that pool.

The yield pool pays the honest agents. **Attackers literally fund the salaries of the bots they attack.**

This is the piece that turns the paywall from a defense into an economy.

## Why Lightning, not Stripe / API keys

| Capability | Stripe | API keys | acrux |
|---|---|---|---|
| Sub-cent prices | No (1¢ floor) | N/A | Yes (1 sat ≈ $0.0003) |
| Settlement latency | ~2 days | N/A | ~ms |
| Chargeback risk | Yes | N/A | No |
| Per-buyer dynamic pricing | No | No | Yes |
| Identity required | Yes | Yes | No |
| Programmable slashing | No | No | Yes |

acrux uses [MoneyDevKit](https://moneydevkit.com)'s L402 implementation for the Lightning rail. Out of the box it runs on signet (mutinynet); flip a flag in MDK to go to mainnet.

## What this repo contains

- `/api/*` — paywalled and free Lightning endpoints (Next.js route handlers)
- `src/lib/` — surge-engine math, reputation ledger, dashboard snapshot
- `src/components/dashboard/` — live operator console (1Hz Redis poll)
- `scripts/bots/` — honest agent + spam bot + orchestrator for the demo
- `docs/` — what you're reading

See [Architecture](architecture.md) for the request flow and Redis schema.
