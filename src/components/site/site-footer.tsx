import Link from "next/link";

const PRIMITIVES = [
  { label: "Surge pricing", href: "/api/price" },
  { label: "Per-wallet pricing", href: "/api/ping" },
  { label: "Reputation staking", href: "/api/stake/leaderboard" },
] as const;

const ENDPOINTS = [
  { label: "/api/price", href: "/api/price" },
  { label: "/api/ping", href: "/api/ping" },
  { label: "/api/dashboard", href: "/api/dashboard" },
  { label: "/api/stake/leaderboard", href: "/api/stake/leaderboard" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-border">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-6 py-16 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-3">
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="text-[13px] font-bold tracking-tight text-foreground"
            >
              acrux
            </Link>
            <p className="max-w-xs text-[13px] leading-[1.6] text-muted-foreground">
              Drop-in Lightning middleware. Surge pricing, per-wallet pricing,
              reputation staking. Settled in milliseconds, no signups.
            </p>
          </div>
          <FooterColumn label="Primitives" items={PRIMITIVES} />
          <FooterColumn label="Endpoints" items={ENDPOINTS} />
        </div>
        <div className="flex flex-col-reverse items-start justify-between gap-3 border-t border-border pt-8 sm:flex-row sm:items-center">
          <span className="text-[12px] text-muted-foreground">
            acrux · signet (mutinynet) · mainnet swap @ H21
          </span>
          <div className="flex items-center gap-5 text-[13px]">
            <Link
              href="/dashboard"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              dashboard
            </Link>
            <Link
              href="https://github.com/kshitijkumar-northestern/acrux"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              GitHub ↗
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  label,
  items,
}: {
  label: string;
  items: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <ul className="flex flex-col gap-2.5 text-[13px]">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
