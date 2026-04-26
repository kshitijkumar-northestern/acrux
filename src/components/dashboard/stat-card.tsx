import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  accent?: boolean;
  tone?: "default" | "danger";
}

export function StatCard({
  label,
  value,
  caption,
  accent,
  tone = "default",
}: StatCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-[11px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div
          className={cn(
            "font-mono text-3xl font-semibold tabular-nums tracking-tight",
            tone === "danger"
              ? "text-destructive"
              : accent
                ? "text-[color:var(--color-lightning)]"
                : "text-foreground"
          )}
        >
          {value}
        </div>
        {caption ? (
          <div className="font-mono text-xs text-muted-foreground">
            {caption}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
