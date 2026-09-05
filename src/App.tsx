import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_PLIES,
  MARCH_TEXT,
  PIECE_NAMES,
  aiChoose,
  applyAction,
  createGame,
  deploySquares,
  endByMaterial,
  material,
  mustDeployCrown,
  pieceTargets,
  warScore,
  type ApplyResult,
  type Difficulty,
  type GameState,
  type MoveAction,
  type OverInfo,
  type Piece,
  type Pos,
  type Side,
} from "./game/engine";
import { Renderer } from "./game/render";
import { sfx } from "./game/audio";
import { BookIcon, CrownIcon, MarchGlyph } from "./components/glyphs";
import FieldManual from "./components/FieldManual";

// ── tiny inline icon set (no assets, all paths) ──────────────────────────────
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function SoundIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
      {off ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M8 5 3 10l5 5" />
      <path d="M3 10h11a6 6 0 0 1 0 12h-3" transform="translate(0,-3) scale(1,0.9)" />
    </svg>
  );
}
function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 3v5h-5" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 21V4" />
      <path d="M5 4h13l-3 4 3 4H5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FullscreenIcon({ isFullscreen }: { isFullscreen: boolean }) {
  if (isFullscreen) {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8V5a2 2 0 0 1 2-2h3m8 0h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3m-8 0H5a2 2 0 0 1-2-2v-3" />
    </svg>
  );
}

// ── hud snapshot ──────────────────────────────────────────────────────────────
interface Hud {
  turn: Side;
  plies: [number, number];
  over: OverInfo | null;
  reserves: [number[], number[]];
  captures: [number[], number[]];
  score: [number, number];
  material: [number, number];
  mustCrown: [boolean, boolean];
  crownOnBoard: [boolean, boolean];
}
const emptyHud: Hud = {
  turn: 0,
  plies: [0, 0],
  over: null,
  reserves: [[], []],
  captures: [[], []],
  score: [0, 0],
  material: [0, 0],
  mustCrown: [false, false],
  crownOnBoard: [false, false],
};

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const DIFFS: { id: Difficulty; name: string; blurb: string }[] = [
  { id: "squire", name: "SQUIRE", blurb: "a reckless foe" },
  { id: "knight", name: "KNIGHT", blurb: "a cunning foe" },
  { id: "warlord", name: "WARLORD", blurb: "a ruthless foe" },
];

