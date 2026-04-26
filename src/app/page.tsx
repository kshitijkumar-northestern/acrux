import Link from "next/link";

const PRIMITIVES = [
  {
    label: "A",
    title: "Per-load surge pricing",
    body: "Server load goes up, the Lightning invoice price goes up automatically. 1 sat at idle, 10,000 sats during a detected attack. Continuous curve.",
  },
  {
    label: "B",
    title: "Per-wallet attacker pricing",
    body: "We don't price the route, we price the paying wallet. Honest agents stay at base rate while one bad actor pays surge prices. Stripe physically cannot do this.",
  },
  {
    label: "C",
    title: "Reputation staking + slashing",
    body: "Agents stake sats up front. Behave well → earn yield. Misbehave → stake gets slashed. The slashed pool pays the honest agents. Attackers fund their targets.",
  },
] as const;

const STATUS = [
  { hour: "0–3", label: "L402 paywall live at /api/ping", done: true },
  { hour: "3–6", label: "Surge engine + free /api/price quote", done: false },
  { hour: "6–10", label: "Reputation staking with slashing", done: false },
  { hour: "10–13", label: "Per-wallet pricing layer", done: false },
  { hour: "13–17", label: "Dashboard + dueling-bots demo", done: false },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen px-6 py-16 sm:py-24">
      <main className="mx-auto w-full max-w-3xl space-y-16">
        <header className="space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--color-accent)]">
            <span aria-hidden>⚡</span>
            <span>acrux</span>
            <span className="text-[color:var(--color-subtle)]">·</span>
            <span className="text-[color:var(--color-subtle)]">
              hacknation challenge 02
            </span>
          </div>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Economic immune system for the agent economy.
          </h1>

          <p className="max-w-2xl text-base leading-relaxed text-[color:var(--color-muted)]">
            Acrux is a drop-in Lightning Network middleware that auto-prices
            attackers out, pays honest agents back, and settles every
            transaction in milliseconds. No signups, no API keys, no
            chargebacks.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {PRIMITIVES.map((p) => (
            <article
              key={p.label}
              className="rounded-lg border border-[color:var(--color-border)] bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]"
            >
              <div className="mb-3 flex items-center gap-2 font-mono text-xs">
                <span className="rounded bg-[color:var(--color-accent-soft)] px-1.5 py-0.5 text-[color:var(--color-accent)]">
                  {p.label}
                </span>
                <span className="text-[color:var(--color-subtle)] uppercase tracking-wider">
                  primitive
                </span>
              </div>
              <h3 className="mb-2 text-sm font-semibold tracking-tight">
                {p.title}
              </h3>
              <p className="text-sm leading-relaxed text-[color:var(--color-muted)]">
                {p.body}
              </p>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-[color:var(--color-border)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-mono text-xs uppercase tracking-wider text-[color:var(--color-subtle)]">
              build status
            </div>
            <div className="font-mono text-xs text-[color:var(--color-subtle)]">
              signet (mutinynet) · mainnet swap @ H21
            </div>
          </div>
          <ul className="space-y-1.5 font-mono text-sm">
            {STATUS.map((s) => (
              <li key={s.hour} className="flex items-baseline gap-3">
                <span className="w-14 shrink-0 text-[color:var(--color-subtle)]">
                  H{s.hour}
                </span>
                <span
                  aria-hidden
                  className={
                    s.done
                      ? "text-[color:var(--color-accent)]"
                      : "text-[color:var(--color-subtle)]"
                  }
                >
                  {s.done ? "▸" : "○"}
                </span>
                <span
                  className={
                    s.done
                      ? "text-[color:var(--color-foreground)]"
                      : "text-[color:var(--color-muted)]"
                  }
                >
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-wider text-[color:var(--color-subtle)]">
            try it
          </h2>
          <div className="space-y-2 rounded-lg border border-[color:var(--color-border)] bg-black/40 p-4 font-mono text-xs leading-relaxed">
            <div className="text-[color:var(--color-subtle)]"># Free price quote — read the live surge multiplier</div>
            <div>
              <span className="text-[color:var(--color-accent)]">$</span> curl
              localhost:3000/api/price
            </div>
            <div className="pt-2 text-[color:var(--color-subtle)]"># Paywalled ping — returns 402 + Lightning invoice on first hit</div>
            <div>
              <span className="text-[color:var(--color-accent)]">$</span> curl
              -i localhost:3000/api/ping
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-border)] pt-6 font-mono text-xs text-[color:var(--color-subtle)]">
          <div>acrux · signet (mutinynet) · mainnet swap @ H21</div>
          <div className="flex items-center gap-4">
            <Link
              href="/api/price"
              className="hover:text-[color:var(--color-foreground)]"
            >
              /api/price
            </Link>
            <Link
              href="/api/ping"
              className="hover:text-[color:var(--color-foreground)]"
            >
              /api/ping
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
