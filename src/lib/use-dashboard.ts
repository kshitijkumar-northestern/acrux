"use client";

import { useEffect, useRef, useState } from "react";
import type {
  DashboardError,
  DashboardHealth,
  DashboardResponse,
  DashboardSnapshot,
} from "./dashboard-snapshot";

export type {
  DashboardError,
  DashboardHealth,
  DashboardResponse,
  DashboardSnapshot,
};

export interface UseDashboardResult {
  data: DashboardSnapshot | null;
  error: DashboardError | null;
  status: "idle" | "loading" | "live" | "error";
  lastUpdated: number | null;
}

const DEFAULT_INTERVAL_MS = 1000;
// Polling cadence for sticky errors that won't recover without operator
// intervention (e.g. missing env keys). We still poll so a `.env.local` edit
// is picked up within a tab refresh, but we don't hammer the API or churn the
// UI every second with an identical error envelope.
const STUCK_INTERVAL_MS = 30_000;
const STUCK_ERRORS = new Set([
  "redis_not_configured",
  "dashboard_failed",
]);

export function useDashboard(
  initial: DashboardResponse | null = null,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): UseDashboardResult {
  const initialData = initial && initial.ok ? initial : null;
  const initialError = initial && !initial.ok ? initial : null;
  const initialStatus: UseDashboardResult["status"] = initialData
    ? "live"
    : initialError
      ? "error"
      : "idle";

  const [data, setData] = useState<DashboardSnapshot | null>(initialData);
  const [error, setError] = useState<DashboardError | null>(initialError);
  const [status, setStatus] =
    useState<UseDashboardResult["status"]>(initialStatus);
  // Intentionally null on first paint — `Date.now()` on the server differs
  // from the client and would cause a hydration mismatch (visible flicker).
  // The first client poll fires within `intervalMs` and fills this in.
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Latest values mirrored as refs so the polling closure can compare against
  // them without re-running the effect on every state change.
  const errorRef = useRef<DashboardError | null>(initialError);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, ms);
    };

    const setStableError = (next: DashboardError) => {
      const prev = errorRef.current;
      if (prev && prev.error === next.error && prev.hint === next.hint) {
        // Identical error — keep the previous reference so consumers don't
        // re-render on every tick.
        return;
      }
      errorRef.current = next;
      setError(next);
    };

    const clearError = () => {
      if (errorRef.current) {
        errorRef.current = null;
        setError(null);
      }
    };

    const tick = async () => {
      if (cancelled) return;
      // Only flip to "loading" on a genuine cold start (no data, no error).
      // After first paint we keep the last known state visible — a brief
      // network blip should never blank the UI.
      setStatus((s) => (s === "idle" ? "loading" : s));

      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        const text = await res.text();
        let json: DashboardResponse;
        try {
          json = JSON.parse(text) as DashboardResponse;
        } catch {
          if (cancelled) return;
          setStableError({
            ok: false,
            error: `bad_response_${res.status}`,
            hint:
              text.slice(0, 160) ||
              `/api/dashboard returned ${res.status} with a non-JSON body`,
          });
          setStatus("error");
          return;
        }

        if (cancelled) return;
        if (json.ok) {
          setData(json);
          clearError();
          setStatus("live");
          setLastUpdated(Date.now());
        } else {
          setStableError(json);
          setStatus("error");
        }
      } catch (err) {
        if (cancelled) return;
        setStableError({
          ok: false,
          error: "network_error",
          hint: err instanceof Error ? err.message : "fetch failed",
        });
        setStatus("error");
      } finally {
        const stuck =
          errorRef.current && STUCK_ERRORS.has(errorRef.current.error);
        schedule(stuck ? Math.max(intervalMs, STUCK_INTERVAL_MS) : intervalMs);
      }
    };

    // If we already have an SSR-seeded snapshot, skip the immediate refetch
    // and just start the cadence. Otherwise tick right away to cover the
    // pure-client path (e.g. tests, storybook).
    if (initial) {
      schedule(intervalMs);
    } else {
      void tick();
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // `initial` is consumed once at mount; `intervalMs` is the only knob.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { data, error, status, lastUpdated };
}
