// ── CROWNFALL engine ──────────────────────────────────────────────────────────
// Chess × Sudoku hybrid. 7×7 grid. Each digit 1–8 has its own "march" (chess-like
// movement). Deployment obeys the Law of Rows: no two pieces of equal value may
// share a row or column (either side). A piece may capture any enemy of equal or
// lesser value — and ANY piece may slay the Crown (9). Lose your Crown, lose the war.

export const N = 7;
export const MAX_PLIES = 60; // total moves before the Decree decides by material
export const CROWN_FORCE_PLY = 4; // a side's 5th turn: the Crown must take the field

export type Side = 0 | 1; // 0 = you (gold), 1 = enemy (crimson)

export interface Pos {
  r: number;
  c: number;
}
export interface Piece {
  id: number;
  side: Side;
  value: number; // 9 = the Crown
  r: number;
  c: number;
}
export interface MoveTarget extends Pos {
  capture?: Piece;
}
export interface MoveAction {
  kind: "move";
  piece: Piece;
  to: Pos;
  capture?: Piece;
}
export interface DeployAction {
  kind: "deploy";
  value: number;
  to: Pos;
}
export type Action = MoveAction | DeployAction;

export interface OverInfo {
  winner: Side | -1;
  reason: "crownfall" | "decree" | "stalemate";
}

export interface GameState {
  grid: (Piece | null)[][];
  pieces: Piece[];
  reserves: [number[], number[]];
  captures: [number[], number[]]; // values captured BY each side
  turn: Side;
  plies: [number, number];
  passes: number;
  lastMove: { from: Pos | null; to: Pos; pieceId: number } | null;
  over: OverInfo | null;
  nextId: number;
}

// ── movement table ────────────────────────────────────────────────────────────
const ORTH = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAG = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const ALL8 = [...ORTH, ...DIAG];
const KNIGHT = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];

export const MARCH: Record<number, { dirs: number[][]; max: number; jump?: boolean }> = {
  1: { dirs: ALL8, max: 1 },
  2: { dirs: ORTH, max: 2 },
  3: { dirs: KNIGHT, max: 1, jump: true },
  4: { dirs: DIAG, max: 2 },
  5: { dirs: ORTH, max: 3 },
  6: { dirs: DIAG, max: 3 },
  7: { dirs: ALL8, max: 2 },
  8: { dirs: ALL8, max: 3 },
  9: { dirs: ALL8, max: 1 },
};

export const PIECE_NAMES: Record<number, string> = {
  1: "Footman",
  2: "Courier",
  3: "Knight",
  4: "Duelist",
  5: "Lancer",
  6: "Skirmisher",
  7: "Warden",
  8: "Warlord",
  9: "The Crown",
};

export const MARCH_TEXT: Record<number, string> = {
  1: "1 step, any direction",
  2: "slides 1–2, straight lines",
  3: "leaps in the L (jumps pieces)",
  4: "slides 1–2, diagonals",
  5: "slides 1–3, straight lines",
  6: "slides 1–3, diagonals",
  7: "slides 1–2, any direction",
  8: "slides 1–3, any direction",
  9: "1 step, any direction — priceless",
};

export const isCrown = (p: Piece) => p.value === 9;
export const other = (s: Side): Side => (s === 0 ? 1 : 0);
const key = (r: number, c: number) => `${r},${c}`;
const inBounds = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;

export const canCapture = (attacker: Piece, target: Piece) =>
  target.value === 9 || attacker.value >= target.value;

export function createGame(): GameState {
  const grid: (Piece | null)[][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => null),
  );
  return {
    grid,
    pieces: [],
    reserves: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
    ],
    captures: [[], []],
    turn: 0,
    plies: [0, 0],
    passes: 0,
    lastMove: null,
    over: null,
    nextId: 1,
  };
}

// ── move generation ───────────────────────────────────────────────────────────
export function pieceTargets(state: GameState, p: Piece): MoveTarget[] {
  const spec = MARCH[p.value];
  const out: MoveTarget[] = [];
  for (const [dr, dc] of spec.dirs) {
    if (spec.jump) {
      const r = p.r + dr;
      const c = p.c + dc;
      if (!inBounds(r, c)) continue;
      const t = state.grid[r][c];
      if (!t) out.push({ r, c });
      else if (t.side !== p.side && canCapture(p, t)) out.push({ r, c, capture: t });
      continue;
    }
    for (let step = 1; step <= spec.max; step++) {
      const r = p.r + dr * step;
      const c = p.c + dc * step;
      if (!inBounds(r, c)) break;
      const t = state.grid[r][c];
      if (!t) {
        out.push({ r, c });
      } else {
        if (t.side !== p.side && canCapture(p, t)) out.push({ r, c, capture: t });
        break;
      }
    }
  }
  return out;
}

