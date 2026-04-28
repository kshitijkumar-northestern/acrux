"use client";

import { cn } from "@/lib/utils";
import type { DashboardMode } from "@/lib/use-dashboard";

interface ModeToggleProps {
  mode: DashboardMode;
  onChange: (next: DashboardMode) => void;
  loading?: boolean;
}

export function ModeToggle({
  mode,
  onChange,
  loading = false,
}: ModeToggleProps) {
  const isLive = mode === "live";

  return (
    <div className="inline-flex items-center gap-2.5 font-mono text-[11px] tracking-tight">
      <button
        type="button"
        onClick={() => {
          if (isLive) onChange("sandbox");
        }}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors duration-150",
          !isLive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground/80",
        )}
      >
        sandbox
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={isLive}
        aria-label={isLive ? "Switch to sandbox view" : "Switch to live view"}
        aria-busy={loading}
        onClick={() => onChange(isLive ? "sandbox" : "live")}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          isLive ? "bg-foreground/[0.14]" : "bg-card/40",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-0.5 top-1/2 size-4 -translate-y-1/2 rounded-full bg-foreground shadow-[0_1px_2px_rgba(0,0,0,0.20)] transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isLive ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>

      <button
        type="button"
        onClick={() => {
          if (!isLive) onChange("live");
        }}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors duration-150",
          isLive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground/80",
        )}
      >
        live
      </button>
    </div>
  );
}
