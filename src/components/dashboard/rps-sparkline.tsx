"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import type { LoadBand } from "@/lib/types";

const BUFFER_SIZE = 60;

interface RpsSample {
  t: number;
  rps: number;
}

interface SparklineProps {
  rps: number;
  load: LoadBand;
  multiplier: number;
  generatedAt: string;
}

export function RpsSparkline({ rps, load, multiplier, generatedAt }: SparklineProps) {
  const [buffer, setBuffer] = useState<RpsSample[]>([]);
  const lastStampRef = useRef<string | null>(null);

  // Append on each fresh poll. We dedupe on generatedAt so a re-render with
  // the same snapshot doesn't double-count a sample.
  useEffect(() => {
    if (lastStampRef.current === generatedAt) return;
    lastStampRef.current = generatedAt;
    setBuffer((prev) => {
      const next = [...prev, { t: Date.parse(generatedAt) || Date.now(), rps }];
      return next.length > BUFFER_SIZE ? next.slice(-BUFFER_SIZE) : next;
    });
  }, [generatedAt, rps]);

  const fill = colorForLoad(load);
  const series = padToBuffer(buffer);

  return (
    <article className="rounded-lg border border-[color:var(--color-border)] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-subtle)]">
          requests / second · last {BUFFER_SIZE}s
        </div>
        <div className="flex items-baseline gap-3 font-mono text-xs text-[color:var(--color-muted)]">
          <span>
            load <span style={{ color: fill }}>{load}</span>
          </span>
          <span className="text-[color:var(--color-subtle)]">·</span>
          <span>
            surge <span className="text-[color:var(--color-foreground)]">{multiplier.toFixed(2)}×</span>
          </span>
          <span className="text-[color:var(--color-subtle)]">·</span>
          <span>
            now <span className="text-[color:var(--color-foreground)]">{rps}</span>
          </span>
        </div>
      </div>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="rps-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fill} stopOpacity={0.6} />
                <stop offset="100%" stopColor={fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={[0, "dataMax + 2"]} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.08)" }}
              contentStyle={{
                background: "#0f1014",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
              labelFormatter={(_label, payload) => {
                const ts = payload?.[0]?.payload?.t as number | undefined;
                return ts ? new Date(ts).toLocaleTimeString() : "";
              }}
              formatter={(value) => [`${Number(value)} rps`, ""]}
            />
            <Area
              type="monotone"
              dataKey="rps"
              stroke={fill}
              strokeWidth={1.5}
              fill="url(#rps-grad)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function colorForLoad(load: LoadBand): string {
  switch (load) {
    case "attack":
      return "#f87171";
    case "hot":
      return "#f7931a";
    case "light":
      return "#9ca3af";
    case "idle":
    default:
      return "#5a5f6b";
  }
}

// Pads the leading edge of the chart so the line draws right-aligned (newest
// samples on the right) instead of left-aligned during the first 60s.
function padToBuffer(buf: RpsSample[]): RpsSample[] {
  if (buf.length >= BUFFER_SIZE) return buf;
  const pad: RpsSample[] = [];
  const padCount = BUFFER_SIZE - buf.length;
  const firstT = buf[0]?.t ?? Date.now();
  for (let i = 0; i < padCount; i += 1) {
    pad.push({ t: firstT - (padCount - i) * 1000, rps: 0 });
  }
  return [...pad, ...buf];
}