/** Squares a value may be deployed on. Digits obey the Law of Rows; the Crown must
 *  land in its owner's home two rows. */
export function deploySquares(state: GameState, side: Side, value: number): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (state.grid[r][c]) continue;
      if (value === 9) {
        if (side === 0 && r < N - 2) continue;
        if (side === 1 && r > 1) continue;
      } else {
        let clash = false;
        for (let i = 0; i < N; i++) {
          const a = state.grid[r][i];
          const b = state.grid[i][c];
          if ((a && a.value === value) || (b && b.value === value)) {
            clash = true;
            break;
          }
        }
        if (clash) continue;
      }
      out.push({ r, c });
    }
  }
  return out;
}

export const mustDeployCrown = (state: GameState, side: Side) =>
  state.reserves[side].includes(9) && state.plies[side] >= CROWN_FORCE_PLY;

export interface ActionSet {
  moves: MoveAction[];
  deploys: DeployAction[];
}

export function actionsFor(state: GameState, side: Side): ActionSet {
  const deploys: DeployAction[] = [];
  const moves: MoveAction[] = [];
  const crownForced = mustDeployCrown(state, side);
  const values = crownForced ? [9] : state.reserves[side];
  for (const v of values) {
    for (const to of deploySquares(state, side, v)) deploys.push({ kind: "deploy", value: v, to });
  }
  if (!crownForced) {
    for (const p of state.pieces) {
      if (p.side !== side) continue;
      for (const t of pieceTargets(state, p))
        moves.push({ kind: "move", piece: p, to: { r: t.r, c: t.c }, capture: t.capture });
    }
  }
  return { moves, deploys };
}

export const hasActions = (state: GameState, side: Side) => {
  const crownForced = mustDeployCrown(state, side);
  if (crownForced) return deploySquares(state, side, 9).length > 0;
  if (state.reserves[side].some((v) => deploySquares(state, side, v).length > 0)) return true;
  return state.pieces.some((p) => p.side === side && pieceTargets(state, p).length > 0);
};

// ── applying actions ──────────────────────────────────────────────────────────
export interface ApplyResult {
  captured?: Piece;
  placed?: Piece;
  moved?: Piece;
}

function endByMaterial(state: GameState, reason: OverInfo["reason"]) {
  const m0 = material(state, 0);
  const m1 = material(state, 1);
  state.over = { winner: m0 === m1 ? -1 : m0 > m1 ? 0 : 1, reason };
}

export function applyAction(state: GameState, action: Action): ApplyResult {
  const side = state.turn;
  const res: ApplyResult = {};
  if (action.kind === "deploy") {
    const piece: Piece = {
      id: state.nextId++,
      side,
      value: action.value,
      r: action.to.r,
      c: action.to.c,
    };
    state.grid[action.to.r][action.to.c] = piece;
    state.pieces.push(piece);
    state.reserves[side] = state.reserves[side].filter((v) => v !== action.value);
    state.lastMove = { from: null, to: action.to, pieceId: piece.id };
    res.placed = piece;
  } else {
    const p = action.piece;
    const from = { r: p.r, c: p.c };
    state.grid[p.r][p.c] = null;
    if (action.capture) {
      const cap = action.capture;
      state.grid[cap.r][cap.c] = null;
      state.pieces = state.pieces.filter((x) => x.id !== cap.id);
      state.captures[side].push(cap.value);
      res.captured = cap;
    }
    p.r = action.to.r;
    p.c = action.to.c;
    state.grid[p.r][p.c] = p;
    state.lastMove = { from, to: action.to, pieceId: p.id };
    res.moved = p;
  }

  state.plies[side]++;
  state.passes = 0;

  if (res.captured && res.captured.value === 9) {
    state.over = { winner: side, reason: "crownfall" };
    return res;
  }
  if (state.plies[0] + state.plies[1] >= MAX_PLIES) {
    endByMaterial(state, "decree");
    return res;
  }

  // switch turn, auto-passing sides with no legal actions
  state.turn = other(side);
  let guard = 0;
  while (!state.over && guard++ < 4) {
    if (hasActions(state, state.turn)) break;
    state.passes++;
    state.plies[state.turn]++;
    if (state.passes >= 2) {
      endByMaterial(state, "stalemate");
      break;
    }
    if (state.plies[0] + state.plies[1] >= MAX_PLIES) {
      endByMaterial(state, "decree");
      break;
    }
    state.turn = other(state.turn);
  }
  return res;
}

export function material(state: GameState, side: Side): number {
  let m = 0;
  for (const p of state.pieces) if (p.side === side) m += p.value === 9 ? 15 : p.value;
  for (const v of state.reserves[side]) m += v === 9 ? 15 : v;
  return m;
}

export const warScore = (state: GameState, side: Side) =>
  state.captures[side].reduce((a, v) => a + (v === 9 ? 50 : v * 10), 0);

