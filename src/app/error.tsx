"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[acrux] route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-20 sm:py-24 lg:px-8 lg:py-28">
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Error
        </span>
        <h1 className="text-balance text-4xl leading-[1.1] tracking-[-0.03em] sm:text-5xl">
          Something broke on this page.
        </h1>
        <p className="max-w-2xl text-[15px] leading-[1.6] text-muted-foreground">
          The middleware itself is fine. This is a render-side failure on this
          route. Try again. If it keeps happening, the message below has the
          details.
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
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-transparent px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-card"
          >
            Back to home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-transparent px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-card"
          >
            Open dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
