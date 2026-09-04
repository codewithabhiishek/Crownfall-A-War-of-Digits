// ── CROWNFALL renderer — everything is drawn, nothing is an image ─────────────
import { N, type GameState, type Pos, type MoveTarget, type Side } from "./engine";

export interface ViewState {
  screen: "menu" | "play";
  selected: Pos | null;
  moveTargets: MoveTarget[];
  deployDots: Pos[];
  hover: Pos | null;
  turn: Side;
  mustCrown: boolean;
  paused: boolean;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string; grav: number;
}
interface FloatText {
  x: number; y: number; text: string; color: string; life: number; max: number; big: boolean;
}
interface Ghost {
  x: number; y: number; value: number; color: string; life: number; max: number;
}
interface Mote {
  x: number; y: number; r: number; sp: number; a: number; hue: string;
}

const GOLD_A = "#ffe9a3";
const GOLD_B = "#ffc93c";
const GOLD_C = "#8a5a00";
const RED_A = "#ffb3b3";
const RED_B = "#ff4757";
const RED_C = "#6e0a18";
const INK = "#1b0d00";
const INK_RED = "#2b040a";

export class Renderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private last = 0;
  private time = 0;
  private ro: ResizeObserver | null = null;

  state: GameState | null = null;
  view: ViewState = {
    screen: "menu",
    selected: null,
    moveTargets: [],
    deployDots: [],
    hover: null,
    turn: 0,
    mustCrown: false,
    paused: false,
  };

  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private ghosts: Ghost[] = [];
  private motes: Mote[] = [];
  private anims = new Map<number, { x: number; y: number; s: number }>();
  private shakeT = 0;
  private shakeMag = 0;
  private flashA = 0;
  private flashColor = "255,255,255";

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    for (let i = 0; i < 42; i++) {
      this.motes.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.6 + Math.random() * 1.8,
        sp: 0.008 + Math.random() * 0.02,
        a: 0.05 + Math.random() * 0.16,
        hue: Math.random() < 0.5 ? "53,240,255" : "255,201,60",
      });
    }
    this.ro = new ResizeObserver(() => this.resize());
    if (canvas.parentElement) this.ro.observe(canvas.parentElement);
    this.resize();
    this.last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.time += dt;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
  }

  private resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = parent.clientWidth;
    this.h = parent.clientHeight;
    this.canvas.width = Math.max(1, Math.floor(this.w * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.h * this.dpr));
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }

  // ── layout ──────────────────────────────────────────────────────────────────
  layout() {
    const pad = 18;
    const cell = Math.max(20, Math.floor(Math.min((this.w - pad * 2) / N, (this.h - pad * 2) / N)));
    const board = cell * N;
    return { cell, board, ox: (this.w - board) / 2, oy: (this.h - board) / 2 };
  }

  cellCenter(r: number, c: number) {
    const { cell, ox, oy } = this.layout();
    return { x: ox + c * cell + cell / 2, y: oy + r * cell + cell / 2 };
  }

  cellAt(x: number, y: number): Pos | null {
    const { cell, ox, oy } = this.layout();
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (r < 0 || r >= N || c < 0 || c >= N) return null;
    return { r, c };
  }

  // ── fx api ──────────────────────────────────────────────────────────────────
  burst(r: number, c: number, color: string, n = 18, speed = 170) {
    const { x, y } = this.cellCenter(r, c);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.75);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 40,
        life: 0.5 + Math.random() * 0.45,
        max: 0.95,
        size: 1.5 + Math.random() * 3,
        color,
        grav: 260,
      });
    }
  }

  dust(r: number, c: number, color: string, n = 10) {
    const { x, y } = this.cellCenter(r, c);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * 60;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.35 + Math.random() * 0.3,
        max: 0.65,
        size: 1 + Math.random() * 2,
        color,
        grav: 30,
      });
    }
  }

  confetti(winner: Side | -1) {
    const colors =
      winner === 0
        ? ["#ffc93c", "#ffdf7e", "#35f0ff", "#ffffff"]
        : winner === 1
          ? ["#ff4757", "#ff8a94", "#7a2030", "#ffffff"]
          : ["#35f0ff", "#8fb8b3", "#ffffff"];
    for (let i = 0; i < 130; i++) {
      this.particles.push({
        x: Math.random() * this.w,
        y: -10 - Math.random() * this.h * 0.3,
        vx: (Math.random() - 0.5) * 120,
        vy: 120 + Math.random() * 200,
        life: 1.6 + Math.random() * 1.4,
        max: 3,
        size: 2 + Math.random() * 3.5,
        color: colors[i % colors.length],
        grav: 60,
      });
    }
  }

  floatText(r: number, c: number, text: string, color: string, big = false) {
    const { x, y } = this.cellCenter(r, c);
    this.texts.push({ x, y: y - 8, text, color, life: big ? 1.3 : 1, max: big ? 1.3 : 1, big });
  }

  ghost(r: number, c: number, value: number, color: string) {
    const { x, y } = this.cellCenter(r, c);
    this.ghosts.push({ x, y, value, color, life: 0.45, max: 0.45 });
  }

  shake(mag: number) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = 1;
  }

  flash(rgb: string, a: number) {
    this.flashColor = rgb;
    this.flashA = Math.max(this.flashA, a);
  }

  resetFx() {
    this.particles = [];
    this.texts = [];
    this.ghosts = [];
    this.anims.clear();
    this.shakeT = 0;
    this.flashA = 0;
  }

  // ── update ──────────────────────────────────────────────────────────────────
  private update(dt: number) {
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= 0.985;
      return p.life > 0;
    });
    this.texts = this.texts.filter((t) => {
      t.life -= dt;
      t.y -= 34 * dt;
      return t.life > 0;
    });
    this.ghosts = this.ghosts.filter((g) => {
      g.life -= dt;
      return g.life > 0;
    });
    this.shakeT = Math.max(0, this.shakeT - dt * 2.6);
    this.flashA = Math.max(0, this.flashA - dt * 2.2);

    for (const m of this.motes) {
      m.y -= m.sp * dt;
      if (m.y < -0.02) {
        m.y = 1.02;
        m.x = Math.random();
      }
    }

    // piece position easing
    if (this.state) {
      const { cell, ox, oy } = this.layout();
      const seen = new Set<number>();
      for (const p of this.state.pieces) {
        seen.add(p.id);
        const tx = ox + p.c * cell + cell / 2;
        const ty = oy + p.r * cell + cell / 2;
        let a = this.anims.get(p.id);
        if (!a) {
          a = { x: tx, y: ty, s: 0.2 };
          this.anims.set(p.id, a);
        }
        const k = Math.min(1, dt * 13);
        a.x += (tx - a.x) * k;
        a.y += (ty - a.y) * k;
        a.s += (1 - a.s) * Math.min(1, dt * 10);
      }
      for (const id of [...this.anims.keys()]) if (!seen.has(id)) this.anims.delete(id);
    }
  }

  // ── draw ────────────────────────────────────────────────────────────────────
  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    for (const m of this.motes) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${m.hue},${m.a})`;
      ctx.arc(m.x * this.w, m.y * this.h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const { cell, board, ox, oy } = this.layout();
    const shx = this.shakeT > 0 ? (Math.random() - 0.5) * this.shakeMag * this.shakeT : 0;
    const shy = this.shakeT > 0 ? (Math.random() - 0.5) * this.shakeMag * this.shakeT : 0;
    ctx.save();
    ctx.translate(shx, shy);

    this.drawBoard(ctx, cell, board, ox, oy);
    if (this.state) this.drawPieces(ctx, cell);
    this.drawGhosts(ctx, cell);
    this.drawParticles(ctx);
    this.drawTexts(ctx);
    ctx.restore();

    if (this.flashA > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flashA * 0.55})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  private drawBoard(ctx: CanvasRenderingContext2D, cell: number, board: number, ox: number, oy: number) {
    const v = this.view;
    const g = ctx.createRadialGradient(
      ox + board / 2, oy + board / 2, board * 0.1,
      ox + board / 2, oy + board / 2, board * 0.75,
    );
    g.addColorStop(0, "rgba(53,240,255,0.07)");
    g.addColorStop(1, "rgba(53,240,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(ox - 40, oy - 40, board + 80, board + 80);

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = ox + c * cell;
        const y = oy + r * cell;
        const dark = (r + c) % 2 === 0;
        ctx.fillStyle = dark ? "#0a2831" : "#0e3540";
        ctx.fillRect(x, y, cell, cell);
        if (r >= N - 2) {
          ctx.fillStyle = "rgba(255,201,60,0.06)";
          ctx.fillRect(x, y, cell, cell);
        } else if (r <= 1) {
          ctx.fillStyle = "rgba(255,71,87,0.06)";
          ctx.fillRect(x, y, cell, cell);
        }
      }
    }

    ctx.strokeStyle = "rgba(53,240,255,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      ctx.moveTo(ox + i * cell + 0.5, oy);
      ctx.lineTo(ox + i * cell + 0.5, oy + board);
      ctx.moveTo(ox, oy + i * cell + 0.5);
      ctx.lineTo(ox + board, oy + i * cell + 0.5);
    }
    ctx.stroke();

    const turnCol = v.turn === 0 ? "255,201,60" : "255,71,87";
    const pulse = 0.35 + 0.15 * Math.sin(this.time * 3);
    ctx.strokeStyle = `rgba(${turnCol},${this.state ? pulse : 0.25})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 3, oy - 3, board + 6, board + 6);
    ctx.strokeStyle = `rgba(${turnCol},0.9)`;
    ctx.lineWidth = 3;
    const L = 16;
    const corners: [number, number, number, number][] = [
      [ox - 3, oy - 3, 1, 1],
      [ox + board + 3, oy - 3, -1, 1],
      [ox - 3, oy + board + 3, 1, -1],
      [ox + board + 3, oy + board + 3, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * L, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * L);
      ctx.stroke();
    }

    if (!this.state) return;

    const lm = this.state.lastMove;
    if (lm) {
      const col = this.state.turn === 0 ? "255,71,87" : "255,201,60";
      const a = 0.12 + 0.05 * Math.sin(this.time * 4);
      if (lm.from) {
        ctx.fillStyle = `rgba(${col},${a * 0.6})`;
        ctx.fillRect(ox + lm.from.c * cell, oy + lm.from.r * cell, cell, cell);
      }
      ctx.fillStyle = `rgba(${col},${a})`;
      ctx.fillRect(ox + lm.to.c * cell, oy + lm.to.r * cell, cell, cell);
    }

    if (v.mustCrown) {
      const a = 0.08 + 0.06 * Math.sin(this.time * 5);
      ctx.fillStyle = `rgba(255,201,60,${a})`;
      for (let r = N - 2; r < N; r++)
        for (let c = 0; c < N; c++) ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
    }

    if (v.hover && !v.paused) {
      ctx.strokeStyle = "rgba(232,255,250,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + v.hover.c * cell + 2, oy + v.hover.r * cell + 2, cell - 4, cell - 4);
    }

    if (v.deployDots.length > 0) {
      const a = 0.45 + 0.3 * Math.sin(this.time * 5);
      ctx.fillStyle = `rgba(255,201,60,${a})`;
      for (const d of v.deployDots) {
        const cx = ox + d.c * cell + cell / 2;
        const cy = oy + d.r * cell + cell / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const t of v.moveTargets) {
      const cx = ox + t.c * cell + cell / 2;
      const cy = oy + t.r * cell + cell / 2;
      if (t.capture) {
        const a = 0.55 + 0.35 * Math.sin(this.time * 6);
        ctx.strokeStyle = `rgba(255,71,87,${a})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          const ang = (Math.PI / 2) * k + Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * cell * 0.34, cy + Math.sin(ang) * cell * 0.34);
          ctx.lineTo(cx + Math.cos(ang) * cell * 0.46, cy + Math.sin(ang) * cell * 0.46);
          ctx.stroke();
        }
      } else {
        const a = 0.4 + 0.3 * Math.sin(this.time * 5);
        ctx.fillStyle = `rgba(53,240,255,${a})`;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (v.selected) {
      ctx.strokeStyle = "rgba(255,223,126,0.9)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -this.time * 26;
      ctx.strokeRect(ox + v.selected.c * cell + 2.5, oy + v.selected.r * cell + 2.5, cell - 5, cell - 5);
      ctx.setLineDash([]);
    }
  }

  private drawPieces(ctx: CanvasRenderingContext2D, cell: number) {
    if (!this.state) return;
    const v = this.view;
    const r0 = cell * 0.36;
    const sorted = [...this.state.pieces].sort((a, b) => a.r - b.r);
    for (const p of sorted) {
      const a = this.anims.get(p.id) ?? { x: 0, y: 0, s: 1 };
      const hovered = v.hover && v.hover.r === p.r && v.hover.c === p.c && !v.paused;
      const selected = v.selected && v.selected.r === p.r && v.selected.c === p.c;
      const scale = a.s * (hovered && p.side === 0 && v.turn === 0 ? 1.07 : 1);
      const rad = r0 * scale;
      const x = a.x;
      const y = a.y;

      // shadow
      ctx.beginPath();
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.ellipse(x, y + rad * 0.82, rad * 0.85, rad * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      // body
      const grad = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.15, x, y, rad);
      if (p.side === 0) {
        grad.addColorStop(0, GOLD_A);
        grad.addColorStop(0.62, GOLD_B);
        grad.addColorStop(1, "#c78f10");
      } else {
        grad.addColorStop(0, RED_A);
        grad.addColorStop(0.62, RED_B);
        grad.addColorStop(1, "#c22536");
      }
      ctx.beginPath();
      ctx.fillStyle = grad;
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, cell * 0.045);
      ctx.strokeStyle = p.side === 0 ? GOLD_C : RED_C;
      ctx.stroke();

      // inner rim
      ctx.beginPath();
      ctx.strokeStyle = p.side === 0 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.35)";
      ctx.lineWidth = Math.max(1, cell * 0.02);
      ctx.arc(x, y, rad * 0.78, 0, Math.PI * 2);
      ctx.stroke();

      // crown pieces get an outer halo
      if (p.value === 9) {
        const ha = 0.5 + 0.3 * Math.sin(this.time * 4 + p.id);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,255,255,${ha * 0.8})`;
        ctx.lineWidth = 2;
        ctx.arc(x, y, rad + 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // glyph
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = p.side === 0 ? INK : INK_RED;
      if (p.value === 9) {
        const s = rad * 0.9;
        ctx.save();
        ctx.translate(x, y + s * 0.08);
        ctx.beginPath();
        ctx.moveTo(-s * 0.62, s * 0.42);
        ctx.lineTo(-s * 0.62, -s * 0.18);
        ctx.lineTo(-s * 0.24, s * 0.1);
        ctx.lineTo(0, -s * 0.48);
        ctx.lineTo(s * 0.24, s * 0.1);
        ctx.lineTo(s * 0.62, -s * 0.18);
        ctx.lineTo(s * 0.62, s * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.font = `900 ${Math.round(rad * 1.15)}px Cinzel, Georgia, serif`;
        ctx.fillText(String(p.value), x, y + rad * 0.06);
      }

      // selected ring
      if (selected) {
        const sa = 0.6 + 0.35 * Math.sin(this.time * 7);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(53,240,255,${sa})`;
        ctx.lineWidth = 2.5;
        ctx.arc(x, y, rad + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawGhosts(ctx: CanvasRenderingContext2D, cell: number) {
    for (const g of this.ghosts) {
      const k = g.life / g.max;
      const rad = cell * 0.36 * (1 + (1 - k) * 0.5);
      ctx.beginPath();
      ctx.strokeStyle = g.color;
      ctx.globalAlpha = k * 0.8;
      ctx.lineWidth = 2.5;
      ctx.arc(g.x, g.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(g.x - rad * 0.5, g.y - rad * 0.5);
      ctx.lineTo(g.x + rad * 0.5, g.y + rad * 0.5);
      ctx.moveTo(g.x + rad * 0.5, g.y - rad * 0.5);
      ctx.lineTo(g.x - rad * 0.5, g.y + rad * 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawTexts(ctx: CanvasRenderingContext2D) {
    for (const t of this.texts) {
      const k = t.life / t.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = t.big
        ? "900 22px Cinzel, Georgia, serif"
        : "700 14px 'Space Grotesk', sans-serif";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(4,21,27,0.85)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
