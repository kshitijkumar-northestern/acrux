#!/usr/bin/env node
/* eslint-disable */

// Acrux smoke test — round-trips deposit / score / slash / distribute / read
// against a running dev server. Requires:
//   ACRUX_BASE_URL         (default http://localhost:3000)
//   ACRUX_ADMIN_TOKEN      (required — same value as .env.local)
//
// Each run uses fresh wallets keyed off the current timestamp so the test
// is idempotent against a live Redis. Existing pool / leaderboard state
// from prior runs is left untouched.

const BASE = process.env.ACRUX_BASE_URL ?? "http://localhost:3000";
const ADMIN = process.env.ACRUX_ADMIN_TOKEN ?? "";
const STAMP = Date.now();
const ALICE = process.env.SMOKE_WALLET_A ?? `smoke_alice_${STAMP}`;
const BOB = process.env.SMOKE_WALLET_B ?? `smoke_bob_${STAMP}`;

if (!ADMIN) {
  console.error("✗ ACRUX_ADMIN_TOKEN is required. Set it in your shell or .env.local first.");
  process.exit(1);
}

let step = 0;
const ok = (label, detail) => {
  step += 1;
  const tail = detail ? ` → ${JSON.stringify(detail)}` : "";
  console.log(`✓ [${String(step).padStart(2, "0")}] ${label}${tail}`);
};
const die = (label, err) => {
  step += 1;
  console.error(`✗ [${String(step).padStart(2, "0")}] ${label}`);
  console.error("   ", err?.body ?? err?.message ?? err);
  process.exit(1);
};

async function call(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    const e = new Error(`${res.status} ${path}`);
    e.body = body;
    e.status = res.status;
    throw e;
  }
  return body;
}

const json = (payload, extra = {}) => ({
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Acrux-Admin-Token": ADMIN,
    ...extra,
  },
  body: JSON.stringify(payload),
});

console.log(`Acrux smoke vs ${BASE}`);
console.log(`  alice = ${ALICE}`);
console.log(`  bob   = ${BOB}\n`);

try {
  const price = await call("/api/price");
  if (typeof price.priceSats !== "number") throw new Error("no priceSats in /api/price");
  ok("GET /api/price", { priceSats: price.priceSats, load: price.load });
} catch (e) { die("GET /api/price", e); }

try {
  const w = await call(`/api/stake/${ALICE}`);
  if (w.tier !== "neutral" || w.stakeSats !== 0) throw new Error(`unseen wallet not neutral/0: ${JSON.stringify(w)}`);
  ok(`GET /api/stake/${ALICE} (unseen)`, { tier: w.tier, stake: w.stakeSats });
} catch (e) { die("GET unseen wallet", e); }

try {
  const w = await call("/api/stake/deposit", json({ wallet: ALICE, sats: 1000 }));
  if (w.stakeSats !== 1000) throw new Error(`alice stake = ${w.stakeSats}, expected 1000`);
  ok("POST /api/stake/deposit (alice +1000)", { stake: w.stakeSats });
} catch (e) { die("deposit alice", e); }

try {
  const w = await call("/api/stake/deposit", json({ wallet: BOB, sats: 5000 }));
  if (w.stakeSats !== 5000) throw new Error(`bob stake = ${w.stakeSats}, expected 5000`);
  ok("POST /api/stake/deposit (bob +5000)", { stake: w.stakeSats });
} catch (e) { die("deposit bob", e); }

try {
  const w = await call("/api/stake/score", json({ wallet: BOB, delta: 60, reason: "smoke_setup" }));
  if (w.tier !== "trusted") throw new Error(`bob tier = ${w.tier}, expected trusted`);
  ok("POST /api/stake/score (bob +60 → trusted)", { tier: w.tier, score: w.score });
} catch (e) { die("score bob", e); }

try {
  const w = await call("/api/stake/score", json({ wallet: ALICE, delta: -60, reason: "smoke_abuse" }));
  if (w.tier !== "abusive") throw new Error(`alice tier = ${w.tier}, expected abusive`);
  ok("POST /api/stake/score (alice -60 → abusive)", { tier: w.tier, score: w.score });
} catch (e) { die("score alice", e); }

let slashedSats = 0;
try {
  const r = await call("/api/stake/slash", json({ wallet: ALICE, fraction: 1.0, reason: "smoke_floor" }));
  if (r.state.stakeSats !== 0) throw new Error(`alice stake post-slash = ${r.state.stakeSats}`);
  if (r.event.slashedSats !== 1000) throw new Error(`slashedSats = ${r.event.slashedSats}, expected 1000`);
  slashedSats = r.event.slashedSats;
  ok("POST /api/stake/slash (alice 100%)", { slashed: r.event.slashedSats, remaining: r.state.stakeSats });
} catch (e) { die("slash alice", e); }

try {
  const r = await call("/api/stake/slashlog?limit=5");
  if (!r.events.some((e) => e.wallet === ALICE)) throw new Error("alice's slash event missing");
  if (r.poolSats < slashedSats) throw new Error(`pool = ${r.poolSats}, expected >= ${slashedSats}`);
  ok("GET /api/stake/slashlog", { pool: r.poolSats, events: r.events.length });
} catch (e) { die("slashlog", e); }

let distributed = 0;
let recipients = 0;
try {
  const r = await call("/api/stake/distribute", { method: "POST", headers: { "X-Acrux-Admin-Token": ADMIN } });
  distributed = r.distributed;
  recipients = r.recipients;
  ok("POST /api/stake/distribute", {
    distributed: r.distributed,
    recipients: r.recipients,
    poolBefore: r.poolBefore,
    poolAfter: r.poolAfter,
  });
} catch (e) { die("distribute", e); }

try {
  const w = await call(`/api/stake/${BOB}`);
  if (recipients > 0 && w.yieldSats <= 0) {
    throw new Error(`distribute reported ${recipients} recipients but bob's yield = ${w.yieldSats}`);
  }
  ok(`GET /api/stake/${BOB} (post-distribute)`, { yield: w.yieldSats, tier: w.tier });
} catch (e) { die("post-distribute bob", e); }

try {
  const r = await call("/api/stake/leaderboard?limit=10");
  if (r.totalStaked < 5000) throw new Error(`totalStaked = ${r.totalStaked}, expected >= 5000`);
  ok("GET /api/stake/leaderboard", { count: r.count, totalStaked: r.totalStaked });
} catch (e) { die("leaderboard", e); }

console.log(`\nSmoke OK — slashed ${slashedSats} sats from alice, distributed ${distributed} to ${recipients} trusted staker(s).`);
