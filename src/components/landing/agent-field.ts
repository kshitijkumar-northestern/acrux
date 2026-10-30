// Canvas engine behind the landing-page story. Each dot is one agent wallet,
// each accent-colored dash is sats moving on Lightning. Phases never cut between
// scenes: they re-target the same agents (and the camera), so the field
// reshapes as the reader scrolls. Plain imperative code on purpose. The rAF
// loop never touches React state; the Story component only calls setPhase.

export type PhaseId = "hero" | "swarm" | "surge" | "wallet" | "stake" | "live";

export interface FieldCopy {
  // Per-call price at the top of each load band, from the real surge curve.
  surge: ReadonlyArray<{ band: string; sats: number }>;
  // Per-call price for a trusted vs abusive wallet at hot load.
  trusted: { label: string; sats: number };
  abusive: { label: string; sats: number };
}

export interface AgentField {
  setPhase(phase: PhaseId): void;
  setRunning(running: boolean): void;
  resize(): void;
  destroy(): void;
}

// Token mirrors (canvas can't read oklch custom properties reliably).
const FG = "#ededed"; // --foreground
const MUTED = "#888888"; // --muted-foreground
const BG = "#000000"; // --background

const TAU = Math.PI * 2;
const HONEST = 132;
const ATTACKERS = 72;
const MAX_SPARKS = 420;

// Scene units: the API sits at the origin, the honest field spans r ≈ 1.
const ATTACK_CLUSTER = { x: 1.18, y: -0.58 };
const ATTACK_PARK = { x: 2.7, y: -1.5 };
const POOL = { x: 1.08, y: 0.7 };

interface PhaseSpec {
  zoom: number;
  ox: number;
  oy: number;
  heat: number; // API load, drives the ripples
  dim: number; // whole-scene opacity
  honestRate: number; // requests per agent per second
  attackRate: number;
  honestSpark: number; // spark radius in CSS px
  attackSpark: number;
  attackLoad: boolean; // attacker requests drawn as white load streaks
}

const PHASES: Record<PhaseId, PhaseSpec> = {
  hero: { zoom: 1, ox: 0, oy: 0, heat: 0.05, dim: 1, honestRate: 0.06, attackRate: 0, honestSpark: 1.4, attackSpark: 1.4, attackLoad: false },
  swarm: { zoom: 1.04, ox: 0, oy: 0, heat: 0.8, dim: 1, honestRate: 0.05, attackRate: 1.1, honestSpark: 1.4, attackSpark: 1.4, attackLoad: true },
  surge: { zoom: 1.16, ox: 0, oy: 0, heat: 1, dim: 1, honestRate: 0.025, attackRate: 0.28, honestSpark: 2.6, attackSpark: 2.6, attackLoad: false },
  wallet: { zoom: 0.84, ox: 0.32, oy: -0.04, heat: 0.5, dim: 1, honestRate: 0.06, attackRate: 0.22, honestSpark: 1.3, attackSpark: 3.4, attackLoad: false },
  stake: { zoom: 0.84, ox: 0.32, oy: -0.04, heat: 0.25, dim: 1, honestRate: 0.05, attackRate: 0, honestSpark: 1.3, attackSpark: 1.3, attackLoad: false },
  live: { zoom: 1, ox: 0, oy: 0, heat: 0.08, dim: 0.5, honestRate: 0.05, attackRate: 0, honestSpark: 1.3, attackSpark: 1.3, attackLoad: false },
};

// Canvas tags, keyed by id; each fades in only on the phases listed.
type TagId =
  | "price"
  | "trusted-price"
  | "abusive-price"
  | "trusted-yield"
  | "abusive-slash"
  | "pool";

const TAG_PHASES: Record<TagId, PhaseId[]> = {
  price: ["surge"],
  "trusted-price": ["wallet"],
  "abusive-price": ["wallet"],
  "trusted-yield": ["stake"],
  "abusive-slash": ["stake"],
  pool: ["stake"],
};

