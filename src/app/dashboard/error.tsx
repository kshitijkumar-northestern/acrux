"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[acrux] dashboard error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-12 sm:py-16 lg:px-8">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Dashboard offline
        </span>
        <h1 className="text-3xl leading-[1.1] tracking-[-0.03em] sm:text-4xl">
          The dashboard hit a render error.
        </h1>
        <p className="text-[13px] leading-[1.6] text-muted-foreground">
          The middleware and APIs are unaffected. This boundary is scoped to
          the dashboard route only.
        </p>
      </div>

      <Alert variant="destructive">
        <AlertTitle className="font-mono">
          {error.name || "Error"}
          {error.digest ? ` · ${error.digest}` : ""}
        </AlertTitle>
        {error.message ? (
          <AlertDescription className="font-mono text-[12px]">
            {error.message}
          </AlertDescription>
        ) : null}
      </Alert>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Retry dashboard
          </button>
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-transparent px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-card"
          >
            Back to home
          </Link>
          <Link
            href="/api/dashboard"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-transparent px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-card"
          >
            Inspect raw /api/dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
