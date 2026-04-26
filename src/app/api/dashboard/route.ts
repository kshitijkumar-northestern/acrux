import {
  getDashboardSnapshot,
  statusForResponse,
} from "@/lib/dashboard-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Thin HTTP wrapper around getDashboardSnapshot(). The same function powers
// SSR for the dashboard page, so the client renders against an identical
// shape on first paint and on every poll.
export async function GET() {
  const snap = await getDashboardSnapshot();
  return Response.json(snap, { status: statusForResponse(snap) });
}
