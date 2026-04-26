# API Reference

All routes are Next.js handlers under `src/app/api/`. The base URL is `https://acrux.pro` in production or `http://localhost:3000` in dev.

## Free routes

### `GET /api/price`

Returns the current per-wallet base price and the live global surge multiplier. Useful for clients that want to budget before paying.

```bash
$ curl http://localhost:3000/api/price
{
  "priceSats": 12,
  "baseSats": 1,
  "multiplier": 12.4,
  "rps": { "global": 47, "wallet": 0 },
  "ts": 1714112400000
}
```

No payment required.

### `GET /api/dashboard`

Read-side aggregator that powers `/dashboard`. Returns surge price, pool size, RPS history, top stakers, recent slashes, recent settled payments, and a health probe.

```bash
$ curl http://localhost:3000/api/dashboard | jq '.health'
{ "redis": "ok", "mdk": "configured" }
```

This is the single endpoint the dashboard polls at 1Hz. The landing page also SSR-seeds from it once on first paint.

### `GET /api/stake/leaderboard`

Top-N wallets by reputation score, with current stake amount.

### `GET /api/stake/[wallet]`

Per-wallet view: score, stake, last seen.

### `GET /api/stake/slashlog`

Recent slash events for the dashboard's slash log table.

## Paid (L402) routes

All paid routes follow the L402 spec. First call returns **402 Payment Required** with a Lightning invoice in `WWW-Authenticate`; resend with `Authorization: L402 <macaroon>:<preimage>` to get the response.

### `GET /api/ping`

The simplest paywall — pay 1 sat (at base load), receive `pong`. Use this to verify your client's L402 flow works.

```bash
$ curl -i http://localhost:3000/api/ping
HTTP/1.1 402 Payment Required
WWW-Authenticate: L402 macaroon="...", invoice="lnbc..."
```

### `GET /api/data`

Returns a small JSON payload. Same paywall as `/api/ping` but priced dynamically — the surge multiplier from `/api/price` applies. Good demo target for showing prices change under load.

### `GET /api/search?q=…`

Paywalled proxy to [Tavily](https://tavily.com). Requires `TAVILY_API_KEY` in env. Demonstrates an upstream that costs *us* real money per call, hence the paywall.

### `GET /api/synth?prompt=…`

Paywalled proxy to a Cursor LLM endpoint. Optional, requires `CURSOR_API_KEY`.

## Admin routes (gated by `ACRUX_ADMIN_TOKEN`)

All require `Authorization: Bearer $ACRUX_ADMIN_TOKEN`.

### `POST /api/stake/deposit`

```json
{ "wallet": "<walletId>", "sats": 1000 }
```

Records a stake deposit (paid via Lightning out-of-band; this just credits it in Redis).

### `POST /api/stake/score`

```json
{ "wallet": "<walletId>", "delta": 1 }
```

Adjusts a wallet's reputation by `delta`. Used by the honest-agent loop to record clean behavior.

### `POST /api/stake/slash`

```json
{ "wallet": "<walletId>", "sats": 100, "reason": "abuse" }
```

Decrements stake, increments the slash pool, appends to the slash log.

### `POST /api/stake/distribute`

Pays the slash pool out pro-rata to the top-N wallets by reputation. Uses MDK keysend.

## MoneyDevKit pass-through

### `* /api/mdk/*`

Mounted by `@moneydevkit/nextjs`. Handles the wallet's invoice generation, settlement webhooks, and macaroon verification. You generally won't call this directly.

## Status codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 402 | Payment Required (L402, expected first response on paid routes) |
| 401 | Bad/missing macaroon on a paid route, or missing admin token |
| 429 | Per-wallet RPS hard ceiling exceeded (very rare; surge usually handles it) |
| 500 | Redis or MDK unreachable; check `/api/dashboard` health field |
