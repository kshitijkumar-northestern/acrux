#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PID_FILE="${PID_FILE:-./.acrux-dev.pid}"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No pid file ($PID_FILE). Acrux not running via start.sh?"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if ! kill -0 "$PID" 2>/dev/null; then
  echo "Process $PID not running. Cleaning up pid file."
  rm -f "$PID_FILE"
  exit 0
fi

echo "Stopping Acrux (pid $PID)..."
# Kill the whole process group so the next dev child also dies.
PGID="$(ps -o pgid= -p "$PID" | tr -d ' ' || true)"
if [[ -n "${PGID:-}" ]]; then
  kill -TERM -"$PGID" 2>/dev/null || kill -TERM "$PID" 2>/dev/null || true
else
  kill -TERM "$PID" 2>/dev/null || true
fi

for _ in {1..20}; do
  if ! kill -0 "$PID" 2>/dev/null; then
    break
  fi
  sleep 0.25
done

if kill -0 "$PID" 2>/dev/null; then
  echo "Forcing kill..."
  kill -KILL "$PID" 2>/dev/null || true
  if [[ -n "${PGID:-}" ]]; then
    kill -KILL -"$PGID" 2>/dev/null || true
  fi
fi

rm -f "$PID_FILE"
echo "Stopped."
