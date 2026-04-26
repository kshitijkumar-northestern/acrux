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
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-4 px-6 lg:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2 text-[13px] font-medium tracking-tight"
        >
          <Zap
            className="size-3.5 text-[color:var(--color-lightning)] transition-transform group-hover:-translate-y-0.5"
            aria-hidden
          />
          <span className="text-foreground">Acrux</span>
          <span className="hidden text-muted-foreground sm:inline">/</span>
          <span className="hidden text-muted-foreground sm:inline">
            economic immune system
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 text-[13px]">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="https://github.com/kshitijkumar-northestern/acrux"
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub ↗
          </Link>
        </nav>
      </div>
    </header>
  );
}
