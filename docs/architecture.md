# Architecture

acrux is a single Next.js 16 application. There is no separate gateway, queue, or background worker — everything runs as Vercel-edge-friendly route handlers on top of two pieces of state: Upstash Redis (RPS counters, reputation, payments) and a MoneyDevKit-managed Lightning wallet (invoices, settlements, payouts).

## Request flow

```
Honest agent A ─┐
                ├─> acrux shield (Next.js route handler)
Spam bot B ─────┘     │
                      ├─> Surge engine    (Upstash: per-wallet RPS counter)
                      ├─> Reputation map  (Upstash: wallet → score, stake)
                      ├─> Stake / slash   (MDK wallet + Upstash ledger)
                      └─> Forwards to:
                            ├─> Tavily search    (real-time web data)
                            └─> /api/data        (mock JSON fallback)
```

For every paid request:

1. **Identify the wallet.** L402 uses the macaroon's wallet identifier; for unauthenticated calls we fall back to a hashed IP bucket.
2. **Compute the price.** `priceFor(walletId)` reads the wallet's recent RPS from Redis, applies the surge curve, and returns sats.
3. **Issue or verify the invoice.**
   - If no `Authorization: L402 …` header → return **402** with a fresh MDK invoice + macaroon.
   - If header present and preimage valid → continue.
4. **Score the call.** A successful settlement bumps the wallet's reputation up; a failed/abandoned invoice (or admin-flagged abuse) decays it via `/api/stake/score`.
5. **Forward** to the upstream (Tavily for `/api/search`, mock for `/api/data`, etc.) and return the result.

## Redis schema (Upstash)

All keys are namespaced under `acrux:`.

| Key pattern | Type | Purpose |
|---|---|---|
| `acrux:rps:global` | sorted set | global request timestamps (last 60s) |
| `acrux:rps:{walletId}` | sorted set | per-wallet request timestamps |
| `acrux:rep:{walletId}` | hash | `{ score, stake, lastSeen }` |
| `acrux:rep:leaderboard` | sorted set | wallet → score, for `/api/stake/leaderboard` |
| `acrux:stake:pool` | string | total slashed sats waiting for distribution |
| `acrux:slash:log` | list | recent slash events `{ wallet, sats, reason, ts }` |
| `acrux:payments:recent` | list | last N settled L402 payments for the dashboard |

Sorted-set timestamps are pruned with `ZREMRANGEBYSCORE` on every read so the working set stays bounded without a separate cron.

## Surge curve

Implemented in `src/lib/surge.ts`. Pseudocode:

```ts
const baseRpsPerWallet = 0.5;          // generous floor
const knee = 5;                        // RPS where the curve starts biting
const max = ACRUX_MAX_SURGE_MULTIPLIER; // hard ceiling

function multiplier(walletRps: number) {
  if (walletRps <= baseRpsPerWallet) return 1;
  const x = (walletRps - baseRpsPerWallet) / knee;
  return Math.min(max, 1 + Math.pow(x, 2.2));
}
```

This is C1-continuous (no step functions), which means the price never jumps — useful when an honest burst happens to brush past the knee.

## Slashing

`/api/stake/slash` (admin-gated by `ACRUX_ADMIN_TOKEN`) decrements a wallet's stake and adds the delta to `acrux:stake:pool`. `/api/stake/distribute` periodically pays the pool out pro-rata to top-N wallets by reputation, using MDK's keysend.

## Frontend

- `/` — the landing page, SSR-seeds the live status panel from `getDashboardSnapshot()` so first paint shows real numbers (or a graceful offline notice) without a skeleton flash.
- `/dashboard` — the operator console. Server page renders an SSR'd snapshot, then a client component (`dashboard-live.tsx`) takes over and polls `/api/dashboard` at 1Hz.
- `/api/dashboard` — the single read-side aggregator. Returns surge price, pool size, RPS history, top stakers, slash log, recent payments, and a health probe (Redis ping + MDK configured-check).

## Deployment topology

```
acrux.pro (Vercel)
   │
   ├─> Upstash Redis        (managed, REST API)
   ├─> MoneyDevKit wallet   (signet/mutinynet by default)
   ├─> Tavily search API    (optional upstream for /api/search)
   └─> Cursor API           (optional upstream for /api/synth)
```

No queues, no workers, no Docker. The whole thing runs as Next.js route handlers on Vercel's edge runtime.