const RESERVE_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendRef = useRef<Renderer | null>(null);
  const gameRef = useRef<GameState | null>(null);

  const [screen, setScreen] = useState<"menu" | "play">("menu");
  const [menuTab, setMenuTab] = useState<"brief" | "marches">("brief");
  const screenRef = useRef(screen);
  const [hud, setHud] = useState<Hud>(emptyHud);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    const doc = document as any;
    return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
  });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualFirst, setManualFirst] = useState(true); // true until the player opens the manual once
  const [manualWasFirst, setManualWasFirst] = useState(false); // true only when THIS opening is the very first
  const [diff, setDiff] = useState<Difficulty>("knight");
  const diffRef = useRef<Difficulty>("knight");
  const [hint, setHint] = useState("Muster your warband, then hunt the Crimson Crown.");
  const [selReserve, setSelReserve] = useState<number | null>(null);
  const selPieceRef = useRef<number | null>(null);
  const [selInfo, setSelInfo] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const aiTimer = useRef<number | null>(null);
  const undoSnap = useRef<GameState | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);
  const [showOver, setShowOver] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(0);
  const warnedRef = useRef(false);
  const hoverKey = useRef("");

  // ── renderer lifecycle ─────────────────────────────────────────────────────
  useEffect(() => {
    const r = new Renderer();
    rendRef.current = r;
    if (canvasRef.current) r.attach(canvasRef.current);
    return () => r.detach();
  }, []);

  // toast auto-clear
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // battle clock — paused while the manual is open too
  useEffect(() => {
    if (screen !== "play" || paused || hud.over || manualOpen) return;
    const iv = window.setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    return () => window.clearInterval(iv);
  }, [screen, paused, hud.over, manualOpen]);

  const toastMsg = useCallback((msg: string) => setToast({ msg, id: Date.now() + Math.random() }), []);

  const openManual = useCallback((first: boolean) => {
    setManualFirst(false);
    setManualWasFirst(first);
    setManualOpen(true);
    sfx.manualOpen();
  }, []);

  const refresh = useCallback(() => {
    const g = gameRef.current;
    const r = rendRef.current;
    if (!g || !r) return;
    r.state = g;
    r.view.turn = g.turn;
    r.view.mustCrown = g.turn === 0 && mustDeployCrown(g, 0);
    r.view.paused = pausedRef.current;
    setHud({
      turn: g.turn,
      plies: [g.plies[0], g.plies[1]],
      over: g.over,
      reserves: [[...g.reserves[0]], [...g.reserves[1]]],
      captures: [[...g.captures[0]], [...g.captures[1]]],
      score: [warScore(g, 0), warScore(g, 1)],
      material: [material(g, 0), material(g, 1)],
      mustCrown: [mustDeployCrown(g, 0), mustDeployCrown(g, 1)],
      crownOnBoard: [
        g.pieces.some((p) => p.side === 0 && p.value === 9),
        g.pieces.some((p) => p.side === 1 && p.value === 9),
      ],
    });
  }, []);

  const clearSel = useCallback(() => {
    selPieceRef.current = null;
    setSelReserve(null);
    setSelInfo(null);
    const r = rendRef.current;
    if (r) {
      r.view.selected = null;
      r.view.moveTargets = [];
      r.view.deployDots = [];
    }
  }, []);

  const playerHint = useCallback((g: GameState) => {
    if (mustDeployCrown(g, 0))
      return "DECREE: your Crown must take the field this turn — deploy it within your home two rows.";
    return "Tap a digit in your warband to deploy · tap a piece on the field to see its march.";
  }, []);

  const fxFor = useCallback(
    (res: ApplyResult, actor: Side) => {
      const r = rendRef.current;
      if (!r) return;
      if (res.placed) {
        const col = actor === 0 ? "#ffc93c" : "#ff4757";
        r.dust(res.placed.r, res.placed.c, col, 12);
        r.floatText(res.placed.r, res.placed.c, PIECE_NAMES[res.placed.value], actor === 0 ? "#ffdf7e" : "#ff8a94");
        sfx.place();
      }
      if (res.moved && !res.captured) sfx.move();
      if (res.captured) {
        const cap = res.captured;
        const col = cap.side === 0 ? "#ffc93c" : "#ff4757";
        r.ghost(cap.r, cap.c, cap.value, col);
        r.burst(cap.r, cap.c, col, cap.value === 9 ? 48 : 22, cap.value === 9 ? 270 : 175);
        r.burst(cap.r, cap.c, "#ffffff", 8, 120);
        r.floatText(cap.r, cap.c, `+${cap.value === 9 ? 50 : cap.value * 10}`, col, false);
        if (cap.value === 9) {
          sfx.crownHit();
          r.shake(17);
          r.flash("255,255,255", 1);
          toastMsg(cap.side === 0 ? "YOUR CROWN HAS FALLEN" : "THE ENEMY CROWN FALLS");
        } else {
          sfx.capture();
          r.shake(7);
        }
      }
    },
    [toastMsg],
  );

  const finish = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.over) return;
    const over = g.over;
    setAiThinking(false);
    clearSel();
    const r = rendRef.current;
    if (r) {
      window.setTimeout(() => r.confetti(over.winner), 180);
      if (over.reason !== "crownfall") r.shake(6);
    }
    if (over.winner === 0) sfx.win();
    else if (over.winner === 1) sfx.lose();
    else sfx.draw();
    window.setTimeout(() => setShowOver(true), 1150);
  }, [clearSel]);

  const maybeWarn = useCallback(
    (g: GameState) => {
      const total = g.plies[0] + g.plies[1];
      if (!warnedRef.current && total >= MAX_PLIES - 10) {
        warnedRef.current = true;
        toastMsg("THE DECREE WANES — 10 MOVES REMAIN");
        sfx.warn();
      }
    },
    [toastMsg],
  );

  const scheduleAI = useCallback(() => {
    setAiThinking(true);
    sfx.turnEnemy();
    aiTimer.current = window.setTimeout(() => {
      const g = gameRef.current;
      const r = rendRef.current;
      if (!g || !r || g.over || pausedRef.current || screenRef.current !== "play" || g.turn !== 1) {
        setAiThinking(false);
        return;
      }
      const act = aiChoose(g, diffRef.current);
      if (!act) {
        g.passes++;
        g.plies[1]++;
        if (g.passes >= 2) {
          endByMaterial(g, "stalemate");
          refresh();
          finish();
          return;
        }
        if (g.plies[0] + g.plies[1] >= MAX_PLIES) {
          endByMaterial(g, "decree");
          refresh();
          finish();
          return;
        }
        g.turn = 0;
        refresh();
        setAiThinking(false);
        sfx.turnYou();
        setHint(playerHint(g));
        return;
      }
      const res = applyAction(g, act);
      fxFor(res, 1);
      undoSnap.current = null;
      setCanUndo(false);
      clearSel();
      refresh();
      if (g.over) {
        finish();
        return;
      }
      setAiThinking(false);
      maybeWarn(g);
      if (g.turn === 1) {
        toastMsg("YOU HAVE NO LEGAL MOVES — THE CRIMSON COURT ADVANCES");
        scheduleAI();
      } else {
        sfx.turnYou();
        setHint(playerHint(g));
      }
    }, 750 + Math.random() * 450);
  }, [clearSel, finish, fxFor, maybeWarn, playerHint, refresh, toastMsg]);

  // opening the manual holds the battle (clock + enemy plotting), and resumes it after
  const manualPrevPaused = useRef(false);
  useEffect(() => {
    const g = gameRef.current;
    const r = rendRef.current;
    if (screenRef.current !== "play" || !g || g.over) return;
    if (manualOpen) {
      manualPrevPaused.current = pausedRef.current;
      if (aiTimer.current) window.clearTimeout(aiTimer.current);
      pausedRef.current = true;
      setAiThinking(false);
      if (r) r.view.paused = true;
    } else {
      pausedRef.current = manualPrevPaused.current;
      setPaused(manualPrevPaused.current);
      if (r) r.view.paused = manualPrevPaused.current;
      if (!manualPrevPaused.current && g.turn === 1) scheduleAI();
    }
  }, [manualOpen, scheduleAI]);

  const startGame = useCallback(
    (d: Difficulty) => {
      sfx.battleStart();
      diffRef.current = d;
      setDiff(d);
      if (aiTimer.current) window.clearTimeout(aiTimer.current);
      const g = createGame();
      gameRef.current = g;
      const r = rendRef.current;
      if (r) {
        r.resetFx();
        r.state = g;
        r.view.screen = "play";
      }
      clearSel();
      undoSnap.current = null;
      setCanUndo(false);
      pausedRef.current = false;
      setPaused(false);
      secondsRef.current = 0;
      setSeconds(0);
      warnedRef.current = false;
      setShowOver(false);
      setAiThinking(false);
      const seen = !manualFirst;
      setManualFirst(false);
      setManualWasFirst(!seen);
      setManualOpen(!seen); // first war: the manual opens before the first move
      screenRef.current = "play";
      setScreen("play");
      refresh();
      setHint("Step 1: tap any number in your gold tray, then tap a glowing square to place it.");
      toastMsg("THE WAR BEGINS — YOUR MOVE");
    },
    [clearSel, manualFirst, refresh, toastMsg],
  );

  const toMenu = useCallback(() => {
    sfx.buttonClick();
    if (aiTimer.current) window.clearTimeout(aiTimer.current);
    gameRef.current = null;
    const r = rendRef.current;
    if (r) {
      r.state = null;
      r.view.screen = "menu";
      r.resetFx();
    }
    clearSel();
    setAiThinking(false);
    setShowOver(false);
    setPaused(false);
    setManualOpen(false);
    pausedRef.current = false;
    setHud(emptyHud);
    screenRef.current = "menu";
    setScreen("menu");
  }, [clearSel]);

  // ── player input ────────────────────────────────────────────────────────────
  const selectPiece = useCallback(
    (p: Piece) => {
      const g = gameRef.current;
      const r = rendRef.current;
      if (!g || !r) return;
      const targets = pieceTargets(g, p);
      if (targets.length === 0) {
        sfx.invalid();
        toastMsg(`${PIECE_NAMES[p.value].toUpperCase()} IS SURROUNDED — NO MARCH AVAILABLE`);
        selPieceRef.current = null;
        r.view.selected = null;
        r.view.moveTargets = [];
        r.view.deployDots = [];
        setSelInfo(null);
        return;
      }
      selPieceRef.current = p.id;
      setSelReserve(null);
      r.view.selected = { r: p.r, c: p.c };
      r.view.moveTargets = targets;
      r.view.deployDots = [];
      const caps = targets.filter((t) => t.capture).length;
      setSelInfo(
        `${PIECE_NAMES[p.value]} ${p.value} — ${MARCH_TEXT[p.value]} · ${targets.length - caps} squares to march${caps > 0 ? ` · ${caps} capture${caps > 1 ? "s" : ""} (red rings)` : ""}`,
      );
      sfx.chipSelect(p.value);
    },
    [toastMsg],
  );

  const doDeploy = useCallback(
    (value: number, to: Pos) => {
      const g = gameRef.current;
      if (!g) return;
      undoSnap.current = structuredClone(g);
      setCanUndo(true);
      const res = applyAction(g, { kind: "deploy", value, to });
      fxFor(res, 0);
      clearSel();
      refresh();
      if (g.over) {
        finish();
        return;
      }
      if (g.turn === 1) {
        setHint("The crimson court stirs…");
        scheduleAI();
      } else {
        toastMsg("THE CRIMSON COURT HAS NO MOVE — STRIKE AGAIN");
        setHint(playerHint(g));
      }
    },
    [clearSel, finish, fxFor, playerHint, refresh, scheduleAI, toastMsg],
  );

  const doMove = useCallback(
    (a: MoveAction) => {
      const g = gameRef.current;
      if (!g || mustDeployCrown(g, 0)) return;
      undoSnap.current = structuredClone(g);
      setCanUndo(true);
      const res = applyAction(g, a);
      fxFor(res, 0);
      clearSel();
      refresh();
      if (g.over) {
        finish();
        return;
      }
      if (g.turn === 1) {
        setHint("The crimson court stirs…");
        scheduleAI();
      } else {
        toastMsg("THE CRIMSON COURT HAS NO MOVE — STRIKE AGAIN");
        setHint(playerHint(g));
      }
    },
    [clearSel, finish, fxFor, playerHint, refresh, scheduleAI, toastMsg],
  );

  const onCanvasDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const g = gameRef.current;
      const r = rendRef.current;
      if (!g || !r || screenRef.current !== "play" || pausedRef.current || g.over) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const cell = r.cellAt(e.clientX - rect.left, e.clientY - rect.top);
      if (!cell) {
        clearSel();
        return;
      }
      if (g.turn !== 0) return;
      const pc = g.grid[cell.r][cell.c];
      const crownForced = mustDeployCrown(g, 0);

      if (selReserve != null) {
        const sqs = deploySquares(g, 0, selReserve);
        if (sqs.some((s) => s.r === cell.r && s.c === cell.c)) {
          doDeploy(selReserve, cell);
          return;
        }
        if (pc && pc.side === 0) {
          if (crownForced) {
            sfx.invalid();
            toastMsg("DECREE — THE CROWN MUST TAKE THE FIELD FIRST");
            return;
          }
          setSelReserve(null);
          setSelInfo(null);
          r.view.deployDots = [];
          selectPiece(pc);
          return;
        }
        sfx.invalid();
        toastMsg(
          selReserve === 9
            ? "THE CROWN MAY ONLY LAND IN YOUR HOME ROWS"
            : "THE LAW OF ROWS FORBIDS THAT SQUARE",
        );
        r.shake(3);
        return;
      }

      if (crownForced) {
        clearSel();
        sfx.invalid();
        toastMsg("DECREE — THE CROWN MUST TAKE THE FIELD FIRST");
        return;
      }

      // 1. If a friendly piece is already selected, check if clicked cell is a valid move or capture target!
      if (selPieceRef.current != null) {
        const p = g.pieces.find((x) => x.id === selPieceRef.current);
        if (p) {
          const t = pieceTargets(g, p).find((t) => t.r === cell.r && t.c === cell.c);
          if (t) {
            doMove({ kind: "move", piece: p, to: { r: cell.r, c: cell.c }, capture: t.capture });
            return;
          }
        }
      }

      // 2. If clicking own piece, select it
      if (pc && pc.side === 0) {
        selectPiece(pc);
        return;
      }

      // 3. If clicking enemy piece (that cannot be captured with current selection)
      if (pc && pc.side === 1) {
        sfx.invalid();
        toastMsg(
          selPieceRef.current != null
            ? "YOUR SELECTED UNIT CANNOT CAPTURE THAT ENEMY"
            : "THAT PIECE SERVES THE CRIMSON COURT — SELECT YOUR UNIT TO ATTACK",
        );
        return;
      }

      clearSel();
    },
    [clearSel, doDeploy, doMove, selReserve, selectPiece, toastMsg],
  );

  const onCanvasMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const g = gameRef.current;
      const r = rendRef.current;
      if (!g || !r) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const cell = r.cellAt(e.clientX - rect.left, e.clientY - rect.top);
      const k = cell ? `${cell.r},${cell.c}` : "-";
      if (k === hoverKey.current) return;
      hoverKey.current = k;
      r.view.hover = cell;
      let cursor = "default";
      if (cell && g.turn === 0 && !g.over && !pausedRef.current && screenRef.current === "play") {
        const pc = g.grid[cell.r][cell.c];
        const crownForced = mustDeployCrown(g, 0);
        if (selReserve != null) {
          if (deploySquares(g, 0, selReserve).some((s) => s.r === cell.r && s.c === cell.c)) cursor = "pointer";
          else if (pc && pc.side === 0 && !crownForced) cursor = "pointer";
        } else if (pc && pc.side === 0 && !crownForced) cursor = "pointer";
        else if (selPieceRef.current != null && !crownForced) {
          const p = g.pieces.find((x) => x.id === selPieceRef.current);
          if (p && pieceTargets(g, p).some((t) => t.r === cell.r && t.c === cell.c)) cursor = "pointer";
        }
      }
      e.currentTarget.style.cursor = cursor;
    },
    [selReserve],
  );

  const onChip = useCallback(
    (v: number) => {
      const g = gameRef.current;
      const r = rendRef.current;
      if (!g || !r || screenRef.current !== "play" || pausedRef.current || g.over || g.turn !== 0) return;
      if (!g.reserves[0].includes(v)) return;
      if (selReserve === v) {
        clearSel();
        setHint(playerHint(g));
        return;
      }
      selPieceRef.current = null;
      r.view.selected = null;
      r.view.moveTargets = [];
      const sqs = deploySquares(g, 0, v);
      if (sqs.length === 0) {
        sfx.invalid();
        toastMsg(`THE LAW OF ROWS BINDS THE ${PIECE_NAMES[v].toUpperCase()} — NO SQUARE REMAINS`);
        return;
      }
      setSelReserve(v);
      r.view.deployDots = sqs;
      sfx.chipSelect(v);
      setSelInfo(
        v === 9
          ? "Place the CROWN — tap a glowing square in your bottom two rows. Guard it with your life."
          : `Place the ${PIECE_NAMES[v]} — tap a glowing square. Remember: no equal number in its row or column.`,
      );
    },
    [clearSel, playerHint, selReserve, toastMsg],
  );

  const togglePause = useCallback(() => {
    if (screenRef.current !== "play") return;
    const g = gameRef.current;
    if (!g || g.over) return;
    sfx.buttonClick();
    if (!pausedRef.current) {
      pausedRef.current = true;
      setPaused(true);
      if (aiTimer.current) window.clearTimeout(aiTimer.current);
      const r = rendRef.current;
      if (r) r.view.paused = true;
    } else {
      pausedRef.current = false;
      setPaused(false);
      const r = rendRef.current;
      if (r) r.view.paused = false;
      if (g.turn === 1) scheduleAI();
    }
  }, [scheduleAI]);

  const undo = useCallback(() => {
    const g = gameRef.current;
    if (!g || !undoSnap.current || g.over) return;
    if (aiTimer.current) window.clearTimeout(aiTimer.current);
    gameRef.current = structuredClone(undoSnap.current);
    undoSnap.current = null;
    setCanUndo(false);
    clearSel();
    refresh();
    setAiThinking(false);
    sfx.buttonClick();
    toastMsg("MOVE RECALLED");
    setHint(playerHint(gameRef.current));
  }, [clearSel, playerHint, refresh, toastMsg]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      sfx.setMuted(!m);
      return !m;
    });
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const doc = document as any;
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    sfx.buttonClick();
    const doc = document as any;
    const docEl = document.documentElement as any;
    const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    if (!isFs) {
      const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
      if (req) {
        req.call(docEl).then(() => {
          toastMsg("FULLSCREEN ZOOM ENABLED · PRESS F TO EXIT");
        }).catch(() => {
          toastMsg("FULLSCREEN ZOOM ENABLED");
        });
      }
    } else {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
      if (exit) {
        exit.call(doc).then(() => {
          toastMsg("FULLSCREEN ZOOM EXITED");
        }).catch(() => {});
      }
    }
  }, [toastMsg]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          toggleFullscreen();
          return;
        }
      }
      if (manualOpen) return; // the manual owns Esc while open
      if (e.key === "Escape") {
        if (pausedRef.current) togglePause();
        else if (selPieceRef.current != null || selReserve != null) clearSel();
        else togglePause();
      } else if (e.key === "p" || e.key === "P") togglePause();
      else if (e.key === "m" || e.key === "M") toggleMute();
      else if (e.key === "u" || e.key === "U") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [manualOpen, selReserve, clearSel, togglePause, toggleMute, undo, toggleFullscreen]);

  // ── derived ─────────────────────────────────────────────────────────────────
  const totalPlies = hud.plies[0] + hud.plies[1];
  const decreeLeft = Math.max(0, MAX_PLIES - totalPlies);
  const inBattle = screen === "play";
  const over = hud.over;

  const verdict = (() => {
    if (!over) return null;
    if (over.winner === -1)
      return { title: "STALEMATE", sub: "The Decree finds both courts equal. No crown falls.", tone: "text-flux" };
    if (over.winner === 0)
      return {
        title: "VICTORY",
        sub:
          over.reason === "crownfall"
            ? "The Crimson Crown is yours. The court kneels."
            : "The Decree is spent — your war-material outweighs the crimson court.",
        tone: "text-gold",
      };
    return {
      title: "DEFEAT",
      sub:
        over.reason === "crownfall"
          ? "Your Crown has fallen. The crimson court reigns."
          : "The Decree is spent — the crimson war-material outweighs yours.",
      tone: "text-blood",
    };
  })();

  // ── reserve chip ────────────────────────────────────────────────────────────
  const reserveChip = (v: number, mode: "desktop" | "mobile" = "desktop") => {
    const avail = hud.reserves[0].includes(v);
    const selected = selReserve === v;
    const forced = hud.mustCrown[0] && hud.turn === 0;
    const dimByForce = forced && v !== 9;
    const isCrownUnit = v === 9;
    return (
      <button
        key={v}
        onClick={() => onChip(v)}
        disabled={!inBattle || !!over || paused || !avail || hud.turn !== 0 || dimByForce}
        title={avail ? `${PIECE_NAMES[v]} — ${MARCH_TEXT[v]}` : `${PIECE_NAMES[v]} — already deployed`}
        className={[
          "group relative flex flex-col items-center justify-center gap-0.5 border rounded-[3px] transition-all duration-150 select-none",
          mode === "mobile"
            ? "flex-1 min-w-0 h-[48px] px-0.5 py-1"
            : "py-2 px-1 min-h-[68px]",
          selected
            ? "border-gold bg-gold/25 text-gold-2 shadow-[0_0_16px_rgba(255,201,60,0.45)] -translate-y-0.5 z-10"
            : isCrownUnit && avail && !dimByForce
              ? "border-gold/80 bg-[#143224] text-gold-2 shadow-[0_0_10px_rgba(255,201,60,0.25)] hover:border-gold hover:bg-[#1a402d]"
              : avail && !dimByForce
                ? "border-[#2a5a63] bg-[#0a2b34] text-gold hover:border-gold/70 hover:bg-[#0e3540] hover:-translate-y-0.5 hover:shadow-[0_0_12px_rgba(255,201,60,0.2)] active:scale-95"
                : "border-[#1a3a42]/70 bg-[#07222b]/80 text-[#3f6a70]",
          forced && isCrownUnit ? "attn-badge ring-1 ring-gold" : "",
        ].join(" ")}
      >
        <span className={`font-display font-black leading-none ${mode === "mobile" ? "text-base sm:text-lg" : "text-xl"} ${v === 9 ? "text-gold-2" : ""}`}>
          {v}
        </span>
        <MarchGlyph v={v} className={mode === "mobile" ? "w-3 h-3 opacity-80" : "w-4 h-4 opacity-80"} />
        {mode === "desktop" && (
          <span className="text-[8px] uppercase tracking-[0.14em] opacity-70 leading-none truncate max-w-full px-0.5">
            {PIECE_NAMES[v]}
          </span>
        )}
        {!avail && (
          <span className="absolute inset-0 grid place-items-center pointer-events-none">
            <span className="block w-[75%] h-px bg-[#3f6a70] rotate-[-24deg]" />
          </span>
        )}
      </button>
    );
  };

  const captureTokens = (values: number[], tone: "gold" | "blood", compact = false) =>
    values.length === 0 ? (
      <span className="text-[10px] uppercase tracking-[0.2em] text-[#3f6a70]">none yet</span>
    ) : (
      <span className="flex flex-wrap gap-1">
        {values.map((v, i) => (
          <span
            key={i}
            className={[
              "grid place-items-center font-display font-bold border",
              compact ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-xs",
              tone === "gold"
                ? "text-gold-2 border-gold/50 bg-gold/10"
                : "text-blood-2 border-blood/50 bg-blood/10",
              v === 9 ? "shadow-[0_0_10px_rgba(255,201,60,0.5)]" : "",
            ].join(" ")}
          >
            {v}
          </span>
        ))}
      </span>
    );

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-full flex flex-col overflow-hidden select-none" onContextMenu={(e) => e.preventDefault()}>
      {/* top bar — only shown in battle */}
      {inBattle && (
        <header
          className="z-20 flex flex-col sm:flex-row sm:items-center sm:gap-3 px-2 sm:px-5 shrink-0 border-b border-[#123f4a] bg-[#061d25]/90 backdrop-blur-sm"
          style={{ paddingTop: "max(0.35rem, env(safe-area-inset-top))" }}
        >
          {/* Main / Top row */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 min-w-0 h-11 sm:h-14">
            <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
              <CrownIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gold drop-shadow-[0_0_8px_rgba(255,201,60,0.6)] shrink-0" />
              <div className="leading-none min-w-0">
                <div className="font-display font-black text-gold text-xs sm:text-lg tracking-[0.12em] sm:tracking-[0.16em] truncate">
                  CROWNFALL
                </div>
                <div className="hidden md:block text-[9px] uppercase tracking-[0.3em] text-mist mt-1">
                  a war of digits
                </div>
              </div>
              <span className="hidden lg:inline-block text-[9px] uppercase tracking-[0.2em] text-flux-dim border border-[#1a4a54] px-2 py-1">
                vs {diff}
              </span>
            </div>

            {/* Decree moves countdown badge (CRITICAL GAME STATE) */}
            <div
              className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 border rounded-[3px] text-[10px] sm:text-xs font-bold uppercase tracking-wider shrink-0 transition-colors ${
                decreeLeft <= 10
                  ? "border-blood/80 text-blood-2 bg-blood/20 warn-pulse"
                  : "border-[#1a4a54] text-mist bg-[#07222b]/80"
              }`}
              title={`Decree moves remaining: ${decreeLeft} of ${MAX_PLIES}`}
            >
              <span className="text-[8px] sm:text-[9px] uppercase tracking-widest opacity-75">Decree:</span>
              <span className={`font-display font-black ${decreeLeft <= 10 ? "text-blood-2 text-xs sm:text-sm" : "text-gold-2"}`}>
                {decreeLeft}
              </span>
            </div>

            {/* sm+ Center info: turn status and score */}
            <div className="hidden sm:flex flex-1 items-center justify-center gap-3 min-w-0">
              <div
                className={[
                  "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 border rounded-[3px] text-[10px] sm:text-xs font-bold uppercase tracking-[0.16em] transition-colors duration-300 shrink-0",
                  over
                    ? "border-[#2a5a63] text-mist"
                    : paused
                      ? "border-flux/60 text-flux bg-flux/10"
                      : aiThinking
                        ? "border-blood/60 text-blood-2 bg-blood/10"
                        : "border-gold/60 text-gold-2 bg-gold/10",
                ].join(" ")}
              >
                {over ? (
                  "Battle ended"
                ) : paused ? (
                  "Paused"
                ) : aiThinking ? (
                  <>
                    <span>Enemy plotting</span>
                    <span className="flex gap-1">
                      <span className="thinking-dot w-1 h-1 bg-blood-2 inline-block" />
                      <span className="thinking-dot w-1 h-1 bg-blood-2 inline-block" />
                      <span className="thinking-dot w-1 h-1 bg-blood-2 inline-block" />
                    </span>
                  </>
                ) : (
                  "Your move"
                )}
              </div>

              {/* score display */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#143d46] bg-[#07212a]/60 rounded-[3px] shrink-0" title="War score — you vs enemy">
                <span className="font-display font-black text-gold-2 text-sm leading-none overflow-hidden">
                  <span key={`s${hud.score[0]}`} className="tick inline-block">{hud.score[0]}</span>
                </span>
                <span className="text-[9px] text-[#3f6a70] uppercase">vs</span>
                <span className="font-display font-black text-blood-2 text-sm leading-none overflow-hidden">
                  <span key={`e${hud.score[1]}`} className="tick inline-block">{hud.score[1]}</span>
                </span>
              </div>
            </div>

            {/* Controls (both mobile and desktop) */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                className="icon-btn"
                onClick={undo}
                disabled={!canUndo}
                title="Recall your last move (U)"
                aria-label="Recall last move"
              >
                <UndoIcon />
              </button>
              <button
                className={`icon-btn ${manualFirst && !manualOpen ? "attn-badge" : ""}`}
                onClick={() => openManual(false)}
                title="Field Manual — how to play"
                aria-label="Field Manual"
              >
                <BookIcon />
              </button>
              <button
                className="icon-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit zoom / fullscreen (F)" : "Zoom screen / fullscreen (F)"}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen zoom"}
              >
                <FullscreenIcon isFullscreen={isFullscreen} />
              </button>
              <button
                className="icon-btn"
                onClick={toggleMute}
                title="Toggle sound (M)"
                aria-label={muted ? "Unmute sound" : "Mute sound"}
              >
                <SoundIcon off={muted} />
              </button>
              <button
                className="icon-btn"
                onClick={togglePause}
                title="War council (Esc)"
                aria-label="War council pause"
                disabled={!!over}
              >
                {paused ? <PlayIcon /> : <PauseIcon />}
              </button>
            </div>
          </div>

          {/* Mobile sub-bar (< sm): Turn status, opponent diff, and score */}
          <div className="flex sm:hidden items-center justify-between gap-2 min-w-0 pb-1.5 pt-0.5 border-t border-[#123f4a]/40">
            <div
              className={[
                "flex items-center gap-1 px-2 py-0.5 border rounded-[3px] text-[10px] font-bold uppercase tracking-[0.14em] transition-colors duration-300 shrink-0",
                over
                  ? "border-[#2a5a63] text-mist"
                  : paused
                    ? "border-flux/60 text-flux bg-flux/10"
                    : aiThinking
                      ? "border-blood/60 text-blood-2 bg-blood/10"
                      : "border-gold/60 text-gold-2 bg-gold/10",
              ].join(" ")}
            >
              {over ? (
                "Ended"
              ) : paused ? (
                "Paused"
              ) : aiThinking ? (
                <>
                  <span>Foe</span>
                  <span className="flex gap-1">
                    <span className="thinking-dot w-1 h-1 bg-blood-2 inline-block" />
                    <span className="thinking-dot w-1 h-1 bg-blood-2 inline-block" />
                    <span className="thinking-dot w-1 h-1 bg-blood-2 inline-block" />
                  </span>
                </>
              ) : (
                "Your Turn"
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[9px] uppercase tracking-wider text-mist">
                vs {diff}
              </span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 border border-[#143d46] bg-[#07212a]/80 rounded-[3px]" title="War score — you vs enemy">
                <span className="font-display font-black text-gold-2 text-xs leading-none overflow-hidden">
                  <span key={`s${hud.score[0]}`} className="tick inline-block">{hud.score[0]}</span>
                </span>
                <span className="text-[8px] text-[#3f6a70]">vs</span>
                <span className="font-display font-black text-blood-2 text-xs leading-none overflow-hidden">
                  <span key={`e${hud.score[1]}`} className="tick inline-block">{hud.score[1]}</span>
                </span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* battle area — hidden during menu */}
      <div className={`flex-1 flex min-h-0 ${!inBattle ? "hidden" : ""}`}>
        {/* player panel (Desktop: lg:flex) */}
        <aside className="hidden lg:flex w-52 xl:w-64 shrink-0 flex-col gap-2.5 p-2.5 lg:p-3 border-r border-[#123f4a] bg-[#051920]/70 overflow-y-auto">
          <div className="panel panel-hover p-2.5 lg:p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-display font-bold text-gold text-xs lg:text-sm tracking-[0.18em]">YOUR WARBAND</span>
              <span className="font-display font-black text-gold-2 text-xl lg:text-2xl leading-none overflow-hidden" title="War score">
                <span key={hud.score[0]} className="tick inline-block">{hud.score[0]}</span>
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {RESERVE_ORDER.map((v) => reserveChip(v, "desktop"))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-mist">
              <span>Crown</span>
              <span className={`flex items-center gap-1 ${hud.crownOnBoard[0] ? "text-gold font-bold" : "text-[#3f6a70]"}`}>
                <CrownIcon className="w-3.5 h-3.5" />
                {hud.crownOnBoard[0] ? "on the field" : "in reserve"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-mist">
              <span>Material</span>
              <span className="text-fog font-bold overflow-hidden">
                <span key={hud.material[0]} className="tick inline-block">{hud.material[0]}</span>
              </span>
            </div>
          </div>
          <div className="panel-flat p-2.5 lg:p-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-blood-2 font-bold mb-1.5">Foes slain</div>
            {captureTokens(hud.captures[0], "blood")}
          </div>
        </aside>

        {/* board column */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* enemy strip (mobile & tablet portrait: < lg) */}
          <div className="lg:hidden flex items-center justify-between gap-2 px-2.5 sm:px-4 py-1.5 border-b border-[#123f4a] bg-[#12060a]/60 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display font-bold text-blood text-xs tracking-[0.16em] shrink-0">CRIMSON COURT</span>
              <span className="font-display font-black text-blood-2 text-xs sm:text-sm shrink-0">{hud.score[1]} pts</span>
              <span className={`text-[9px] uppercase tracking-wider hidden xs:inline-flex items-center gap-0.5 ${hud.crownOnBoard[1] ? "text-blood-2 font-semibold" : "text-[#3f6a70]"}`}>
                <CrownIcon className="w-3 h-3" />
                {hud.crownOnBoard[1] ? "Field" : "Reserve"}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[9px] uppercase tracking-wider text-mist hidden xs:inline">Reserves:</span>
              <div className="flex gap-0.5">
                {RESERVE_ORDER.map((v) =>
                  hud.reserves[1].includes(v) ? (
                    <span
                      key={v}
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 grid place-items-center text-[8.5px] sm:text-[9px] font-bold border ${
                        v === 9 ? "text-gold border-gold/70 bg-gold/15" : "text-blood-2 border-blood/40 bg-blood/10"
                      }`}
                    >
                      {v}
                    </span>
                  ) : null,
                )}
                {hud.reserves[1].length === 0 && (
                  <span className="text-[9px] text-[#3f6a70] uppercase tracking-wider">Empty</span>
                )}
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-h-0">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 touch-none"
              onPointerDown={onCanvasDown}
              onPointerMove={onCanvasMove}
              onPointerLeave={() => {
                hoverKey.current = "";
                if (rendRef.current) rendRef.current.view.hover = null;
              }}
            />
            {toast && (
              <div
                key={toast.id}
                className="toast-in absolute top-3 left-1/2 z-30 panel-flat px-4 sm:px-5 py-2 font-display font-bold text-[11px] sm:text-sm tracking-[0.16em] sm:tracking-[0.22em] text-gold-2 text-center max-w-[92vw]"
              >
                {toast.msg}
              </div>
            )}
          </div>

          {/* player strip (mobile & tablet portrait: < lg, full-width non-scrolling flex tray) */}
          <div className="lg:hidden flex flex-col gap-1 px-2 sm:px-3 py-1.5 border-t border-[#123f4a] bg-[#051920]/95 shrink-0">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] px-0.5 text-mist">
              <span className="font-display font-bold text-gold text-[10px] sm:text-[11px] tracking-[0.16em]">WARBAND DEPLOY</span>
              <span className="flex items-center gap-2">
                <span>Score: <strong className="text-gold-2 font-display font-black">{hud.score[0]}</strong></span>
                <span className={`flex items-center gap-0.5 ${hud.crownOnBoard[0] ? "text-gold font-bold" : "text-[#3f6a70]"}`}>
                  <CrownIcon className="w-3 h-3" />
                  {hud.crownOnBoard[0] ? "Field" : "Reserve"}
                </span>
              </span>
            </div>
            {/* 9 pieces in a single adaptive flex row across the screen */}
            <div className="flex items-center gap-0.5 sm:gap-1 w-full">
              {RESERVE_ORDER.map((v) => reserveChip(v, "mobile"))}
            </div>
          </div>
        </main>

        {/* enemy panel (Desktop: lg:flex) */}
        <aside className="hidden lg:flex w-52 xl:w-64 shrink-0 flex-col gap-2.5 p-2.5 lg:p-3 border-l border-[#123f4a] bg-[#0d070b]/40 overflow-y-auto">
          <div className="panel panel-hover p-2.5 lg:p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-display font-bold text-blood text-xs lg:text-sm tracking-[0.14em]">CRIMSON COURT</span>
              <span className="font-display font-black text-blood-2 text-xl lg:text-2xl leading-none overflow-hidden">
                <span key={hud.score[1]} className="tick inline-block">{hud.score[1]}</span>
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {RESERVE_ORDER.map((v) =>
                hud.reserves[1].includes(v) ? (
                  <span
                    key={v}
                    className={`w-7 h-7 sm:w-8 sm:h-8 grid place-items-center text-xs sm:text-sm font-display font-bold border ${
                      v === 9 ? "text-gold border-gold/70 bg-gold/15" : "text-blood-2 border-blood/40 bg-blood/10"
                    }`}
                  >
                    {v}
                  </span>
                ) : null,
              )}
              {hud.reserves[1].length === 0 && (
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#3f6a70]">fully deployed</span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-mist">
              <span>Crown</span>
              <span className={`flex items-center gap-1 ${hud.crownOnBoard[1] ? "text-blood-2 font-bold" : "text-[#3f6a70]"}`}>
                <CrownIcon className="w-3.5 h-3.5" />
                {hud.crownOnBoard[1] ? "on the field" : "in reserve"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-mist">
              <span>Material</span>
              <span className="text-fog font-bold overflow-hidden">
                <span key={hud.material[1]} className="tick inline-block">{hud.material[1]}</span>
              </span>
            </div>
          </div>
          <div className="panel-flat p-2.5 lg:p-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-gold-2 font-bold mb-1.5">Your fallen</div>
            {captureTokens(hud.captures[1], "gold")}
          </div>
          {hud.mustCrown[1] && !over && (
            <div className="panel-flat p-2.5 text-[10px] uppercase tracking-[0.2em] text-blood-2 text-center border-blood/40">
              decree: the enemy crown musters
            </div>
          )}
        </aside>
      </div>

      {/* guidance strip — only in battle */}
      {inBattle && (
        <footer
          className="z-20 shrink-0 flex items-center justify-between gap-2 px-2.5 sm:px-4 py-1.5 min-h-[36px] border-t border-[#123f4a] bg-[#061d25]/90 backdrop-blur-sm"
          style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={`w-1.5 h-1.5 rotate-45 shrink-0 hidden sm:block ${
                selInfo ? "bg-gold shadow-[0_0_8px_rgba(255,201,60,0.8)]" : "bg-flux shadow-[0_0_8px_rgba(53,240,255,0.7)]"
              }`}
            />
            <p
              key={selInfo ?? hint}
              className={`rise-in text-[10px] sm:text-xs tracking-wide leading-snug truncate ${
                selInfo ? "text-gold-2 font-medium" : "text-mist"
              }`}
            >
              {selInfo ?? hint}
            </p>
          </div>

          {/* Abhishek Credit with Motion */}
          <a
            href="https://abhiishek.is-a.dev/"
            target="_blank"
            rel="noopener noreferrer"
            title="Visit Abhishek's portfolio (abhiishek.is-a.dev)"
            className="author-badge shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-gold/50 shadow-[0_0_12px_rgba(255,201,60,0.25)] hover:border-gold hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gold"></span>
            </span>
            <span className="text-[8.5px] sm:text-[9.5px] font-display font-black uppercase tracking-[0.14em] text-gold-2 drop-shadow-[0_0_6px_rgba(255,201,60,0.6)]">
              ⚔️ <span className="hidden xs:inline">Built by </span>Abhishek
            </span>
          </a>

          {hud.mustCrown[0] && hud.turn === 0 && !over && (
            <span className="attn-badge shrink-0 font-display font-bold text-[9px] sm:text-[10px] tracking-[0.16em] border border-blood/60 bg-blood/15 px-2 py-1">
              <span className="hidden sm:inline">DECREE — MUSTER THE CROWN</span>
              <span className="sm:hidden">CROWN NOW</span>
            </span>
          )}
        </footer>
      )}

      {/* floating how-to-play button */}
      {inBattle && !over && !manualOpen && (
        <button
          onClick={() => openManual(false)}
          title="How to play"
          aria-label="How to play"
          className="help-fab z-30 absolute w-10 h-10 sm:w-11 sm:h-11 rounded-full grid place-items-center font-display font-black text-lg sm:text-xl text-[#241500] border border-[#ffe9ad] transition-transform duration-150 hover:scale-110 active:scale-95 cursor-pointer right-3 sm:right-4 bottom-[max(6.8rem,calc(env(safe-area-inset-bottom)+6.2rem))] lg:bottom-[max(3.5rem,calc(env(safe-area-inset-bottom)+3rem))]"
          style={{
            background: "linear-gradient(180deg,#ffe08a,#ffc93c 45%,#d99a12)",
          }}
        >
          ?
        </button>
      )}

      {/* ── LANDING PAGE (100% OPAQUE STANDALONE MENU) ── */}
      {screen === "menu" && (
        <div
          className="fixed inset-0 z-50 bg-[#030e13] flex flex-col justify-between overflow-y-auto px-3 sm:px-8 py-3 sm:py-6 select-none"
          style={{
            background: `
              radial-gradient(1100px 700px at 50% 28%, rgba(14, 52, 64, 0.45), transparent 75%),
              radial-gradient(800px 350px at 50% 5%, rgba(255, 201, 60, 0.08), transparent 60%),
              radial-gradient(ellipse at 50% 100%, rgba(2, 10, 14, 0.95), transparent 70%),
              radial-gradient(ellipse at center, transparent 40%, rgba(1, 6, 8, 0.9) 100%),
              #030e13
            `,
          }}
        >
          {/* Subtle atmospheric frame for desktop */}
          <div className="pointer-events-none absolute inset-3 sm:inset-5 border border-[#144852]/25 rounded-[4px] hidden sm:block">
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t border-l border-gold/40" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t border-r border-gold/40" />
            <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b border-l border-gold/40" />
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b border-r border-gold/40" />
          </div>

          {/* Top Utility Bar */}
          <header className="relative z-10 w-full flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-display font-semibold uppercase tracking-[0.22em] sm:tracking-[0.25em] text-flux/80">
              <CrownIcon className="w-3.5 h-3.5 text-gold/80" />
              <span>Sudoku Law × Chess March</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className="icon-btn cursor-pointer"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit zoom / fullscreen (F)" : "Zoom screen / fullscreen (F)"}
                aria-label="Toggle Fullscreen"
              >
                <FullscreenIcon isFullscreen={isFullscreen} />
              </button>
              <button
                className="icon-btn cursor-pointer"
                onClick={toggleMute}
                title={muted ? "Unmute sound (M)" : "Mute sound (M)"}
                aria-label="Toggle Sound"
              >
                <SoundIcon off={muted} />
              </button>
            </div>
          </header>

          {/* Centered Hero & Game Mode Selection */}
          <main className="relative z-10 w-full max-w-xl mx-auto flex-1 flex flex-col items-center justify-center text-center px-2 py-2 sm:py-5 min-h-min">
            {/* Crown Emblem */}
            <div className="mb-1.5 sm:mb-3">
              <CrownIcon className="w-8 h-8 sm:w-11 sm:h-11 text-gold drop-shadow-[0_0_18px_rgba(255,201,60,0.55)] mx-auto" />
            </div>

            {/* CROWNFALL Title */}
            <h1 className="font-display font-black text-[clamp(2.3rem,9.5vw,4.5rem)] tracking-[0.12em] sm:tracking-[0.18em] text-transparent bg-clip-text bg-gradient-to-b from-[#fff6cc] via-[#ffc93c] to-[#b37700] drop-shadow-[0_4px_30px_rgba(255,201,60,0.35)] leading-none select-none whitespace-nowrap">
              CROWNFALL
            </h1>

            {/* A WAR OF DIGITS Subtitle */}
            <div className="text-[11px] sm:text-sm font-display font-bold uppercase tracking-[0.28em] sm:tracking-[0.34em] text-mist mt-2 sm:mt-3">
              A War of Digits
            </div>

            {/* Short Atmospheric Description */}
            <p className="text-xs sm:text-sm text-fog/75 max-w-md mx-auto mt-2.5 sm:mt-4 leading-relaxed font-light px-1">
              Where chess spatial tactics collide with the ancient law of numbers. Command digits 1 through 9, guard your Crown, and wage tactical regicide.
            </p>

            {/* Foe Selection Card */}
            <div className="w-full mt-4 sm:mt-7 p-3 sm:p-4 rounded-[4px] border border-[#16454f] bg-[#051c24]/95 shadow-[0_12px_36px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between border-b border-[#123942] pb-1.5 sm:pb-2 mb-2.5 sm:mb-3">
                <span className="text-[10px] sm:text-[11px] font-display font-bold uppercase tracking-[0.2em] text-fog">
                  Choose Your Foe
                </span>
                <span className="text-[9px] uppercase tracking-[0.16em] text-mist/70">
                  AI Opponent
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                {DIFFS.map((d) => {
                  const isSelected = diff === d.id;
                  return (
                    <button
                      key={d.id}
                      onClick={() => {
                        setDiff(d.id);
                        diffRef.current = d.id;
                        sfx.foeSelect(d.id);
                      }}
                      className={`group text-left p-2 sm:p-3 rounded-[3px] border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-gold/90 bg-gradient-to-b from-[#163a38] to-[#0a2327] shadow-[0_0_14px_rgba(255,201,60,0.2)]"
                          : "border-[#143d46] bg-[#07212a]/70 hover:border-gold/50 hover:bg-[#0a2a35]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                        <span className={`font-display font-bold text-[11px] sm:text-sm tracking-[0.08em] sm:tracking-[0.12em] truncate ${isSelected ? "text-gold-2" : "text-fog"}`}>
                          {d.name}
                        </span>
                        <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border shrink-0 ${isSelected ? "bg-gold border-gold shadow-[0_0_6px_rgba(255,201,60,0.8)]" : "border-[#255762]"}`} />
                      </div>
                      <p className={`text-[8.5px] sm:text-[10px] leading-tight sm:leading-snug truncate ${isSelected ? "text-mist font-medium" : "text-mist/70"}`}>
                        {d.blurb}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons: TO BATTLE (Primary) & FIELD MANUAL (Secondary) */}
            <div className="flex flex-col items-center justify-center gap-2 sm:gap-2.5 mt-4 sm:mt-6 w-full max-w-sm">
              <button
                onClick={() => startGame(diff)}
                className="w-full btn-gold btn-shine py-3 sm:py-3.5 rounded-[4px] text-base sm:text-lg font-display font-black tracking-[0.2em] text-[#1c1200] shadow-[0_4px_24px_rgba(255,201,60,0.35)] hover:shadow-[0_6px_32px_rgba(255,201,60,0.55)] cursor-pointer transition-all duration-200"
              >
                TO BATTLE
              </button>
              <button
                onClick={() => openManual(false)}
                className="btn-ghost w-full py-2.5 rounded-[4px] text-xs sm:text-sm font-display font-bold tracking-[0.16em] flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
              >
                <BookIcon className="w-4 h-4" />
                <span>FIELD MANUAL & RULES</span>
              </button>
            </div>
          </main>

          {/* Footer & Creator Signature */}
          <footer className="relative z-10 w-full flex flex-col items-center justify-center gap-1 text-center py-2 shrink-0">
            <a
              href="https://abhiishek.is-a.dev/"
              target="_blank"
              rel="noopener noreferrer"
              title="Visit Abhishek's portfolio (abhiishek.is-a.dev)"
              className="group inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-gold/40 bg-gold/[0.08] shadow-[0_0_10px_rgba(255,201,60,0.15)] hover:border-gold hover:bg-gold/15 hover:shadow-[0_0_18px_rgba(255,201,60,0.35)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gold"></span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-display font-bold tracking-[0.2em] uppercase text-gold-2/95 group-hover:text-gold-2">
                BUILT BY ABHISHEK
              </span>
              <svg
                viewBox="0 0 12 12"
                className="w-2.5 h-2.5 text-gold/60 group-hover:text-gold group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M3.5 8.5l5-5M4 3.5h4.5V8" />
              </svg>
            </a>
            <div className="text-[8px] sm:text-[9px] uppercase tracking-[0.22em] text-[#345b63]">
              touch / mouse to command · F zoom screen · esc war council · M mute · U recall move
            </div>
          </footer>
        </div>
      )}

      {/* ── PAUSE ── */}
      {paused && inBattle && !over && !manualOpen && (
        <div className="overlay-in fixed inset-0 z-50 bg-[#04151b]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="panel p-5 sm:p-8 w-full max-w-sm m-auto max-h-[92dvh] overflow-y-auto rise-in text-center">
            <div className="font-display font-black text-2xl sm:text-3xl tracking-[0.18em] text-fog">WAR COUNCIL</div>
            <div className="text-[10px] uppercase tracking-[0.26em] text-mist mt-1">the field holds its breath</div>
            <div className="mt-5 sm:mt-6 flex flex-col gap-2.5">
              <button className="btn-gold px-6 py-3 text-sm sm:text-base font-black tracking-[0.2em]" onClick={togglePause}>
                RESUME
              </button>
              <button className="btn-ghost px-6 py-2.5 text-xs sm:text-sm font-semibold tracking-[0.16em] flex items-center justify-center gap-2" onClick={() => startGame(diff)}>
                <RestartIcon /> RESTART BATTLE
              </button>
              <button
                className="btn-ghost px-6 py-2.5 text-xs sm:text-sm font-semibold tracking-[0.16em] flex items-center justify-center gap-2"
                onClick={toggleFullscreen}
              >
                <FullscreenIcon isFullscreen={isFullscreen} />
                <span>{isFullscreen ? "RESTORE WINDOW (F)" : "ZOOM SCREEN (F)"}</span>
              </button>
              <button
                className="btn-ghost px-6 py-2.5 text-xs sm:text-sm font-semibold tracking-[0.16em] flex items-center justify-center gap-2"
                onClick={() => openManual(false)}
              >
                <BookIcon /> FIELD MANUAL
              </button>
              <button className="btn-ghost px-6 py-2.5 text-xs sm:text-sm font-semibold tracking-[0.16em] flex items-center justify-center gap-2" onClick={toMenu}>
                <FlagIcon /> ABANDON SIEGE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FIELD MANUAL ── */}
      {manualOpen && (
        <FieldManual
          firstWar={manualWasFirst}
          onClose={() => {
            setManualOpen(false);
            sfx.manualClose();
          }}
        />
      )}

      {/* ── GAME OVER ── */}
      {showOver && over && verdict && (
        <div className="overlay-in fixed inset-0 z-50 bg-[#04151b]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="panel p-5 sm:p-10 w-full max-w-md text-center rise-in m-auto max-h-[92dvh] overflow-y-auto">
            <CrownIcon className={`w-9 h-9 sm:w-10 sm:h-10 mx-auto ${verdict.tone}`} />
            <div className={`font-display font-black text-4xl sm:text-6xl tracking-[0.1em] mt-2 ${verdict.tone}`}>
              {verdict.title}
            </div>
            <p className="text-mist text-xs sm:text-sm mt-2 sm:mt-3 leading-relaxed">{verdict.sub}</p>
            <div className="mt-5 sm:mt-6 grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2 text-left text-xs">
              <div className="flex justify-between border-b border-[#1a4a54]/60 pb-1">
                <span className="text-mist uppercase tracking-widest text-[9px] sm:text-[10px]">War score</span>
                <span className="font-display font-bold text-gold-2 text-sm sm:text-base">{hud.score[0]}</span>
              </div>
              <div className="flex justify-between border-b border-[#1a4a54]/60 pb-1">
                <span className="text-mist uppercase tracking-widest text-[9px] sm:text-[10px]">Enemy score</span>
                <span className="font-display font-bold text-blood-2 text-sm sm:text-base">{hud.score[1]}</span>
              </div>
              <div className="flex justify-between border-b border-[#1a4a54]/60 pb-1">
                <span className="text-mist uppercase tracking-widest text-[9px] sm:text-[10px]">Your Material</span>
                <span className="font-display font-bold text-gold-2 text-sm sm:text-base">{hud.material[0]}</span>
              </div>
              <div className="flex justify-between border-b border-[#1a4a54]/60 pb-1">
                <span className="text-mist uppercase tracking-widest text-[9px] sm:text-[10px]">Enemy Material</span>
                <span className="font-display font-bold text-blood-2 text-sm sm:text-base">{hud.material[1]}</span>
              </div>
              <div className="flex justify-between border-b border-[#1a4a54]/60 pb-1">
                <span className="text-mist uppercase tracking-widest text-[9px] sm:text-[10px]">Foes slain</span>
                <span className="text-fog font-bold">{hud.captures[0].length}</span>
              </div>
              <div className="flex justify-between border-b border-[#1a4a54]/60 pb-1">
                <span className="text-mist uppercase tracking-widest text-[9px] sm:text-[10px]">Your fallen</span>
                <span className="text-fog font-bold">{hud.captures[1].length}</span>
              </div>
              <div className="flex justify-between border-b border-[#1a4a54]/60 pb-1">
                <span className="text-mist uppercase tracking-widest text-[9px] sm:text-[10px]">Moves</span>
                <span className="text-fog font-bold">{totalPlies}</span>
              </div>
              <div className="flex justify-between border-b border-[#1a4a54]/60 pb-1">
                <span className="text-mist uppercase tracking-widest text-[9px] sm:text-[10px]">Time</span>
                <span className="text-fog font-bold">{fmtTime(seconds)}</span>
              </div>
            </div>
            <div className="mt-6 sm:mt-7 flex flex-col gap-2.5">
              <button className="btn-gold px-6 py-3 text-sm sm:text-base font-black tracking-[0.2em]" onClick={() => startGame(diff)}>
                FIGHT AGAIN
              </button>
              <button className="btn-ghost px-6 py-2.5 text-xs sm:text-sm font-semibold tracking-[0.16em] flex items-center justify-center gap-2" onClick={toMenu}>
                <FlagIcon /> WAR COUNCIL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
