"use client";

import { useEffect } from "react";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[acrux] global error:", error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-center gap-6 px-6 py-20 lg:px-8">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Critical error
          </span>
          <h1 className="text-balance text-4xl leading-[1.1] tracking-[-0.03em] sm:text-5xl">
            The app shell crashed.
          </h1>
          <p className="max-w-2xl text-[15px] leading-[1.6] text-muted-foreground">
            This is the last-resort fallback. The layout itself failed to
            render. Try resetting; if the failure persists, reload the page.
          </p>
          <div className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-[12px] text-destructive">
            {error.name || "Error"}
            {error.digest ? ` · ${error.digest}` : ""}
            {error.message ? `\n${error.message}` : ""}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.assign("/");
                }
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-transparent px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-card"
            >
              Reload home
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
