#!/usr/bin/env node
/* eslint-disable */

// Acrux env probe. Reads .env.local, reports which credentials are present,
// missing, or look malformed, and pings Upstash Redis if both URL + token
// are set. Side-effect free — never writes anything.
//
//   pnpm exec node scripts/check-env.mjs

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENV_PATH = join(ROOT, ".env.local");

if (!existsSync(ENV_PATH)) {
  console.error(`✗ ${ENV_PATH} not found. Copy .env.example → .env.local first.`);
  process.exit(1);
}

const env = parseEnv(readFileSync(ENV_PATH, "utf8"));

const REQUIRED = [
  {
    key: "ACRUX_ADMIN_TOKEN",
    purpose: "gates /api/stake/{score,slash,distribute}",
    minLen: 16,
  },
  {
    key: "UPSTASH_REDIS_REST_URL",
    purpose: "Upstash REST endpoint",
    pattern: /^https:\/\/.+\.upstash\.io$/i,
  },
  {
    key: "UPSTASH_REDIS_REST_TOKEN",
    purpose: "Upstash REST token",
    minLen: 20,
  },
  {
    key: "MDK_ACCESS_TOKEN",
    purpose: "MoneyDevKit account token",
    minLen: 16,
  },
  {
    key: "MDK_MNEMONIC",
    purpose: "MoneyDevKit wallet mnemonic (12-24 words)",
    minWords: 12,
  },
];

const OPTIONAL = [
  { key: "TAVILY_API_KEY", purpose: "/api/search backend" },
  { key: "CURSOR_API_KEY", purpose: "/api/synth backend (optional)" },
  { key: "ACRUX_BASE_PRICE_SATS", purpose: "base price (default 1)" },
  { key: "ACRUX_MAX_SURGE_MULTIPLIER", purpose: "surge cap (default 10000)" },
  { key: "ACRUX_MIN_STAKE_SATS", purpose: "min deposit (default 1000)" },
];

let missing = 0;
let warning = 0;

console.log("\nrequired");
console.log("--------");
for (const spec of REQUIRED) {
  const v = env[spec.key];
  if (!v) {
    missing += 1;
    console.log(`  ✗ ${spec.key.padEnd(28)} missing — ${spec.purpose}`);
    continue;
  }
  if (spec.pattern && !spec.pattern.test(v)) {
    warning += 1;
    console.log(
      `  ! ${spec.key.padEnd(28)} present but does not match ${spec.pattern}`,
    );
    continue;
  }
  if (spec.minLen && v.length < spec.minLen) {
    warning += 1;
    console.log(
      `  ! ${spec.key.padEnd(28)} present but only ${v.length} chars (min ${spec.minLen})`,
    );
    continue;
  }
  if (spec.minWords && v.trim().split(/\s+/).length < spec.minWords) {
    warning += 1;
    console.log(
      `  ! ${spec.key.padEnd(28)} present but only ${v.trim().split(/\s+/).length} words (min ${spec.minWords})`,
    );
    continue;
  }
  const preview = v.length > 16 ? `${v.slice(0, 8)}…${v.slice(-4)}` : "set";
  console.log(`  ✓ ${spec.key.padEnd(28)} ${preview}`);
}

console.log("\noptional");
console.log("--------");
for (const spec of OPTIONAL) {
  const v = env[spec.key];
  if (!v) {
    console.log(`  · ${spec.key.padEnd(28)} unset — ${spec.purpose}`);
  } else {
    const preview = v.length > 16 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v;
    console.log(`  ✓ ${spec.key.padEnd(28)} ${preview}`);
  }
}

if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
  console.log("\nupstash redis ping");
  console.log("------------------");
  await pingRedis(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
}

console.log("");
if (missing === 0 && warning === 0) {
  console.log("ready · pnpm dev to start, then `pnpm demo` to run the dueling bots");
  process.exit(0);
} else {
  if (missing > 0) console.log(`missing: ${missing}`);
  if (warning > 0) console.log(`warnings: ${warning}`);
  process.exit(missing > 0 ? 1 : 0);
}

function parseEnv(src) {
  const out = {};
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function pingRedis(url, token) {
  const started = Date.now();
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 4000);
    const res = await fetch(`${url.replace(/\/$/, "")}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ac.signal,
    });
    clearTimeout(timer);
    const elapsed = Date.now() - started;
    if (!res.ok) {
      console.log(`  ✗ HTTP ${res.status} ${res.statusText} in ${elapsed}ms`);
      const body = await res.text().catch(() => "");
      if (body) console.log(`    ${body.slice(0, 160)}`);
      return;
    }
    const body = await res.json().catch(() => null);
    const reply = body?.result ?? body;
    console.log(`  ✓ PONG in ${elapsed}ms · reply=${JSON.stringify(reply)}`);
  } catch (err) {
    const elapsed = Date.now() - started;
    const aborted = err instanceof Error && err.name === "AbortError";
    console.log(
      `  ✗ ${aborted ? "timeout" : "error"} after ${elapsed}ms · ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
