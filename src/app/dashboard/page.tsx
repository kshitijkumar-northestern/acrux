import { DashboardLive } from "@/components/dashboard/dashboard-live";
import { getDashboardSnapshot } from "@/lib/dashboard-snapshot";

// Always render against fresh state so a cold tab never paints with cached
// stake/pool numbers from minutes ago.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  // Server-side seed: if Redis isn't configured, the page paints the offline
  // panel as part of the initial HTML — no skeleton flash, no client poll
  // bouncing through "loading" → "error" on first frame.
  const initial = await getDashboardSnapshot();
  return <DashboardLive initial={initial} />;
}
