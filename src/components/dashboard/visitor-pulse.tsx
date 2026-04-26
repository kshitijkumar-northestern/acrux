"use client";

import { useEffect } from "react";

// Captures dashboard-viewer activity as RPS data points. Each open tab fires a
// paywall-protected POST /api/data on mount and every PULSE_INTERVAL_MS
// thereafter. The unpaid 402 path inside dynamicAmount calls
// recordRequest() + recordWalletRequest() before the payment check, so the
// global + per-wallet RPS sparkline reflects live readers without consuming
// any Lightning settlement.
//
// Cost per pulse: ~2 Redis ops (global ZADD + per-wallet ZADD).
// At 30s cadence with one viewer that's 4 ops/min — well under any sane quota.

const PULSE_INTERVAL_MS = 30_000;
const VISITOR_KEY = "acrux:visitor_wallet";

function getOrCreateVisitorWallet(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let w = window.localStorage.getItem(VISITOR_KEY);
    if (!w) {
      // Anonymous, stable handle. Persisted in localStorage so a returning
      // viewer surfaces as the same wallet on the per-wallet RPS panel.
      w = `visitor_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(VISITOR_KEY, w);
    }
    return w;
  } catch {
    // Private mode or blocked storage — fall back to an ephemeral handle so
    // the global sparkline still receives the request.
    return `visitor_${Math.random().toString(36).slice(2, 10)}`;
  }
}

async function pulse(wallet: string): Promise<void> {
  try {
    await fetch("/api/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Acrux-Wallet": wallet,
      },
      body: JSON.stringify({ q: "dashboard_visit" }),
      // Short timeout — the response (a 402 challenge here) is irrelevant; we
      // only need the server to register the request before the tab walks away.
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
  } catch {
    // 402 surfaces as an HTTP response, not a throw. Anything that does
    // throw (timeout, offline, blocked) is silent — the dashboard remains
    // useful to read even if the viewer's pulse can't reach the server.
  }
}

export function VisitorPulse() {
  useEffect(() => {
    const wallet = getOrCreateVisitorWallet();
    if (!wallet) return;

    void pulse(wallet);
    const id = window.setInterval(() => {
      void pulse(wallet);
    }, PULSE_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, []);

  return null;
}
