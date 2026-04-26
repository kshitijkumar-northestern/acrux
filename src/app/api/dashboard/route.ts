import {
  getDashboardSnapshot,
  parseDashboardMode,
  statusForResponse,
} from "@/lib/dashboard-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Thin HTTP wrapper around getDashboardSnapshot(). The same function powers
// SSR for the dashboard page, so the client renders against an identical
// shape on first paint and on every poll. The optional ?mode= query toggles
// between the composed sandbox view (default) and direct Redis state.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = parseDashboardMode(url.searchParams.get("mode"));
  const snap = await getDashboardSnapshot(mode);
  return Response.json(snap, { status: statusForResponse(snap) });
}
