# Quickstart

Run acrux locally in under 5 minutes. You will need [pnpm](https://pnpm.io), Node 20+, and Python 3.11+ (only for the demo bots).

## 1. Clone and install

```bash
git clone https://github.com/kshitijkumar-northestern/acrux.git
cd acrux
pnpm install
```

## 2. Generate a Lightning wallet

acrux uses [MoneyDevKit](https://moneydevkit.com) for the Lightning rail. The CLI generates a signet/mutinynet wallet — no real funds, no KYC.

```bash
npx @moneydevkit/create
```

Copy the printed `MDK_ACCESS_TOKEN` and `MDK_MNEMONIC` into `.env.local` (next step).

## 3. Provision Redis

Create a free Redis DB at [upstash.com](https://upstash.com). Hobby tier is plenty.

Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` into `.env.local`.

## 4. Configure environment

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

```bash
# Lightning rail
MDK_ACCESS_TOKEN=...
MDK_MNEMONIC="..."

# State
UPSTASH_REDIS_REST_URL=https://<region>.upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Optional upstreams
TAVILY_API_KEY=...
CURSOR_API_KEY=...

# Pricing knobs (defaults shown)
ACRUX_BASE_PRICE_SATS=1
ACRUX_MAX_SURGE_MULTIPLIER=10000
ACRUX_MIN_STAKE_SATS=1000

# Admin token for /api/stake/{score,slash,distribute}
ACRUX_ADMIN_TOKEN=<a long random string>
```

Run `pnpm check-env` to verify nothing's missing before starting the server.

## 5. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page, or [http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the live operator console.

## 6. (Optional) Run the dueling-bots demo

```bash
pnpm demo
```

This runs the orchestrator in `scripts/bots/run-demo.py`, which spins up one honest agent and one spam bot against your local server, then watches the dashboard react. See [Demo](demo.md) for what to expect.

## Common issues

- **`acrux: missing Upstash credentials` at boot** — `.env.local` is not being read. Make sure the file is at the repo root and you restarted `pnpm dev`.
- **`/api/ping` always returns 500 instead of 402** — usually means MDK couldn't initialize. Check `MDK_ACCESS_TOKEN` and re-run `pnpm check-env`.
- **Dashboard shows "offline"** — Redis is unreachable. Check the Upstash URL/token. The dashboard fails open (renders an offline notice) rather than crashing the page.

For the full endpoint surface and how to call each one, see the [API Reference](api.md).
