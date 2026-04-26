import { StatCard } from "./stat-card";

const SAT_FMT = new Intl.NumberFormat("en-US");

export function PoolCounter({
  poolSats,
  recentSlashCount,
}: {
  poolSats: number;
  recentSlashCount: number;
}) {
  const captionParts = [
    `from ${recentSlashCount} recent slash${recentSlashCount === 1 ? "" : "es"}`,
  ];
  if (poolSats === 0) captionParts.push("awaiting next abuse");
  return (
    <StatCard
      accent
      label="protocol pool"
      value={`${SAT_FMT.format(poolSats)} sat${poolSats === 1 ? "" : "s"}`}
      caption={captionParts.join(" · ")}
    />
  );
}

export function TotalStakedCounter({
  totalStakedSats,
  walletCount,
}: {
  totalStakedSats: number;
  walletCount: number;
}) {
  return (
    <StatCard
      label="total staked"
      value={`${SAT_FMT.format(totalStakedSats)} sat${totalStakedSats === 1 ? "" : "s"}`}
      caption={`across ${walletCount} wallet${walletCount === 1 ? "" : "s"}`}
    />
  );
}