// Tracer length in scene units (the field spans r ≈ 1).
const TRACE_SAT = 0.07;
const TRACE_LOAD = 0.11;

const SURGE_CLIMB_MS = 3200;
const SLASH_DRAIN_S = 1.8;
const YIELD_DELAY_S = 1.0;
const YIELD_PER_S = 45;

interface Agent {
  attacker: boolean;
  x: number;
  y: number;
  angle: number;
  spin: number;
  band: number;
  gx: number;
  gy: number;
  seed: number;
  ease: number;
  size: number;
  alpha: number;
  ring: number; // 0 filled → 1 hollow (flagged wallet)
  stake: number; // 1 → 0 while being slashed
  glow: number; // yield just received, decays
  nextReq: number;
  drainAt: number;
  nextSlash: number;
}

interface Spark {
  sx: number;
  sy: number;
  to: "api" | "pool" | Agent;
  t: number;
  dur: number;
  size: number;
  load: boolean;
  onArrive?: () => void;
}

const SAT_FMT = new Intl.NumberFormat("en-US");

// Deterministic so the field has the same shape on every visit.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(1e-6, rand());
  const v = rand();
  const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  return Math.max(-2.2, Math.min(2.2, g));
}

function expWait(rate: number): number {
  return rate <= 0 ? Infinity : -Math.log(Math.max(1e-6, Math.random())) / rate;
}

function follow(rate: number, dt: number): number {
  return 1 - Math.exp(-dt * rate);
}

