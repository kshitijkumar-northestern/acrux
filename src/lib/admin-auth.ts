// Returns a Response to short-circuit on if the caller fails admin auth, or
// null if the call is authorized. Routes wrap their handler with:
//
//   const fail = requireAdmin(req);
//   if (fail) return fail;
//
// Admin token must be set in .env.local — if missing, all admin routes
// return 503 instead of silently allowing through.
export function requireAdmin(req: Request): Response | null {
  const expected = process.env.ACRUX_ADMIN_TOKEN;
  if (!expected) {
    return Response.json(
      {
        ok: false,
        error: "admin_disabled",
        hint: "Set ACRUX_ADMIN_TOKEN in .env.local to enable admin routes.",
      },
      { status: 503 },
    );
  }
  const provided = req.headers.get("x-acrux-admin-token");
  if (provided !== expected) {
    return Response.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }
  return null;
}
