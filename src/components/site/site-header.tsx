import Link from "next/link";
import { Zap } from "lucide-react";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/api/price", label: "/api/price" },
  { href: "/api/ping", label: "/api/ping" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]"
        >
          <Zap
            className="size-3 text-[color:var(--color-lightning)] transition-transform group-hover:-translate-y-0.5"
            aria-hidden
          />
          <span className="text-foreground">acrux</span>
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <span className="hidden text-muted-foreground sm:inline">
            economic immune system
          </span>
        </Link>
        <nav className="flex items-center gap-1 font-mono text-xs">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-2.5 py-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="https://github.com/kshitijkumar-northestern/acrux"
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-2.5 py-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            GitHub ↗
          </Link>
        </nav>
      </div>
    </header>
  );
}
