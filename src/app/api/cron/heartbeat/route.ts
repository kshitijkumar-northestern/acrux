import { tickHeartbeat } from "@/lib/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron-triggered heartbeat. Runs the same logic as the on-fetch hook in
// getDashboardSnapshot so the dashboard stays populated even when no client
// is polling.
//
// Auth:
//   - Vercel Cron sets `x-vercel-cron: 1` on scheduled invocations and the
//     route is published in vercel.json. Production deployments see this
//     header on cron triggers and authorize them.
//   - For manual triggering (curl, monitoring), set ACRUX_CRON_SECRET in env
//     and pass `Authorization: Bearer <token>`.
export async function GET(req: Request) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const expected = process.env.ACRUX_CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const isSecret = Boolean(expected) && auth === `Bearer ${expected}`;

  if (!isVercelCron && !isSecret) {
    return Response.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const result = await tickHeartbeat();
  return Response.json({ ok: true, ...result });
}
