import type { WalletPriceQuote } from "@/lib/types";
import { StatCard } from "./stat-card";

const SAT_FMT = new Intl.NumberFormat("en-US");

export function PriceTicker({ price }: { price: WalletPriceQuote }) {
  const composed =
    price.multiplier === 1 && price.walletMultiplier === 1
      ? `base ${price.basePriceSats}`
      : `${price.basePriceSats} × ${formatMultiplier(price.multiplier)} surge` +
        (price.walletMultiplier !== 1
          ? ` × ${formatMultiplier(price.walletMultiplier)} wallet`
          : "");
  return (
    <StatCard
      accent
      label="current price"
      value={`${SAT_FMT.format(price.finalPriceSats)} sat${price.finalPriceSats === 1 ? "" : "s"}`}
      caption={
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span>{composed}</span>
          <span className="text-[color:var(--color-subtle)]">·</span>
          <span className="text-[color:var(--color-subtle)]">
            load <LoadLabel load={price.load} />
          </span>
          <span className="text-[color:var(--color-subtle)]">·</span>
          <span className="text-[color:var(--color-subtle)]">
            rps {price.rps}
          </span>
        </span>
      }
    />
  );
}

function formatMultiplier(m: number): string {
  if (m === 1) return "1.0×";
  if (m < 10) return `${m.toFixed(1)}×`;
  if (m < 100) return `${m.toFixed(0)}×`;
  return `${Math.round(m).toLocaleString()}×`;
}

function LoadLabel({ load }: { load: WalletPriceQuote["load"] }) {
  const color =
    load === "attack"
      ? "#f87171"
      : load === "hot"
        ? "var(--color-accent)"
        : "var(--color-muted)";
  return <span style={{ color }}>{load}</span>;
}
