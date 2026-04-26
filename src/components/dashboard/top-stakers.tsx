import type { Tier, WalletState } from "@/lib/types";

const SAT_FMT = new Intl.NumberFormat("en-US");

export function TopStakers({ stakers }: { stakers: WalletState[] }) {
  return (
    <article className="rounded-lg border border-[color:var(--color-border)] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-subtle)]">
          top stakers
        </div>
        <div className="font-mono text-xs text-[color:var(--color-subtle)]">
          {stakers.length} wallet{stakers.length === 1 ? "" : "s"}
        </div>
      </div>
      {stakers.length === 0 ? (
        <div className="font-mono text-sm text-[color:var(--color-subtle)]">
          no stakers yet — first POST /api/stake/deposit appears here
        </div>
      ) : (
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="text-left text-[color:var(--color-subtle)]">
              <th className="pb-2 font-normal">#</th>
              <th className="pb-2 font-normal">wallet</th>
              <th className="pb-2 text-right font-normal">stake</th>
              <th className="pb-2 text-right font-normal">score</th>
              <th className="pb-2 text-right font-normal">tier</th>
              <th className="pb-2 text-right font-normal">yield</th>
            </tr>
          </thead>
          <tbody>
            {stakers.map((s, i) => (
              <tr
                key={s.wallet}
                className="border-t border-[color:var(--color-border)]"
              >
                <td className="py-2 text-[color:var(--color-subtle)]">{i + 1}</td>
                <td className="py-2 text-[color:var(--color-foreground)]">
                  {truncate(s.wallet)}
                </td>
                <td className="py-2 text-right tabular-nums text-[color:var(--color-accent)]">
                  {SAT_FMT.format(s.stakeSats)}
                </td>
                <td
                  className="py-2 text-right tabular-nums"
                  style={{ color: scoreColor(s.score) }}
                >
                  {s.score >= 0 ? "+" : ""}
                  {s.score}
                </td>
                <td className="py-2 text-right">
                  <TierTag tier={s.tier} />
                </td>
                <td className="py-2 text-right tabular-nums text-[color:var(--color-accent)]">
                  {SAT_FMT.format(s.yieldSats)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}

function truncate(wallet: string): string {
  if (wallet.length <= 18) return wallet;
  return `${wallet.slice(0, 8)}…${wallet.slice(-6)}`;
}

function scoreColor(score: number): string {
  if (score >= 50) return "var(--color-accent)";
  if (score >= 0) return "var(--color-foreground)";
  if (score >= -50) return "#fbbf24";
  return "#f87171";
}

function TierTag({ tier }: { tier: Tier }) {
  const palette: Record<Tier, { fg: string; bg: string }> = {
    trusted: { fg: "var(--color-accent)", bg: "rgba(247, 147, 26, 0.1)" },
    neutral: { fg: "var(--color-muted)", bg: "rgba(255, 255, 255, 0.04)" },
    suspicious: { fg: "#fbbf24", bg: "rgba(251, 191, 36, 0.08)" },
    abusive: { fg: "#f87171", bg: "rgba(248, 113, 113, 0.08)" },
  };
  const { fg, bg } = palette[tier];
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
      style={{ color: fg, backgroundColor: bg }}
    >
      {tier}
    </span>
  );
}
