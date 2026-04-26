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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-3">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Acrux
            </span>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Drop-in Lightning middleware. Surge pricing, per-wallet pricing,
              reputation staking — settled in milliseconds, no signups.
            </p>
          </div>
          <FooterColumn label="Primitives" items={PRIMITIVES} />
          <FooterColumn label="Endpoints" items={ENDPOINTS} />
        </div>
        <div className="flex flex-col-reverse items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <span className="font-mono text-xs text-muted-foreground">
            acrux · signet (mutinynet) · mainnet swap @ H21
          </span>
          <div className="flex items-center gap-4 font-mono text-xs">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="https://github.com/kshitijkumar-northestern/acrux"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
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
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <ul className="flex flex-col gap-2 font-mono text-xs">
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
