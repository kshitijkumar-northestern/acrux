#!/usr/bin/env python3
"""Hostile acrux agent.

Stakes a small amount, then hammers ACRUX_BOT_TARGET (default /api/data —
paywalled mock JSON, zero upstream cost) at high RPS. Each iteration the
bot's score drops -10 via the admin path. Once score hits the floor (-100)
and the wallet still has stake, the bot calls the admin slash endpoint to
drain 100% of its stake into the protocol pool.

The narrative for the demo:
    1. Spam bot deposits 5k.
    2. RPS climbs visibly on the dashboard sparkline.
    3. Score ratchets 0 → -10 → -20 → … → -100.
    4. Auto-floor slash drains 5k into the pool.
    5. Operator runs distribute → honest agent's yieldSats jumps.
"""

from __future__ import annotations

import os
import sys
import time
from typing import Any

import requests

BASE = os.environ.get("ACRUX_BASE_URL", "http://localhost:3000").rstrip("/")
ADMIN = os.environ.get("ACRUX_ADMIN_TOKEN")
WALLET = os.environ.get("ACRUX_WALLET", f"spam_{int(time.time())}")
ITERATIONS = int(os.environ.get("ACRUX_BOT_ITERATIONS", "12"))
STAKE_SATS = int(os.environ.get("ACRUX_BOT_STAKE", "5000"))
SCORE_STEP = int(os.environ.get("ACRUX_BOT_SCORE_STEP", "-10"))
DELAY_SECONDS = float(os.environ.get("ACRUX_BOT_DELAY", "0.4"))
# The paywalled endpoint we hammer. Defaults to /api/data (mock JSON, no
# upstream cost) so repeated demo runs do not burn Tavily credits. Override
# to /api/search for the "real upstream" moment in a live pitch.
TARGET = os.environ.get("ACRUX_BOT_TARGET", "/api/data")
# Tight ceiling on the paywall-gated call so a hung MDK checkout (e.g. while
# the merchant domain is still propagating) doesn't stall the bot. Score and
# slash work entirely through admin endpoints, so the demo arc is unaffected.
TARGET_TIMEOUT_S = float(os.environ.get("ACRUX_BOT_TARGET_TIMEOUT", "1.5"))
FLOOR = -100


def die(msg: str, code: int = 1) -> None:
    print(f"[spam-bot] FATAL: {msg}", file=sys.stderr)
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


def hammer(query: str) -> str:
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


def admin_score(delta: int, reason: str) -> dict[str, Any]:
    if not ADMIN:
        die("ACRUX_ADMIN_TOKEN required (admin endpoint).")
    r = post_json(
        "/api/stake/score",
        {"wallet": WALLET, "delta": delta, "reason": reason},
        headers={"X-Acrux-Admin-Token": ADMIN},
    )
    if not r.ok:
        die(f"score bump failed: {r.status_code} {r.text}")
    return r.json()


def admin_slash(fraction: float, reason: str) -> dict[str, Any]:
    r = post_json(
        "/api/stake/slash",
        {"wallet": WALLET, "fraction": fraction, "reason": reason},
        headers={"X-Acrux-Admin-Token": ADMIN or ""},
    )
    if not r.ok:
        die(f"slash failed: {r.status_code} {r.text}")
    return r.json()


def get_state() -> dict[str, Any]:
    r = get_json(f"/api/stake/{WALLET}")
    if not r.ok:
        die(f"state read failed: {r.status_code} {r.text}")
    return r.json()


def main() -> None:
    print(f"[spam-bot] base   = {BASE}")
    print(f"[spam-bot] target = {TARGET}")
    print(f"[spam-bot] wallet = {WALLET}")
    print(f"[spam-bot] stake  = {STAKE_SATS} sats")
    print(f"[spam-bot] iters  = {ITERATIONS}, delay = {DELAY_SECONDS}s, step = {SCORE_STEP}")
    print()

    print(f"[01] depositing {STAKE_SATS} sats (gives the slash something to take)")
    state = deposit(STAKE_SATS)
    print(f"     stake={state.get('stakeSats')} score={state.get('score')} tier={state.get('tier')}")

    queries = [f"spam-{i}" for i in range(ITERATIONS)]
    floored = False
    for i, q in enumerate(queries, start=1):
        status = hammer(q)
        state = admin_score(SCORE_STEP, "demo_rps_abuse")
        score = state.get("score")
        tier = state.get("tier")
        print(
            f"[{i + 1:02d}] {TARGET} {status:<7} q={q:<10} "
            f"→ score={score} tier={tier} stake={state.get('stakeSats')}"
        )
        if not floored and score is not None and score <= FLOOR and state.get("stakeSats", 0) > 0:
            floored = True
            print()
            print(f"[!!] score floor hit ({FLOOR}) with stake={state.get('stakeSats')} — auto-slash 100%")
            result = admin_slash(1.0, "auto_floor_slash")
            print(f"     slashed = {result}")
        time.sleep(DELAY_SECONDS)

    final = get_state()
    print()
    print("[spam-bot] final state:")
    for k in ("wallet", "stakeSats", "score", "tier", "yieldSats"):
        print(f"  {k:>10} = {final.get(k)}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[spam-bot] interrupted")
        sys.exit(130)