function easeInOut(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export function createAgentField(
  canvas: HTMLCanvasElement,
  opts: { reducedMotion: boolean; copy: FieldCopy },
): AgentField {
  const ctx = canvas.getContext("2d");
  const { reducedMotion, copy } = opts;
  const rand = mulberry32(0xac2b);

  const agents: Agent[] = [];
  for (let i = 0; i < HONEST + ATTACKERS; i++) {
    const attacker = i >= HONEST;
    agents.push({
      attacker,
      x: 0,
      y: 0,
      angle: rand() * TAU,
      // Attackers circle faster and twitchier: the only tell before reveal.
      spin: attacker ? 0.12 + rand() * 0.1 : 0.035 + rand() * 0.04,
      band: Math.pow(rand(), 0.8),
      gx: gaussian(rand),
      gy: gaussian(rand),
      seed: rand() * TAU,
      ease: attacker ? 1.1 + rand() * 1.4 : 1.4 + rand() * 1.2,
      size: 1.3 + rand() * 1.1,
      alpha: 0,
      ring: 0,
      stake: 1,
      glow: 0,
      nextReq: 0,
      drainAt: 0,
      nextSlash: 0,
    });
  }
  const honest = agents.filter((a) => !a.attacker);
  const attackers = agents.filter((a) => a.attacker);

  let sparks: Spark[] = [];
  let phase: PhaseId = "hero";
  let phaseAt = performance.now();
  let pool = 0;
  let poolShown = 0;
  let yieldTimer = 0;
  let apiFlash = 0; // sats just landed at the API, decays
  const cam = { ...pick(PHASES.hero) };
  const tagAlpha: Record<TagId, number> = {
    price: 0,
    "trusted-price": 0,
    "abusive-price": 0,
    "trusted-yield": 0,
    "abusive-slash": 0,
    pool: 0,
  };

  let width = 0;
  let height = 0;
  let raf = 0;
  let running = false;
  let destroyed = false;
  let last = 0;
  let mono = "ui-monospace, monospace";
  // Accent for sats, read from the --lightning token on resize.
  let SAT = "#d3ff01";

  function pick(s: PhaseSpec) {
    return { zoom: s.zoom, ox: s.ox, oy: s.oy, heat: s.heat, dim: s.dim };
  }

  function viewport() {
    const desktop = width >= 1024;
    return desktop
      ? { cx: width * 0.68, cy: height * 0.53, r: Math.min(width * 0.23, height * 0.34) }
      : { cx: width * 0.5, cy: height * 0.31, r: Math.min(width * 0.38, height * 0.21) };
  }

  function target(a: Agent, t: number) {
    if (!a.attacker) {
      const r = 0.4 + a.band * 0.6;
      return { x: Math.cos(a.angle) * r, y: Math.sin(a.angle) * r * 0.82, alpha: 0.88, ring: 0 };
    }
    switch (phase) {
      case "swarm":
      case "surge": {
        const r = 0.34 + a.band * 0.62 + 0.025 * Math.sin(t * 5 + a.seed);
        return { x: Math.cos(a.angle) * r, y: Math.sin(a.angle) * r * 0.82, alpha: 0.88, ring: 0 };
      }
      case "wallet":
      case "stake": {
        const spin = t * 0.25;
        const c = Math.cos(spin);
        const s = Math.sin(spin);
        const lx = (a.gx * c - a.gy * s) * 0.13;
        const ly = (a.gx * s + a.gy * c) * 0.13;
        const alpha = phase === "stake" ? 0.25 + 0.65 * a.stake : 0.88;
        return { x: ATTACK_CLUSTER.x + lx, y: ATTACK_CLUSTER.y + ly, alpha, ring: 1 };
      }
      default:
        return {
          x: ATTACK_PARK.x + a.gx * 0.35,
          y: ATTACK_PARK.y + a.gy * 0.35,
          alpha: 0,
          ring: phase === "live" ? 1 : 0,
        };
    }
  }

  function reschedule() {
    const spec = PHASES[phase];
    for (const a of agents) {
      a.nextReq = expWait(a.attacker ? spec.attackRate : spec.honestRate);
    }
  }

  function spawn(spark: Spark) {
    if (sparks.length < MAX_SPARKS) sparks.push(spark);
  }

  function surgeReadout(now: number) {
    const ladder = copy.surge;
    const p = reducedMotion ? 1 : Math.min(1, (now - phaseAt) / SURGE_CLIMB_MS);
    const f = (p * p * (3 - 2 * p)) * (ladder.length - 1);
    const i = Math.min(ladder.length - 2, Math.floor(f));
    const frac = f - i;
    const lo = Math.log(ladder[i].sats);
    const hi = Math.log(ladder[i + 1].sats);
    const sats = Math.round(Math.exp(lo + (hi - lo) * frac));
    // Ladder entries are the top of each band, so a price between two
    // entries belongs to the upper band.
    const index = Math.min(ladder.length - 1, Math.ceil(f - 1e-3));
    return { sats, band: ladder[index].band };
  }

  function step(now: number, dt: number, snap: boolean) {
    const spec = PHASES[phase];
    const t = now / 1000;
    const k = snap ? 1 : follow(2.2, dt);
    cam.zoom += (spec.zoom - cam.zoom) * k;
    cam.ox += (spec.ox - cam.ox) * k;
    cam.oy += (spec.oy - cam.oy) * k;
    cam.heat += (spec.heat - cam.heat) * k;
    cam.dim += (spec.dim - cam.dim) * k;

    apiFlash *= Math.exp(-dt * 6);

    const tk = snap ? 1 : follow(3, dt);
    for (const id of Object.keys(tagAlpha) as TagId[]) {
      const goal = TAG_PHASES[id].includes(phase) ? 1 : 0;
      tagAlpha[id] += (goal - tagAlpha[id]) * tk;
    }

    const elapsed = (now - phaseAt) / 1000;
    for (const a of agents) {
      if (!snap) a.angle += a.spin * dt;
      if (a.attacker) {
        if (phase === "stake") {
          if (snap) a.stake = 0;
          else if (elapsed > a.drainAt && a.stake > 0) {
            a.stake = Math.max(0, a.stake - dt / SLASH_DRAIN_S);
            a.nextSlash -= dt;
            if (a.nextSlash <= 0) {
              a.nextSlash = 0.5 + Math.random() * 0.5;
              spawn({
                sx: a.x,
                sy: a.y,
                to: "pool",
                t: 0,
                dur: 0.9 + Math.random() * 0.4,
                size: 1.8,
                load: false,
                onArrive: () => {
                  pool += 1;
                },
              });
            }
          }
        } else {
          a.stake += (1 - a.stake) * (snap ? 1 : follow(2, dt));
        }
      }
      const goal = target(a, t);
      const f = snap ? 1 : follow(a.ease, dt);
      a.x += (goal.x - a.x) * f;
      a.y += (goal.y - a.y) * f;
      a.alpha += (goal.alpha - a.alpha) * (snap ? 1 : follow(1.8, dt));
      a.ring += (goal.ring - a.ring) * (snap ? 1 : follow(2.4, dt));
      a.glow *= Math.exp(-dt * 1.8);

      if (snap) continue;
      a.nextReq -= dt;
      if (a.nextReq <= 0) {
        const rate = a.attacker ? spec.attackRate : spec.honestRate;
        a.nextReq = expWait(rate);
        if (a.alpha > 0.3) {
          spawn({
            sx: a.x,
            sy: a.y,
            to: "api",
            t: 0,
            dur: 0.8 + Math.random() * 0.5,
            size: a.attacker ? spec.attackSpark : spec.honestSpark,
            load: a.attacker && spec.attackLoad,
          });
        }
      }
    }

    // Slashed sats fill the pool, then the pool pays trusted agents back.
    if (phase === "stake" && !snap && elapsed > YIELD_DELAY_S) {
      yieldTimer -= dt;
      while (yieldTimer <= 0 && pool >= 1) {
        yieldTimer += 1 / YIELD_PER_S;
        pool -= 1;
        const to = honest[Math.floor(Math.random() * honest.length)];
        spawn({
          sx: POOL.x,
          sy: POOL.y,
          to,
          t: 0,
          dur: 1 + Math.random() * 0.6,
          size: 1.6,
          load: false,
          onArrive: () => {
            to.glow = 1;
          },
        });
      }
      if (pool < 1) yieldTimer = 0;
    }
    if (phase !== "stake") pool = 0;
    poolShown += (pool - poolShown) * (snap ? 1 : follow(6, dt));

    if (snap) {
      sparks = [];
      return;
    }
    const next: Spark[] = [];
    for (const s of sparks) {
      s.t += dt / s.dur;
      if (s.t < 1) {
        next.push(s);
        continue;
      }
      if (s.to === "api" && !s.load) apiFlash = Math.min(1, apiFlash + 0.3);
      s.onArrive?.();
    }
    sparks = next;
  }

  function sparkEnd(s: Spark) {
    if (s.to === "api") return { x: 0, y: 0 };
    if (s.to === "pool") return POOL;
    return s.to;
  }

  function draw(now: number) {
    if (!ctx) return;
    const { cx, cy, r } = viewport();
    // Phones have little room above the copy, so the camera never zooms in.
    const scale = r * (width >= 1024 ? cam.zoom : Math.min(1, cam.zoom));
    const px = (x: number) => cx + (x - cam.ox) * scale;
    const py = (y: number) => cy + (y - cam.oy) * scale;

    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    const dim = cam.dim;

    // API load ripples.
    const ax = px(0);
    const ay = py(0);
    const period = 2.4 - 1.6 * cam.heat;
    const reach = 22 + 70 * cam.heat;
    ctx.lineWidth = 1;
    ctx.strokeStyle = FG;
    for (let i = 0; i < 3; i++) {
      const p = reducedMotion ? (i + 1) / 4 : ((now / 1000 / period + i / 3) % 1);
      ctx.globalAlpha = (1 - p) * (0.06 + 0.3 * cam.heat) * dim;
      ctx.beginPath();
      ctx.arc(ax, ay, 7 + p * reach, 0, TAU);
      ctx.stroke();
    }

    // Agents.
    for (const a of agents) {
      if (a.alpha < 0.01) continue;
      const x = px(a.x);
      const y = py(a.y);
      const size = a.attacker ? a.size * (0.55 + 0.45 * a.stake) : a.size;
      const alpha = a.alpha * dim;
      if (a.glow > 0.02) {
        ctx.globalAlpha = 0.3 * a.glow * dim;
        ctx.fillStyle = SAT;
        ctx.beginPath();
        ctx.arc(x, y, size * 3.2, 0, TAU);
        ctx.fill();
      }
      if (a.ring < 0.99) {
        ctx.globalAlpha = alpha * (1 - a.ring);
        ctx.fillStyle = FG;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, TAU);
        ctx.fill();
      }
      if (a.ring > 0.01) {
        ctx.globalAlpha = alpha * a.ring;
        ctx.strokeStyle = FG;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, size + 1.6, 0, TAU);
        ctx.stroke();
      }
    }

    // Requests in flight, drawn as plain straight dashes of fixed length and
    // even width: white is raw load, accent is paid sats. No head, no taper;
    // each dash fades in as it leaves and out as it lands.
    ctx.lineCap = "butt";
    for (const s of sparks) {
      const end = sparkEnd(s);
      const dx = end.x - s.sx;
      const dy = end.y - s.sy;
      const len = Math.hypot(dx, dy) || 1;
      const head = easeInOut(s.t);
      const tail = Math.max(0, head - (s.load ? TRACE_LOAD : TRACE_SAT) / len);
      const hx = px(s.sx + dx * head);
      const hy = py(s.sy + dy * head);
      const tx = px(s.sx + dx * tail);
      const ty = py(s.sy + dy * tail);
      const fade = Math.max(0, Math.min(1, s.t / 0.12, (1 - s.t) / 0.15));
      ctx.globalAlpha = (s.load ? 0.45 : 1) * fade * dim;
      ctx.strokeStyle = s.load ? FG : SAT;
      // Hairlines; pricier calls (surge, abusive wallets) a touch heavier.
      ctx.lineWidth = !s.load && s.size >= 2.5 ? 0.75 : 0.5;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }

    // API node: a ring with a round core.
    ctx.globalAlpha = dim;
    ctx.fillStyle = BG;
    ctx.beginPath();
    ctx.arc(ax, ay, 7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = FG;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = FG;
    ctx.beginPath();
    ctx.arc(ax, ay, 2, 0, TAU);
    ctx.fill();
    if (apiFlash > 0.02) {
      // Paid calls landing: the core warms to the accent.
      ctx.globalAlpha = apiFlash * dim;
      ctx.fillStyle = SAT;
      ctx.beginPath();
      ctx.arc(ax, ay, 2 + apiFlash * 1.5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = dim;
    }

    tag(ax, ay + 19, [["api", MUTED]], dim, "center");

    // Slash pool: a fixed ring like the API node; only the accent core grows
    // as slashed sats arrive, and it stays inside the ring.
    const poolVis = tagAlpha.pool;
    if (poolVis > 0.01) {
      const qx = px(POOL.x);
      const qy = py(POOL.y);
      const ring = 9;
      const fill = Math.min(ring - 3, Math.sqrt(Math.max(0, poolShown)) * 0.75);
      ctx.globalAlpha = poolVis * dim;
      ctx.fillStyle = BG;
      ctx.beginPath();
      ctx.arc(qx, qy, ring, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = FG;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (fill > 0.5) {
        ctx.fillStyle = SAT;
        ctx.beginPath();
        ctx.arc(qx, qy, fill, 0, TAU);
        ctx.fill();
      }
      tag(qx, qy + ring + 12, [["pool", MUTED]], poolVis * dim, "center");
    }

    // Tags.
    if (tagAlpha.price > 0.01) {
      const read = surgeReadout(now);
      tag(ax + 24, ay - 34, [
        [`${SAT_FMT.format(read.sats)} sat/call`, SAT],
        [`${read.band} load`, MUTED],
      ], tagAlpha.price * dim, "left");
    }
    // Cluster tags sit above the field; on phones there is no room for them
    // under the legend, and the panel table right below repeats the numbers.
    const clusterTags = width >= 640 ? dim : 0;
    const hx = px(0);
    const hy = py(-0.98);
    const kx = px(ATTACK_CLUSTER.x);
    const ky = py(ATTACK_CLUSTER.y - 0.44);
    tag(hx, hy, [
      [copy.trusted.label, MUTED],
      [`${SAT_FMT.format(copy.trusted.sats)} sat/call`, SAT],
    ], tagAlpha["trusted-price"] * clusterTags, "center");
    tag(kx, ky, [
      [copy.abusive.label, MUTED],
      [`${SAT_FMT.format(copy.abusive.sats)} sat/call`, SAT],
    ], tagAlpha["abusive-price"] * clusterTags, "center");
    tag(hx, hy, [
      ["trusted", MUTED],
      ["earning yield", SAT],
    ], tagAlpha["trusted-yield"] * clusterTags, "center");
    tag(kx, ky, [
      ["abusive", MUTED],
      ["stake slashed", FG],
    ], tagAlpha["abusive-slash"] * clusterTags, "center");

    ctx.globalAlpha = 1;
  }

  function tag(
    x: number,
    y: number,
    lines: Array<[string, string]>,
    alpha: number,
    align: CanvasTextAlign,
  ) {
    if (!ctx || alpha < 0.01) return;
    ctx.globalAlpha = alpha;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    lines.forEach(([text, color], i) => {
      ctx.font = `${i === 0 && lines.length > 1 ? 11 : 10}px ${mono}`;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y + i * 15 - ((lines.length - 1) * 15) / 2);
    });
  }

  function tick(now: number) {
    if (!running || destroyed) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    step(now, dt, false);
    draw(now);
    raf = requestAnimationFrame(tick);
  }

  function renderStatic() {
    const now = performance.now();
    step(now, 0, true);
    draw(now);
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rootStyle = getComputedStyle(document.documentElement);
    mono = rootStyle.getPropertyValue("--font-geist-mono").trim() || mono;
    SAT = rootStyle.getPropertyValue("--lightning").trim() || SAT;
    if (reducedMotion) renderStatic();
    else if (!running) draw(performance.now());
  }

  if (reducedMotion) {
    resize();
  } else {
    // Intro: every agent starts beyond the field, invisible, and eases into
    // its orbit once the loop starts. Agents coming online.
    const now = performance.now() / 1000;
    for (const a of agents) {
      const goal = target(a, now);
      const spread = 1.7 + Math.random() * 0.8;
      a.x = goal.x * spread;
      a.y = goal.y * spread;
    }
    resize();
  }
  reschedule();
  document.fonts?.ready.then(() => {
    if (!destroyed && (reducedMotion || !running)) draw(performance.now());
  });

  return {
    setPhase(next) {
      if (next === phase) return;
      phase = next;
      phaseAt = performance.now();
      if (next === "stake") {
        pool = 0;
        yieldTimer = 0;
        for (const a of attackers) {
          a.drainAt = Math.random() * 1.4;
          a.nextSlash = Math.random() * 0.3;
        }
      }
      reschedule();
      if (reducedMotion || !running) renderStatic();
    },
    setRunning(next) {
      if (reducedMotion || destroyed || next === running) return;
      running = next;
      cancelAnimationFrame(raf);
      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    },
    resize,
    destroy() {
      destroyed = true;
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
