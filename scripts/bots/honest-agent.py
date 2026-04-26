#!/usr/bin/env python3
"""Honest acrux agent.

Deposits a stake, then loops paced paid requests against ACRUX_BOT_TARGET
(default /api/data — paywalled mock JSON, zero upstream cost). Each iteration
credits +1 to the wallet score via the admin path so the demo arc is driven
by reputation writes rather than by a real L402 checkout from Python. Over
~50 iterations the wallet crosses the trusted threshold (+50) and the wallet
multiplier drops to 0.5×.
"""

from __future__ import annotations

import os
import sys
import time
from typing import Any

import requests

BASE = os.environ.get("ACRUX_BASE_URL", "http://localhost:3000").rstrip("/")
ADMIN = os.environ.get("ACRUX_ADMIN_TOKEN")
WALLET = os.environ.get("ACRUX_WALLET", f"honest_{int(time.time())}")
ITERATIONS = int(os.environ.get("ACRUX_BOT_ITERATIONS", "60"))
STAKE_SATS = int(os.environ.get("ACRUX_BOT_STAKE", "10000"))
DELAY_SECONDS = float(os.environ.get("ACRUX_BOT_DELAY", "1.0"))
# The paywalled endpoint we hammer. Defaults to /api/data (mock JSON, no
# upstream cost) so repeated demo runs do not burn Tavily credits. Override
# to /api/search for the "real upstream" moment in a live pitch.
TARGET = os.environ.get("ACRUX_BOT_TARGET", "/api/data")
# Tight ceiling on the paywall-gated call so a hung MDK checkout (e.g. while
# the merchant domain is still propagating) doesn't stall the bot. Score is
# driven by /api/stake/score, so the demo arc is unaffected by failures here.
TARGET_TIMEOUT_S = float(os.environ.get("ACRUX_BOT_TARGET_TIMEOUT", "1.5"))

QUERIES = [
    "bitcoin lightning network primer",
    "L402 protocol overview",
    "lnurl-pay vs bolt12 offers",
    "fedimint federated chaumian mint",
    "ldk vs lnd architecture",
    "MuSig2 schnorr signatures",
    "rgb smart contracts on bitcoin",
    "ark protocol off-chain",
    "splice channels lightning",
    "taproot assets bolt 11 invoice",
]


def die(msg: str, code: int = 1) -> None:
    print(f"[honest-agent] FATAL: {msg}", file=sys.stderr)
    sys.exit(code)


def post_json(path: str, body: dict[str, Any], headers: dict[str, str] | None = None) -> requests.Response:
    return requests.post(f"{BASE}{path}", json=body, headers=headers or {}, timeout=10)


def get_json(path: str, headers: dict[str, str] | None = None) -> requests.Response:
    return requests.get(f"{BASE}{path}", headers=headers or {}, timeout=10)


def deposit(sats: int) -> dict[str, Any]:
    r = post_json("/api/stake/deposit", {"wallet": WALLET, "sats": sats})
    if not r.ok:
        die(f"deposit failed: {r.status_code} {r.text}")
    return r.json()


def paid_request(query: str) -> str:
    """Hit a paywalled endpoint so the dashboard sees the wallet's RPS.

    The first response is the L402 402 invoice. We don't pay it from Python;
    the score credit below is what makes the wallet's reputation move.
    Returns the HTTP status (or a short failure tag) for visibility.
    """
    try:
        r = requests.post(
            f"{BASE}{TARGET}",
            json={"q": query},
            headers={"X-Acrux-Wallet": WALLET},
            timeout=TARGET_TIMEOUT_S,
        )
        return str(r.status_code)
    except requests.Timeout:
        return "timeout"
    except requests.RequestException:
        return "neterr"


def credit_score(delta: int, reason: str) -> dict[str, Any]:
    if not ADMIN:
        die("ACRUX_ADMIN_TOKEN required to credit score (admin endpoint).")
    r = post_json(
        "/api/stake/score",
        {"wallet": WALLET, "delta": delta, "reason": reason},
        headers={"X-Acrux-Admin-Token": ADMIN},
    )
    if not r.ok:
        die(f"score credit failed: {r.status_code} {r.text}")
    return r.json()


def get_state() -> dict[str, Any]:
    r = get_json(f"/api/stake/{WALLET}")
    if not r.ok:
        die(f"state read failed: {r.status_code} {r.text}")
    return r.json()


def main() -> None:
    print(f"[honest-agent] base   = {BASE}")
    print(f"[honest-agent] target = {TARGET}")
    print(f"[honest-agent] wallet = {WALLET}")
    print(f"[honest-agent] stake  = {STAKE_SATS} sats")
    print(f"[honest-agent] iters  = {ITERATIONS}, delay = {DELAY_SECONDS}s")
    print()

    print(f"[01] depositing {STAKE_SATS} sats")
    state = deposit(STAKE_SATS)
    print(f"     stake={state.get('stakeSats')} score={state.get('score')} tier={state.get('tier')}")

    crossed_trusted = False
    for i in range(1, ITERATIONS + 1):
        q = QUERIES[(i - 1) % len(QUERIES)]
        status = paid_request(q)
        state = credit_score(+1, "demo_paid_request")
        score = state.get("score")
        tier = state.get("tier")
        print(
            f"[{i + 1:02d}] {TARGET} {status:<7} q={q!r:<48} "
            f"→ score={score} tier={tier}"
        )
        if not crossed_trusted and tier == "trusted":
            crossed_trusted = True
            print(f"     ✓ crossed trusted threshold at score={score} (multiplier 0.5×)")
        time.sleep(DELAY_SECONDS)

    final = get_state()
    print()
    print("[honest-agent] final state:")
    for k in ("wallet", "stakeSats", "score", "tier", "yieldSats"):
        print(f"  {k:>10} = {final.get(k)}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[honest-agent] interrupted")
        sys.exit(130)
