#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-3000}"
LOG_FILE="${LOG_FILE:-./.acrux-dev.log}"
PID_FILE="${PID_FILE:-./.acrux-dev.pid}"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Acrux already running (pid $(cat "$PID_FILE")). Use ./stop.sh first."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found in PATH." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies with pnpm..."
  pnpm install
fi

echo "Starting Acrux (next dev) on port $PORT..."
PORT="$PORT" nohup pnpm exec next dev -p "$PORT" >"$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

sleep 1
if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Started. pid=$(cat "$PID_FILE")  log=$LOG_FILE  url=http://localhost:$PORT"
else
  echo "Failed to start. See $LOG_FILE." >&2
  rm -f "$PID_FILE"
  exit 1
fi
