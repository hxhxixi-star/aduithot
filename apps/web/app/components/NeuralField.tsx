import { useEffect, useRef } from "react";

/**
 * The board's backdrop: a neural web creeping out from behind the page, silver nodes strung on
 * hairline links, champagne pulses running along them in both directions.
 *
 * It is decoration only (aria-hidden, pointer-events-none) and paints on its own canvas behind the
 * shell, so a page that scrolls never has to re-render it. Pauses when the tab is hidden, draws a
 * single still frame for readers who ask for reduced motion.
 */

type Palette = {
  node: string;
  hub: string;
  link: string;
  pulse: string;
  /** Overall strength, since the same web reads louder on a black board than on paper. */
  strength: number;
};

const PALETTE: Record<"light" | "dark", Palette> = {
  dark: { node: "236, 236, 232", hub: "230, 207, 152", link: "214, 216, 208", pulse: "240, 219, 168", strength: 0.82 },
  light: { node: "74, 76, 72", hub: "138, 106, 47", link: "52, 54, 50", pulse: "138, 106, 47", strength: 0.38 },
};

type Node = {
  /** Resting position in unit space, relative to the web's origin. */
  x: number;
  y: number;
  depth: number;
  r: number;
  seed: number;
  hub: boolean;
};

type Link = { a: number; b: number; seed: number; both: boolean };

