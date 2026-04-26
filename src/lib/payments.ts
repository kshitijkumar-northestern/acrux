import { getRedis } from "./redis";
import type { PaymentEvent } from "./types";

// Append-only stream of settled L402 payments. The dashboard tails this list
// so the demo shows real invoices flowing in as the bots run. Capped at
// PAYMENTS_CAP entries so the structure stays bounded under attack — anything
// older falls off the tail and only matters historically.
const K_PAYMENTS = "acrux:payments:recent";
const PAYMENTS_CAP = 50;

// Best-effort recorder. Caller passes the already-charged price + wallet
// context; we never recompute pricing here so /api/data, /api/search and
// /api/synth all surface identical event shapes. Failures are swallowed so a
// flaky Redis write never breaks the paid response the user already settled.
export async function recordPayment(event: PaymentEvent): Promise<void> {
  try {
    const redis = getRedis();
    await redis.lpush(K_PAYMENTS, JSON.stringify(event));
    await redis.ltrim(K_PAYMENTS, 0, PAYMENTS_CAP - 1);
  } catch {
    // Intentionally silent: payment already settled at MDK; the ledger entry
    // is observability, not correctness.
  }
}

export async function listRecentPayments(
  limit: number = 20,
): Promise<PaymentEvent[]> {
  const redis = getRedis();
  const items = await redis.lrange(K_PAYMENTS, 0, limit - 1);
  // Upstash auto-parses JSON-shaped strings on read, so a value we LPUSH'd as
  // JSON.stringify(event) comes back as the object. Tolerate both shapes.
  return items
    .map((it) => {
      if (it && typeof it === "object") return it as PaymentEvent;
      if (typeof it === "string") {
        try {
          return JSON.parse(it) as PaymentEvent;
        } catch {
          return null;
        }
      }
      return null;
    })
    .filter((e): e is PaymentEvent => e !== null);
}
