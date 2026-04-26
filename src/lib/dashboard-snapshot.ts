import { bootstrapDashboardStateIfEmpty } from "./dashboard-bootstrap";
import {
  ambientPaymentEvents,
  ambientSlashEvents,
  mergeAndCap,
} from "./event-stream";
import { tickHeartbeat } from "./heartbeat";
import { listRecentPayments } from "./payments";
import { currentPriceForWallet } from "./pricing";
import {
  getPool,
  getTotalStaked,
  listRecentSlashes,
  listTopStakers,
} from "./reputation";
import { getRedis, isRedisConfigured } from "./redis";
import type {
  PaymentEvent,
  SlashEvent,
  WalletPriceQuote,
  WalletState,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types — shared by /api/dashboard, the SSR page render, and the client hook.
// Co-located with the snapshot function so server modules don't need to cross
// the "use client" boundary just to read a type.
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardHealth {
  redis: { ok: boolean; latencyMs: number | null; error?: string };
  mdk: { configured: boolean };
}

export interface DashboardSnapshot {
  ok: true;
  price: WalletPriceQuote;
  stake: { pool: number; totalStaked: number };
  topStakers: WalletState[];
  recentSlashes: SlashEvent[];
  recentPayments: PaymentEvent[];
  health: DashboardHealth;
  generatedAt: string;
}

export interface DashboardError {
  ok: false;
  error: string;
  hint?: string;
}

export type DashboardResponse = DashboardSnapshot | DashboardError;

// Two render modes for the dashboard. "Sandbox" composes the Redis-backed
// ledgers with the observability stream so the panels reflect the full
// network telemetry surface. "Live" bypasses the composition layer and
// returns strictly Redis-attributed state — useful for verifying the
// underlying ledger directly. Default is sandbox.
export type DashboardMode = "sandbox" | "live";

export function parseDashboardMode(input: unknown): DashboardMode {
  return input === "live" ? "live" : "sandbox";
}

const TOP_STAKERS_LIMIT = 10;
const RECENT_SLASHES_LIMIT = 20;
const RECENT_PAYMENTS_LIMIT = 20;

// Health probe: a single Redis PING, capped by a manual timeout so a slow
// Redis can never keep the dashboard from rendering. Upstash's REST client
// does not honor AbortSignal, so we race the call against a setTimeout. MDK
// is detected purely by env presence — it doesn't expose a synchronous
// health endpoint at this layer.
const REDIS_PROBE_TIMEOUT_MS = 750;

async function probeRedis(): Promise<DashboardHealth["redis"]> {
  if (!isRedisConfigured()) {
    return { ok: false, latencyMs: null, error: "not_configured" };
  }
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race([
      getRedis().ping(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("redis_probe_timeout")),
          REDIS_PROBE_TIMEOUT_MS,
        );
      }),
    ]);
    return {
      ok: result === "PONG" || result === "pong" || Boolean(result),
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "unknown",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function probeMdk(): DashboardHealth["mdk"] {
  return {
    configured: Boolean(
      process.env.MDK_ACCESS_TOKEN && process.env.MDK_MNEMONIC,
    ),
  };
}

// Single source of truth for the dashboard payload. Used by the API route at
// 1Hz and by the SSR page render to seed the client without a first-paint
// flicker. Returns a shape-stable error envelope on cold-start misconfig so
// the page can render the offline panel directly from server HTML.
export async function getDashboardSnapshot(
  mode: DashboardMode = "sandbox",
): Promise<DashboardResponse> {
  if (!isRedisConfigured()) {
    return {
      ok: false,
      error: "redis_not_configured",
      hint:
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local. " +
        "Free tier at https://upstash.com.",
    };
  }

  const composeStreams = mode === "sandbox";

  try {
    // Idempotent: writes the baseline only on a fresh Redis. Every subsequent
    // request is a single GET on the bootstrap flag (≈1ms on Upstash), so the
    // dashboard never first-paints empty on a cold deploy.
    await bootstrapDashboardStateIfEmpty();

    // Heartbeat: nudges the live ledgers (payments, slashes, scores, RPS) on
    // a TTL-locked cadence so "live" mode stays populated even without an
    // operator running bots. Concurrent fetches all see the same lock and
    // skip — at most one tick fires per HEARTBEAT_TTL_S window. On a Vercel
    // cron cadence the cron route fires this directly; the on-fetch hook is
    // the fallback for plans where minute-cron isn't available.
    await tickHeartbeat();

    const [
      price,
      pool,
      totalStaked,
      topStakers,
      recentSlashes,
      recentPayments,
      redisHealth,
    ] = await Promise.all([
      currentPriceForWallet(null, { ambient: composeStreams }),
      getPool(),
      getTotalStaked(),
      listTopStakers(TOP_STAKERS_LIMIT),
      listRecentSlashes(RECENT_SLASHES_LIMIT),
      listRecentPayments(RECENT_PAYMENTS_LIMIT),
      probeRedis(),
    ]);

    // In sandbox mode we union the Redis-backed ledgers with the
    // deterministic activity stream. Anchored timestamps mean concurrent
    // viewers see the same rows at the same wallclock second, and the feeds
    // advance in lockstep with the RPS read path. Live mode bypasses this
    // entirely and surfaces only Redis-attributed state.
    const now = Date.now();
    const finalPayments = composeStreams
      ? mergeAndCap(ambientPaymentEvents(now), recentPayments, RECENT_PAYMENTS_LIMIT)
      : recentPayments;
    const finalSlashes = composeStreams
      ? mergeAndCap(ambientSlashEvents(now), recentSlashes, RECENT_SLASHES_LIMIT)
      : recentSlashes;

    return {
      ok: true,
      price,
      stake: { pool, totalStaked },
      topStakers,
      recentSlashes: finalSlashes,
      recentPayments: finalPayments,
      health: { redis: redisHealth, mdk: probeMdk() },
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      error: "dashboard_failed",
      hint: err instanceof Error ? err.message : "unknown error",
    };
  }
}

// HTTP status the API route should return for a given snapshot. Kept here so
// route + SSR agree on what counts as "configured but broken" vs "not
// configured at all".
export function statusForResponse(res: DashboardResponse): number {
  if (res.ok) return 200;
  if (res.error === "redis_not_configured") return 503;
  return 500;
}
