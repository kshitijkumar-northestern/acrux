"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PaymentEvent,
  SlashEvent,
  WalletPriceQuote,
  WalletState,
} from "./types";

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

export interface UseDashboardResult {
  data: DashboardSnapshot | null;
  error: DashboardError | null;
  status: "idle" | "loading" | "live" | "error";
  lastUpdated: number | null;
}

const DEFAULT_INTERVAL_MS = 1000;

export function useDashboard(intervalMs: number = DEFAULT_INTERVAL_MS): UseDashboardResult {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<DashboardError | null>(null);
  const [status, setStatus] = useState<UseDashboardResult["status"]>("idle");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Guard against state writes after unmount (route changes during a poll).
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      if (!data) setStatus((s) => (s === "live" ? s : "loading"));
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        const text = await res.text();
        let json: DashboardResponse;
        try {
          json = JSON.parse(text) as DashboardResponse;
        } catch {
          if (!aliveRef.current) return;
          setError({
            ok: false,
            error: `bad_response_${res.status}`,
            hint:
              text.slice(0, 160) ||
              `/api/dashboard returned ${res.status} with a non-JSON body`,
          });
          setStatus("error");
          return;
        }
        if (!aliveRef.current) return;
        if (json.ok) {
          setData(json);
          setError(null);
          setStatus("live");
          setLastUpdated(Date.now());
        } else {
          setError(json);
          setStatus("error");
        }
      } catch (err) {
        if (!aliveRef.current) return;
        setError({
          ok: false,
          error: "network_error",
          hint: err instanceof Error ? err.message : "fetch failed",
        });
        setStatus("error");
      } finally {
        if (!cancelled) {
          timer = setTimeout(tick, intervalMs);
        }
      }
    };

    tick();

    return () => {
      cancelled = true;
      aliveRef.current = false;
      if (timer) clearTimeout(timer);
    };
    // Polling cadence is the only knob; data writes happen inside the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { data, error, status, lastUpdated };
}
