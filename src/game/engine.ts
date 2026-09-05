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
  assisted?: boolean;
  assistValue?: number;
}
export interface MoveAction {
  kind: "move";
  piece: Piece;
  to: Pos;
  capture?: Piece;
  assisted?: boolean;
  assistValue?: number;
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

export function canPieceReach(state: GameState, p: Piece, targetR: number, targetC: number): boolean {
  const dr = targetR - p.r;
  const dc = targetC - p.c;
  const spec = MARCH[p.value];
  if (spec.jump) {
    return spec.dirs.some(([d_r, d_c]) => d_r === dr && d_c === dc);
  }
  for (const [d_r, d_c] of spec.dirs) {
    for (let step = 1; step <= spec.max; step++) {
      const curR = p.r + d_r * step;
      const curC = p.c + d_c * step;
      if (curR === targetR && curC === targetC) return true;
      if (!inBounds(curR, curC) || state.grid[curR][curC] !== null) break;
    }
  }
  return false;
}

export function findBestSupporter(state: GameState, side: Side, r: number, c: number, excludeId: number): number {
  let best = 0;
  for (const p of state.pieces) {
    if (p.side === side && p.id !== excludeId) {
      if (canPieceReach(state, p, r, c)) {
        if (p.value > best) best = p.value;
      }
    }
  }
  return best;
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
      if (!t) {
        out.push({ r, c });
      } else if (t.side !== p.side) {
        if (canCapture(p, t)) {
          out.push({ r, c, capture: t, assisted: false });
        } else {
          const sup = findBestSupporter(state, p.side, r, c, p.id);
          if (p.value + sup >= t.value) {
            out.push({ r, c, capture: t, assisted: true, assistValue: sup });
          }
        }
      }
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
        if (t.side !== p.side) {
          if (canCapture(p, t)) {
            out.push({ r, c, capture: t, assisted: false });
          } else {
            const sup = findBestSupporter(state, p.side, r, c, p.id);
            if (p.value + sup >= t.value) {
              out.push({ r, c, capture: t, assisted: true, assistValue: sup });
            }
          }
        }
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
      for (const t of pieceTargets(state, p)) {
        moves.push({
          kind: "move",
          piece: p,
          to: { r: t.r, c: t.c },
          capture: t.capture,
          assisted: t.assisted,
          assistValue: t.assistValue,
        });
      }
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
  assisted?: boolean;
  assistValue?: number;
}

export function endByMaterial(state: GameState, reason: OverInfo["reason"]) {
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
      res.assisted = action.assisted;
      res.assistValue = action.assistValue;
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
        if (!t) add(r, c, p.value);
        else if (t.side !== bySide) {
          if (canCapture(p, t) || p.value + findBestSupporter(state, bySide, r, c, p.id) >= t.value) {
            add(r, c, p.value);
          }
        }
        continue;
      }
      for (let step = 1; step <= spec.max; step++) {
        const r = p.r + dr * step;
        const c = p.c + dc * step;
        if (!inBounds(r, c)) break;
        const t = state.grid[r][c];
        if (t) {
          if (t.side !== bySide) {
            if (canCapture(p, t) || p.value + findBestSupporter(state, bySide, r, c, p.id) >= t.value) {
              add(r, c, p.value);
            }
          }
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

// ── the enemy mind (Alpha-Beta Minimax) ────────────────────────────────────────
export type Difficulty = "squire" | "knight" | "warlord";

export function evaluateState(state: GameState, aiSide: Side): number {
  if (state.over) {
    if (state.over.winner === aiSide) return 100000;
    if (state.over.winner === -1) return 0;
    return -100000;
  }
  const opp = other(aiSide);

  // 1. Material score (balance of surviving pieces + reserve)
  const myMat = material(state, aiSide);
  const oppMat = material(state, opp);
  const matScore = (myMat - oppMat) * 18;

  // 2. War score (captures)
  const myWar = warScore(state, aiSide);
  const oppWar = warScore(state, opp);
  const warDiff = (myWar - oppWar) * 2;

  // 3. Crown safety
  const myCrown = state.pieces.find((p) => p.side === aiSide && p.value === 9);
  const oppCrown = state.pieces.find((p) => p.side === opp && p.value === 9);

  let crownSafety = 0;
  const oppThreats = threatMap(state, opp);
  const myThreats = threatMap(state, aiSide);

  if (myCrown) {
    const threatsToMe = oppThreats.get(key(myCrown.r, myCrown.c));
    if (threatsToMe && threatsToMe.length > 0) {
      crownSafety -= 4000; // Immediate threat to Crown!
    }
  } else if (!state.reserves[aiSide].includes(9)) {
    return -100000;
  }

  if (oppCrown) {
    const threatsToOpp = myThreats.get(key(oppCrown.r, oppCrown.c));
    if (threatsToOpp && threatsToOpp.length > 0) {
      crownSafety += 3500; // Direct attack on enemy Crown!
    }
  } else if (!state.reserves[opp].includes(9)) {
    return 100000;
  }

  // 4. Center control & mobility
  let positional = 0;
  for (const p of state.pieces) {
    const dCenter = cheb(p, CENTER);
    const weight = p.value === 9 ? -1.5 : p.value * 0.4;
    const score = (3 - dCenter) * weight;
    if (p.side === aiSide) positional += score;
    else positional -= score;
  }

  // 5. Tactical danger / undefended pieces
  let tactical = 0;
  for (const p of state.pieces) {
    if (p.value === 9) continue;
    if (p.side === aiSide) {
      const atts = oppThreats.get(key(p.r, p.c));
      if (atts && atts.length > 0) {
        tactical -= p.value * 8;
      }
    } else {
      const atts = myThreats.get(key(p.r, p.c));
      if (atts && atts.length > 0) {
        tactical += p.value * 8;
      }
    }
  }

  return matScore + warDiff + crownSafety + positional * 4 + tactical;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiSide: Side,
): number {
  if (depth === 0 || state.over) {
    return evaluateState(state, aiSide);
  }

  const currentSide = state.turn;
  const { moves, deploys } = actionsFor(state, currentSide);
  const actions: Action[] = [...moves, ...deploys];

  if (actions.length === 0) {
    const clone = structuredClone(state);
    clone.passes++;
    clone.plies[currentSide]++;
    if (clone.passes >= 2) {
      endByMaterial(clone, "stalemate");
    } else if (clone.plies[0] + clone.plies[1] >= MAX_PLIES) {
      endByMaterial(clone, "decree");
    }
    clone.turn = other(currentSide);
    return minimax(clone, depth - 1, alpha, beta, clone.turn === aiSide, aiSide);
  }

  // Move ordering: captures (especially Crown and high-value pieces) first
  actions.sort((a, b) => {
    let sa = 0;
    let sb = 0;
    if (a.kind === "move" && a.capture) {
      sa = a.capture.value === 9 ? 10000 : (a.assisted ? 300 : 200) + a.capture.value * 20;
    }
    if (b.kind === "move" && b.capture) {
      sb = b.capture.value === 9 ? 10000 : (b.assisted ? 300 : 200) + b.capture.value * 20;
    }
    return sb - sa;
  });

  // Candidate pruning for minimax speed
  const maxBranch = depth >= 2 ? 14 : 8;
  const candidates = actions.length > maxBranch ? actions.slice(0, maxBranch) : actions;

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const act of candidates) {
      const clone = structuredClone(state);
      applyAction(clone, act);
      const ev = minimax(clone, depth - 1, alpha, beta, clone.turn === aiSide, aiSide);
      if (ev > maxEval) maxEval = ev;
      if (ev > alpha) alpha = ev;
      if (beta <= alpha) break; // Beta cutoff
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const act of candidates) {
      const clone = structuredClone(state);
      applyAction(clone, act);
      const ev = minimax(clone, depth - 1, alpha, beta, clone.turn === aiSide, aiSide);
      if (ev < minEval) minEval = ev;
      if (ev < beta) beta = ev;
      if (beta <= alpha) break; // Alpha cutoff
    }
    return minEval;
  }
}

export function aiChoose(state: GameState, diff: Difficulty): Action | null {
  const side: Side = 1;
  const { moves, deploys } = actionsFor(state, side);
  const actions: Action[] = [...moves, ...deploys];
  if (actions.length === 0) return null;

  // Squire (Easy): Fast 1-ply search with noise
  if (diff === "squire") {
    let best: Action | null = null;
    let bestScore = -Infinity;
    for (const act of actions) {
      const clone = structuredClone(state);
      applyAction(clone, act);
      const score = evaluateState(clone, side) + (Math.random() - 0.5) * 60;
      if (score > bestScore) {
        bestScore = score;
        best = act;
      }
    }
    return best ?? actions[0];
  }

  // Knight: 2-ply Minimax + Alpha-Beta
  // Warlord: 3-ply Minimax + Alpha-Beta
  const depth = diff === "warlord" ? 3 : 2;

  // Move ordering at root
  actions.sort((a, b) => {
    let sa = 0;
    let sb = 0;
    if (a.kind === "move" && a.capture) {
      sa = a.capture.value === 9 ? 10000 : (a.assisted ? 300 : 200) + a.capture.value * 20;
    } else if (a.kind === "deploy") {
      sa = (a.value === 9 ? 50 : a.value * 2);
    }
    if (b.kind === "move" && b.capture) {
      sb = b.capture.value === 9 ? 10000 : (b.assisted ? 300 : 200) + b.capture.value * 20;
    } else if (b.kind === "deploy") {
      sb = (b.value === 9 ? 50 : b.value * 2);
    }
    return sb - sa;
  });

  const rootCandidates = actions.length > 16 ? actions.slice(0, 16) : actions;
  let bestAction: Action = actions[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const act of rootCandidates) {
    const clone = structuredClone(state);
    applyAction(clone, act);

    // Immediate winning move (Crown captured)
    if (clone.over && clone.over.winner === side) {
      return act;
    }

    const score = minimax(clone, depth - 1, alpha, beta, clone.turn === side, side);
    if (score > bestScore) {
      bestScore = score;
      bestAction = act;
    }
    if (score > alpha) {
      alpha = score;
    }
  }

  return bestAction;
}