function glow(rgb: string): HTMLCanvasElement {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, `rgba(${rgb},1)`);
    g.addColorStop(0.28, `rgba(${rgb},0.42)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return canvas;
}

/** Units are the same everywhere: 1 is the web's outer radius. */
function build(width: number, height: number): { nodes: Node[]; links: Link[] } {
  const area = width * height;
  const count = Math.round(Math.min(84, Math.max(26, area / 24000)));
  const nodes: Node[] = [];
  const rand = mulberry(0x5eed + Math.round(width));

  for (let i = 0; i < count; i += 1) {
    // Four rings around a hollow core, so the web reads as spreading outward.
    const depth = 1 + Math.floor(rand() * 4);
    const angle = rand() * Math.PI * 2;
    const radius = 0.2 + (depth - 1) * 0.2 + rand() * 0.14;
    nodes.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.9,
      depth,
      r: depth === 1 ? 2.6 : 1.3 + rand() * 1.3,
      seed: rand(),
      hub: depth === 1,
    });
  }
  // One bright seed at the centre, the point everything spreads from.
  nodes.push({ x: 0, y: 0, depth: 0, r: 3.2, seed: 0.37, hub: true });

  // Each node hangs off its nearest inner neighbour; a few skip a ring for depth.
  const links: Link[] = [];
  const seen = new Set<string>();
  const connect = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (a === b || seen.has(key)) return;
    seen.add(key);
    links.push({ a, b, seed: rand(), both: rand() > 0.55 });
  };
  nodes.forEach((node, i) => {
    if (node.depth === 0) {
      nodes.forEach((other, j) => {
        if (other.depth === 1) connect(i, j);
      });
      return;
    }
    let best = -1;
    let bestD = Infinity;
    nodes.forEach((other, j) => {
      if (other.depth >= node.depth || j === i) return;
      const d = (other.x - node.x) ** 2 + (other.y - node.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    });
    if (best >= 0) connect(best, i);
    if (rand() > 0.62) {
      const near = nodes.findIndex((other, j) => j !== i && other.depth === node.depth && Math.hypot(other.x - node.x, other.y - node.y) < 0.22);
      if (near >= 0) connect(i, near);
    }
  });

  return { nodes, links };
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function NeuralField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let links: Link[] = [];
    let frame = 0;
    let running = true;
    let started = 0;
    let still = reducedMotion();

    let sprites = { node: glow(PALETTE.dark.node), hub: glow(PALETTE.dark.hub), pulse: glow(PALETTE.dark.pulse) };
    let tone: "light" | "dark" = "dark";

    const readTone = () => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
      if (next !== tone) {
        tone = next;
        sprites = { node: glow(PALETTE[tone].node), hub: glow(PALETTE[tone].hub), pulse: glow(PALETTE[tone].pulse) };
      }
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      const built = build(width, height);
      nodes = built.nodes;
      links = built.links;
      if (still) draw(0);
    };

    const draw = (now: number) => {
      const t = still ? 0 : (now - started) / 1000;
      const palette = PALETTE[tone];
      const s = palette.strength;

      // The web spreads from behind the orb (the stage's light source) rather than from the reading
      // column: on wide screens that is the right two thirds, on phones the middle of the page.
      const cx = width > 900 ? width * 0.7 : width * 0.5;
      const cy = height * 0.38;
      const scale = Math.min(width * 0.52, height * 0.62) * (1 + Math.sin(t * 0.22) * 0.012);
      const rotate = t * 0.012;

      const cos = Math.cos(rotate);
      const sin = Math.sin(rotate);
      const xs = new Float32Array(nodes.length);
      const ys = new Float32Array(nodes.length);
      nodes.forEach((node, i) => {
        const sway = Math.sin(t * 0.42 + node.seed * 6.28) * 0.008;
        const px = node.x * (1 + sway);
        const py = node.y * (1 + sway);
        xs[i] = cx + (px * cos - py * sin) * scale;
        ys[i] = cy + (px * sin + py * cos) * scale;
      });

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Links: hairline, fading toward the rim so the web melts into the page.
      ctx.lineWidth = 1;
      for (const link of links) {
        const a = nodes[link.a];
        const b = nodes[link.b];
        const depthFall = 1 - Math.min(a.depth, b.depth) / 5.4;
        ctx.strokeStyle = `rgba(${palette.link},${(link.both ? 0.15 : 0.075) * depthFall * s})`;
        ctx.beginPath();
        ctx.moveTo(xs[link.a], ys[link.a]);
        ctx.lineTo(xs[link.b], ys[link.b]);
        ctx.stroke();
      }

      if (!still) {
        ctx.globalCompositeOperation = "lighter";
        for (const link of links) {
          const speed = link.both ? 0.1 : 0.075;
          const lanes = link.both ? [0, 1] : [0];
          for (const lane of lanes) {
            const u = (t * speed + link.seed + lane * 0.5) % 1;
            const from = lane === 0 ? link.a : link.b;
            const to = lane === 0 ? link.b : link.a;
            const x = xs[from] + (xs[to] - xs[from]) * u;
            const y = ys[from] + (ys[to] - ys[from]) * u;
            const fade = Math.sin(u * Math.PI);
            const size = 9;
            ctx.globalAlpha = fade * 0.85 * s;
            ctx.drawImage(sprites.pulse, x - size, y - size, size * 2, size * 2);
          }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      // Nodes: a soft halo plus a solid core, brighter toward the centre.
      nodes.forEach((node, i) => {
        const fall = 1 - node.depth / 6.2;
        const breathe = still ? 1 : 0.86 + Math.sin(t * 0.9 + node.seed * 9) * 0.14;
        const alpha = fall * breathe * s;
        const halo = node.r * (node.hub ? 9 : 6);
        ctx.globalAlpha = alpha * 0.55;
        ctx.drawImage(node.hub ? sprites.hub : sprites.node, xs[i] - halo, ys[i] - halo, halo * 2, halo * 2);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = node.hub ? `rgb(${palette.hub})` : `rgb(${palette.node})`;
        ctx.beginPath();
        ctx.arc(xs[i], ys[i], node.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      if (!running) return;
      frame = requestAnimationFrame(tick);
      try {
        draw(now);
      } catch {
        running = false;
      }
    };

    readTone();
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      still = motion.matches;
      if (still) {
        cancelAnimationFrame(frame);
        draw(0);
      } else if (running && !document.hidden) {
        started = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    motion.addEventListener("change", onMotion);

    const themeObserver = new MutationObserver(() => {
      readTone();
      if (still) draw(0);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
      } else if (!still) {
        started = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (!still) {
      started = performance.now();
      frame = requestAnimationFrame(tick);
    } else {
      draw(0);
    }

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      themeObserver.disconnect();
      motion.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={`neural-field pointer-events-none fixed inset-0 -z-10 h-dvh w-full ${className}`} />;
}
