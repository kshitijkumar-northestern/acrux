"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API_ENDPOINTS = [
  {
    href: "/api/price",
    label: "price quote",
    path: "/api/price",
    hint: "Free · live surge multiplier",
  },
  {
    href: "/api/ping",
    label: "paywalled ping",
    path: "/api/ping",
    hint: "1 sat · L402 invoice",
  },
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
          <Link
            href="/dashboard"
            className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            dashboard
          </Link>
          <Link
            href="/docs"
            className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            docs
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-muted-foreground outline-none transition-colors hover:text-foreground data-[popup-open]:text-foreground">
              api
              <ChevronDown className="size-3 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-64 p-1.5"
            >
              <DropdownMenuGroup className="flex flex-col gap-0.5">
                {API_ENDPOINTS.map((endpoint) => (
                  <DropdownMenuItem
                    key={endpoint.href}
                    render={<Link href={endpoint.href} />}
                    className="flex flex-col items-stretch gap-0.5 px-2 py-2"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium text-foreground">
                        {endpoint.label}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground/80">
                        {endpoint.path}
                      </span>
                    </span>
                    <span className="text-[12px] leading-[1.5] text-muted-foreground">
                      {endpoint.hint}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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
