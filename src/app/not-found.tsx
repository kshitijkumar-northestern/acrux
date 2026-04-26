import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-20 sm:py-24 lg:px-8 lg:py-28">
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          404 · not found
        </span>
        <h1 className="text-balance text-4xl leading-[1.1] tracking-[-0.03em] sm:text-5xl">
          That route doesn&apos;t exist.
        </h1>
        <p className="max-w-2xl text-[15px] leading-[1.6] text-muted-foreground">
          You probably want one of these.
        </p>
      </div>

      <Card size="sm">
        <CardContent className="flex flex-col gap-2 font-mono text-[13px]">
          <Link
            href="/"
            className="flex items-baseline gap-3 text-foreground transition-colors hover:text-muted-foreground"
          >
            <span aria-hidden className="text-muted-foreground">▸</span>
            <span className="w-32 shrink-0 text-muted-foreground">Home</span>
            <span>landing page · primitives · live status</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex items-baseline gap-3 text-foreground transition-colors hover:text-muted-foreground"
          >
            <span aria-hidden className="text-muted-foreground">▸</span>
            <span className="w-32 shrink-0 text-muted-foreground">Dashboard</span>
            <span>price ticker · stake leaderboard · slash log</span>
          </Link>
          <Link
            href="/api/price"
            className="flex items-baseline gap-3 text-foreground transition-colors hover:text-muted-foreground"
          >
            <span aria-hidden className="text-muted-foreground">▸</span>
            <span className="w-32 shrink-0 text-muted-foreground">/api/price</span>
            <span>free price quote · base × surge × wallet</span>
          </Link>
          <Link
            href="/api/dashboard"
            className="flex items-baseline gap-3 text-foreground transition-colors hover:text-muted-foreground"
          >
            <span aria-hidden className="text-muted-foreground">▸</span>
            <span className="w-32 shrink-0 text-muted-foreground">/api/dashboard</span>
            <span>full snapshot the live panel reads from</span>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
