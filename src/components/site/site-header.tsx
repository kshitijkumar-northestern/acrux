import Link from "next/link";

const NAV_LINKS = [
  { href: "/dashboard", label: "dashboard" },
  { href: "/api/price", label: "/api/price" },
  { href: "/api/ping", label: "/api/ping" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-4 px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-[13px] tracking-tight"
        >
          <span className="font-bold text-foreground">acrux</span>
          <span className="hidden text-muted-foreground sm:inline">/</span>
          <span className="hidden font-medium text-muted-foreground sm:inline">
            programmable paywall for ai agents
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
