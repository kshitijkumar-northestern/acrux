import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  tone?: "default" | "danger";
}

export function StatCard({
  label,
  value,
  caption,
  tone = "default",
}: StatCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div
          className={cn(
            "font-sans text-3xl font-semibold tabular-nums tracking-[-0.03em]",
            tone === "danger" ? "text-destructive" : "text-foreground"
          )}
        >
          {value}
        </div>
        {caption ? (
          <div className="text-[12px] leading-[1.5] text-muted-foreground">
            {caption}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
