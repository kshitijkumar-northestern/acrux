#!/usr/bin/env python3
"""End-to-end Acrux demo runner.

Drives the full dueling-bots story so a single command produces the
narrative the dashboard is built to show:

    1. Honest agent deposits 10k sats and starts climbing toward trusted.
    2. Spam bot deposits 5k sats and ratchets to the score floor.
    3. Spam bot's stake is auto-slashed into the protocol pool.
    4. Operator runs /api/stake/distribute → pool drains to trusted stakers.
    5. Honest agent's yieldSats counter jumps on the dashboard.

Run-of-show:
    pnpm dev                    # in one terminal
    pnpm demo                   # in another (this script)

Or directly:
    python scripts/bots/run-demo.py

Requirements:
    ACRUX_BASE_URL=http://localhost:3000
    ACRUX_ADMIN_TOKEN=<same token that's in .env.local>

Tunables (env):
    HONEST_ITERATIONS   default 30
    HONEST_DELAY        default 0.6
    SPAM_ITERATIONS     default 14
    SPAM_DELAY          default 0.3
    SPAM_OFFSET_S       default 4.0   delay before spam-bot starts
    SKIP_DISTRIBUTE     default unset  set to skip the post-bot distribute call
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

import requests

BASE = os.environ.get("ACRUX_BASE_URL", "http://localhost:3000").rstrip("/")
ADMIN = os.environ.get("ACRUX_ADMIN_TOKEN", "")

HONEST_ITERATIONS = int(os.environ.get("HONEST_ITERATIONS", "30"))
HONEST_DELAY = float(os.environ.get("HONEST_DELAY", "0.6"))
SPAM_ITERATIONS = int(os.environ.get("SPAM_ITERATIONS", "14"))
SPAM_DELAY = float(os.environ.get("SPAM_DELAY", "0.3"))
SPAM_OFFSET_S = float(os.environ.get("SPAM_OFFSET_S", "4.0"))
SKIP_DISTRIBUTE = bool(os.environ.get("SKIP_DISTRIBUTE"))

HERE = Path(__file__).resolve().parent
HONEST = HERE / "honest-agent.py"
SPAM = HERE / "spam-bot.py"


def die(msg: str, code: int = 1) -> None:
    print(f"\n[run-demo] FATAL: {msg}", file=sys.stderr)
    sys.exit(code)


def preflight() -> None:
    if not ADMIN:
        die("ACRUX_ADMIN_TOKEN is required (same value as .env.local).")
    try:
        r = requests.get(f"{BASE}/api/dashboard", timeout=5)
    except requests.RequestException as e:
        die(f"cannot reach {BASE}/api/dashboard — is `pnpm dev` running? ({e})")
    if r.status_code == 503:
        die(
            "/api/dashboard returned 503 — check UPSTASH_REDIS_REST_URL and "
            "UPSTASH_REDIS_REST_TOKEN in .env.local."
        )
    if not r.ok:
        die(f"/api/dashboard returned {r.status_code}: {r.text[:200]}")
    snap = r.json()
    print(f"[run-demo] base = {BASE}")
    print(
        f"[run-demo] preflight ok — pool={snap['stake']['pool']} "
        f"totalStaked={snap['stake']['totalStaked']} stakers={len(snap['topStakers'])}"
    )


def env_for(extra: dict[str, str]) -> dict[str, str]:
    base = os.environ.copy()
    base.update(extra)
    return base


def spawn_honest() -> subprocess.Popen[bytes]:
    return subprocess.Popen(
        [sys.executable, str(HONEST)],
        env=env_for(
            {
                "ACRUX_BOT_ITERATIONS": str(HONEST_ITERATIONS),
                "ACRUX_BOT_DELAY": str(HONEST_DELAY),
                "ACRUX_WALLET": f"honest_{int(time.time())}",
            }
        ),
    )


def spawn_spam() -> subprocess.Popen[bytes]:
    return subprocess.Popen(
        [sys.executable, str(SPAM)],
        env=env_for(
            {
                "ACRUX_BOT_ITERATIONS": str(SPAM_ITERATIONS),
                "ACRUX_BOT_DELAY": str(SPAM_DELAY),
                "ACRUX_WALLET": f"spam_{int(time.time())}",
            }
        ),
    )


def distribute() -> None:
    print()
    print("[run-demo] draining pool via POST /api/stake/distribute …")
    r = requests.post(
        f"{BASE}/api/stake/distribute",
        headers={"X-Acrux-Admin-Token": ADMIN},
        timeout=10,
    )
    if not r.ok:
        die(f"distribute failed: {r.status_code} {r.text[:200]}")
    body = r.json()
    print(
        f"[run-demo] distributed = {body.get('distributed')} sat → "
        f"{body.get('recipients')} recipient(s) "
        f"(pool {body.get('poolBefore')} → {body.get('poolAfter')})"
    )


def main() -> None:
    print("=" * 64)
    print(" Acrux demo runner — dueling bots end-to-end")
    print("=" * 64, flush=True)
    preflight()

    print()
    print(f"[run-demo] spawning honest-agent ({HONEST_ITERATIONS} iters @ {HONEST_DELAY}s)")
    honest = spawn_honest()

    print(f"[run-demo] sleeping {SPAM_OFFSET_S}s, then spawning spam-bot")
    time.sleep(SPAM_OFFSET_S)

    print(f"[run-demo] spawning spam-bot   ({SPAM_ITERATIONS} iters @ {SPAM_DELAY}s)")
    spam = spawn_spam()

    spam_rc = spam.wait()
    print(f"[run-demo] spam-bot exited with code {spam_rc}")

    honest_rc = honest.wait()
    print(f"[run-demo] honest-agent exited with code {honest_rc}")

    if SKIP_DISTRIBUTE:
        print("[run-demo] SKIP_DISTRIBUTE set — leaving pool untouched")
    else:
        distribute()

    print()
    print(f"[run-demo] done — open {BASE}/dashboard to inspect final state")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[run-demo] interrupted")
        sys.exit(130)
