# Deployment

acrux is a stock Next.js 16 app with no native dependencies, no background workers, and no container — it deploys cleanly to Vercel out of the box. This page covers the production setup that powers `acrux.pro`.

## One-time setup

### 1. Import the GitHub repo into Vercel

[vercel.com/new](https://vercel.com/new) → Import `kshitijkumar-northestern/acrux` → branch `main` → preset `Next.js`.

### 2. Set environment variables

Before clicking **Deploy**, expand the **Environment Variables** section and paste in every key from your `.env.local` (Vercel auto-splits the dotenv format if you paste the whole file into the first KEY field):

```
MDK_ACCESS_TOKEN
MDK_MNEMONIC
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
TAVILY_API_KEY
ACRUX_BASE_PRICE_SATS
ACRUX_MAX_SURGE_MULTIPLIER
ACRUX_MIN_STAKE_SATS
ACRUX_ADMIN_TOKEN
CURSOR_API_KEY        # optional
```

For a hackathon demo, the same Upstash DB and MDK wallet you use locally is fine. For a real production deploy, generate a fresh MDK wallet on mainnet and a fresh Upstash DB.

### 3. Deploy

Click **Deploy**. First build takes ~60–90s. Successive pushes to `main` auto-deploy.

## Custom domain (`acrux.pro`)

In the Vercel project → **Settings** → **Domains** → **Add** → `acrux.pro`. Vercel will show you DNS records:

- `A` record on `@` → `76.76.21.21`
- `CNAME` on `www` → `cname.vercel-dns.com`

Add those at your DNS provider. Vercel issues a Let's Encrypt cert automatically once propagation completes (usually < 5 minutes on Cloudflare or Namecheap).

## Verifying the deploy

Hit four endpoints. All four should be green:

```bash
# 1. Free price quote
curl https://acrux.pro/api/price
# expect: { priceSats, multiplier, rps, ts }

# 2. Health probe
curl https://acrux.pro/api/dashboard | jq '.health'
# expect: { redis: "ok", mdk: "configured" }

# 3. L402 paywall
curl -i https://acrux.pro/api/ping
# expect: HTTP/1.1 402 Payment Required
#         WWW-Authenticate: L402 macaroon="...", invoice="lnbc..."

# 4. Dashboard render
curl -s https://acrux.pro/dashboard | grep -o 'live metrics' || echo "MISSING"
# expect: live metrics
```

If any of these fail, the most common cause is an env var that didn't make it to Vercel. The dashboard's health probe (`/api/dashboard` → `health`) will tell you which subsystem is unreachable.

## Edge runtime notes

All API routes use Vercel's serverless runtime, not edge — Upstash's REST client and `@moneydevkit/nextjs` rely on Node APIs. This is set per-route via `export const runtime = "nodejs"` where needed.

Cold starts on the first request after idle are ~200ms. Warm requests are <50ms.

## Monitoring

Vercel's built-in observability covers everything we need for the demo: request logs, error rate, p95 latency. The dashboard's NetworkStatus widget is a self-monitoring health check that catches Redis or MDK going down before any request fails.

For longer-term operation, point the Upstash and MDK dashboards at the same project and set up email alerts on Redis hit-rate < 50% (signal of a regional outage) and MDK wallet balance < your minimum payout threshold.

## Rolling back

```bash
git revert <bad-sha>
git push origin main
```

Vercel auto-deploys the revert. Or use the Vercel UI's "Promote to Production" on a previous deployment for a zero-build rollback.