// ── threat map: squares each enemy value could strike ─────────────────────────
export function threatMap(state: GameState, bySide: Side): Map<string, number[]> {
  const map = new Map<string, number[]>();
  const add = (r: number, c: number, v: number) => {
    const k = key(r, c);
    const arr = map.get(k);
    if (arr) arr.push(v);
    else map.set(k, [v]);
  };
  for (const p of state.pieces) {
    if (p.side !== bySide) continue;
    const spec = MARCH[p.value];
    for (const [dr, dc] of spec.dirs) {
      if (spec.jump) {
        const r = p.r + dr;
        const c = p.c + dc;
        if (!inBounds(r, c)) continue;
        const t = state.grid[r][c];
        if (!t || t.side !== bySide) add(r, c, p.value);
        continue;
      }
      for (let step = 1; step <= spec.max; step++) {
        const r = p.r + dr * step;
        const c = p.c + dc * step;
        if (!inBounds(r, c)) break;
        const t = state.grid[r][c];
        if (t) {
          if (t.side !== bySide) add(r, c, p.value);
          break;
        }
        add(r, c, p.value);
      }
    }
  }
  return map;
}

const dist = (a: Pos, b: Pos) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
const cheb = (a: Pos, b: Pos) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
const CENTER: Pos = { r: 3, c: 3 };

// ── the enemy mind ────────────────────────────────────────────────────────────
export type Difficulty = "squire" | "knight" | "warlord";

export function aiChoose(state: GameState, diff: Difficulty): Action | null {
  const side: Side = 1;
  const { moves, deploys } = actionsFor(state, side);
  if (moves.length === 0 && deploys.length === 0) return null;

  const noise = diff === "squire" ? 16 : diff === "knight" ? 6 : 2;
  const useThreats = diff !== "squire";
  const threats = useThreats ? threatMap(state, 0) : null;
  const enemyCrown = state.pieces.find((p) => p.side === 0 && p.value === 9) ?? null;
  const myCrown = state.pieces.find((p) => p.side === 1 && p.value === 9) ?? null;
  const targetRef: Pos = enemyCrown ? { r: enemyCrown.r, c: enemyCrown.c } : { r: 5, c: 3 };
  const lateGame = state.plies[0] + state.plies[1] > MAX_PLIES * 0.55;

  const dangerPenalty = (square: Pos, myValue: number): number => {
    if (!threats) return 0;
    const atts = threats.get(key(square.r, square.c));
    if (!atts || atts.length === 0) return 0;
    if (myValue === 9) return -120;
    const maxAtt = Math.max(...atts);
    if (maxAtt >= myValue) return -(myValue * 10 + 10);
    return 0;
  };

  let best: Action | null = null;
  let bestScore = -Infinity;

  const consider = (a: Action, s: number) => {
    s += (Math.random() - 0.5) * 2 * noise;
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  };

  for (const d of deploys) {
    let s = d.value * 2.2 + (3 - cheb(d.to, CENTER)) * 0.6;
    if (d.value === 9) {
      s += d.to.r === 0 ? 3 : 0;
      s += d.to.c === 0 || d.to.c === N - 1 ? 2 : 0;
      s += dangerPenalty(d.to, 9) * 0.7;
    } else {
      s += dangerPenalty(d.to, d.value) * 0.8;
      if (d.value >= 6 && state.plies[1] < 8) s += 3; // bring heavies out early
      if (enemyCrown && d.value >= 5) s += (6 - cheb(d.to, enemyCrown)) * 0.8;
    }
    if (lateGame) s += d.value * 1.2;
    consider(d, s);
  }

  for (const m of moves) {
    const p = m.piece;
    let s = 0;
    if (m.capture) {
      s += m.capture.value === 9 ? 320 : m.capture.value * 12 + 6;
      if (diff === "warlord" && myCrown && cheb(m.capture, myCrown) <= 2) s += 26;
    }
    const before = dist(p, targetRef);
    const after = dist(m.to, targetRef);
    s += (before - after) * (p.value === 9 ? 0.15 : p.value >= 5 ? 1.9 : 1.1);
    s += dangerPenalty(m.to, p.value);
    // escaping danger is wise
    if (threats) {
      const curAtts = threats.get(key(p.r, p.c));
      if (curAtts && curAtts.length > 0) {
        const inDanger = p.value === 9 || Math.max(...curAtts) >= p.value;
        if (inDanger) {
          const toAtts = threats.get(key(m.to.r, m.to.c));
          const safe =
            !toAtts || toAtts.length === 0 || (p.value !== 9 && Math.max(...toAtts) < p.value);
          if (safe && !m.capture) s += p.value * 3.5 + (p.value === 9 ? 60 : 0);
        }
      }
    }
    if (lateGame) s += m.capture ? m.capture.value * 4 : 0;
    consider(m, s);
  }

  return best;
}
