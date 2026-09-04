import { useEffect, useRef, useState } from "react";
import { MARCH, PIECE_NAMES, MARCH_TEXT } from "../game/engine";
import { BladeIcon, BookIcon, CloseIcon, CrownIcon } from "./glyphs";

/* A small 5×5 board used for picture-examples. */
interface MiniPiece {
  r: number;
  c: number;
  side: 0 | 1;
  value: number;
}
function MiniBoard({
  pieces,
  marks = [],
  bad = [],
  size = 34,
  caption,
}: {
  pieces: MiniPiece[];
  marks?: { r: number; c: number; kind: "ok" | "no" }[];
  bad?: { r: number; c: number }[];
  size?: number;
  caption?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div
        className="grid border border-flux/30 bg-[#07222b]"
        style={{ gridTemplateColumns: `repeat(5, ${size}px)` }}
      >
        {Array.from({ length: 25 }).map((_, i) => {
          const r = Math.floor(i / 5);
          const c = i % 5;
          const dark = (r + c) % 2 === 0;
          const p = pieces.find((x) => x.r === r && x.c === c);
          const mk = marks.find((x) => x.r === r && x.c === c);
          const isBad = bad.some((x) => x.r === r && x.c === c);
          const bg = isBad ? "bg-[#3d0d15]" : dark ? "bg-[#0a2831]" : "bg-[#0e3540]";
          return (
            <div
              key={i}
              className={`relative grid place-items-center border border-[#123f4a]/50 ${bg}`}
              style={{ width: size, height: size }}
            >
              {p && (
                <div
                  className={`grid place-items-center rounded-full font-display font-black shadow ${
                    p.side === 0 ? "bg-gold text-[#241500]" : "bg-blood text-white"
                  } ${p.value === 9 ? "ring-2 ring-white/80" : ""}`}
                  style={{ width: size - 9, height: size - 9, fontSize: size * 0.42 }}
                >
                  {p.value === 9 ? <CrownIcon className="w-[62%] h-[62%]" /> : p.value}
                </div>
              )}
              {mk && (
                <div
                  className={`absolute rounded-full border-2 ${mk.kind === "ok" ? "border-flux" : "border-blood"}`}
                  style={{ width: size - 9, height: size - 9 }}
                >
                  {mk.kind === "no" && (
                    <div className="absolute left-1/2 top-1/2 h-[115%] w-[2.5px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-blood" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {caption && <div className="text-[11px] text-mist text-center max-w-[230px] leading-snug">{caption}</div>}
    </div>
  );
}

/* Draws where one unit can move, straight from the engine's own table — always truthful. */
function MarchDiagram({ v, size = 22 }: { v: number; size?: number }) {
  const spec = MARCH[v];
  const cells: { k: number; kind: "dot" | "ring" }[] = [];
  for (const [dr, dc] of spec.dirs) {
    if (spec.jump) {
      cells.push({ k: (3 + dr) * 5 + (3 + dc), kind: "ring" });
      continue;
    }
    for (let s = 1; s <= spec.max; s++) cells.push({ k: (3 + dr * s) * 5 + (3 + dc), kind: "dot" });
  }
  return (
    <div className="grid border border-flux/25 bg-[#07222b] shrink-0" style={{ gridTemplateColumns: `repeat(5, ${size}px)` }}>
      {Array.from({ length: 25 }).map((_, i) => {
        const dark = (Math.floor(i / 5) + i) % 2 === 0;
        const hit = cells.find((x) => x.k === i);
        const center = i === 12;
        return (
          <div
            key={i}
            className={`grid place-items-center border border-[#123f4a]/40 ${dark ? "bg-[#0a2831]" : "bg-[#0d3039]"}`}
            style={{ width: size, height: size }}
          >
            {center ? (
              <div
                className="w-[68%] h-[68%] rounded-full bg-gold grid place-items-center font-display font-black text-[#241500]"
                style={{ fontSize: size * 0.42 }}
              >
                {v}
              </div>
            ) : hit ? (
              hit.kind === "dot" ? (
                <div className="w-[34%] h-[34%] rounded-full bg-flux" />
              ) : (
                <div className="w-[68%] h-[68%] rounded-full border-2 border-dashed border-flux" />
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* One capture example:  [you] → [enemy]  result */
function CaptureRow({ you, enemy, ok, note }: { you: number; enemy: number; ok: boolean; note: string }) {
  return (
    <div className="flex items-center gap-2.5 panel-flat panel-hover px-3 py-2.5">
      <div className="w-9 h-9 shrink-0 rounded-full bg-gold text-[#241500] grid place-items-center font-display font-black shadow">
        {you === 9 ? <CrownIcon className="w-5 h-5" /> : you}
      </div>
      <svg viewBox="0 0 24 24" className="w-4 h-4 text-mist shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M4 12h14M13 6l6 6-6 6" />
      </svg>
      <div
        className={`w-9 h-9 shrink-0 rounded-full text-white grid place-items-center font-display font-black shadow ${
          enemy === 9 ? "bg-blood ring-2 ring-white/80" : "bg-blood"
        }`}
      >
        {enemy === 9 ? <CrownIcon className="w-5 h-5" /> : enemy}
      </div>
      <span
        className={`font-display font-black text-xs tracking-[0.14em] px-2 py-1 border shrink-0 ${
          ok ? "text-[#7dffd4] border-[#2e8f74] bg-[#0d3b31]/60" : "text-blood-2 border-blood/50 bg-blood/10"
        }`}
      >
        {ok ? "YES" : "NO"}
      </span>
      <span className="text-xs text-mist leading-snug min-w-0">{note}</span>
    </div>
  );
}

/* Scroll-reveal wrapper */
function Rev({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVis(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVis(true);
          io.disconnect();
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px 8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`reveal ${vis ? "reveal-shown" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const CHAPTERS: [string, string][] = [
  ["goal", "Goal"],
  ["turn", "Your Turn"],
  ["moves", "Moves"],
  ["captures", "Captures"],
  ["rule", "The Rule"],
  ["crown", "Crown & Clock"],
  ["buttons", "Buttons"],
];

function Chap({ id, step, title, children }: { id: string; step: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <Rev>
        <div className="flex items-center gap-3 mb-4">
          <span className="font-display font-black text-gold text-sm border border-gold/40 bg-gold/10 px-2.5 py-1 tracking-[0.18em]">
            {step}
          </span>
          <h2 className="font-display font-black text-fog text-xl sm:text-3xl tracking-[0.06em]">{title}</h2>
          <span className="flex-1 h-px bg-gradient-to-r from-gold/50 via-flux/25 to-transparent" />
        </div>
      </Rev>
      {children}
    </section>
  );
}

export default function FieldManual({ firstWar, onClose }: { firstWar: boolean; onClose: () => void }) {
  const [active, setActive] = useState("goal");
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      let cur = CHAPTERS[0][0];
      for (const [id] of CHAPTERS) {
        const s = el.querySelector(`#${id}`);
        if (s && s.getBoundingClientRect().top - el.getBoundingClientRect().top < 140) cur = id;
      }
      setActive(cur);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const jump = (id: string) => {
    const el = scroller.current?.querySelector(`#${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="overlay-in fixed inset-0 z-50 bg-[#04151b]/92 backdrop-blur-md flex items-center justify-center p-2 sm:p-5"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="panel w-full max-w-3xl h-[94vh] flex flex-col overflow-hidden rise-in" style={{ height: "94dvh" }}>
        {/* header */}
        <div className="shrink-0 flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[#123f4a] bg-[#07222b]/80">
          <CrownIcon className="w-6 h-6 text-gold shrink-0" />
          <div className="min-w-0">
            <div className="font-display font-black text-gold text-base sm:text-xl tracking-[0.14em] leading-none">
              HOW TO PLAY
            </div>
            <div className="text-[9px] uppercase tracking-[0.28em] text-mist mt-1">read once · about 60 seconds</div>
          </div>
          {firstWar && (
            <span className="hidden md:inline-block ml-2 text-[9px] uppercase tracking-[0.18em] text-gold-2 border border-gold/50 bg-gold/10 px-2 py-1 attn-badge">
              first war — read this before you deploy
            </span>
          )}
          <div className="flex-1" />
          <button
            className="btn-gold px-3.5 sm:px-6 py-2 text-[11px] sm:text-sm font-black tracking-[0.14em] sm:tracking-[0.18em]"
            onClick={onClose}
          >
            {firstWar ? <><span className="hidden sm:inline">GOT IT — TO BATTLE</span><span className="sm:hidden">TO BATTLE</span></> : "CLOSE"}
          </button>
          <button className="icon-btn hidden sm:grid" onClick={onClose} title="Close">
            <CloseIcon />
          </button>
        </div>

        {/* chapter nav */}
        <div className="shrink-0 flex gap-1.5 px-3 sm:px-4 py-2.5 overflow-x-auto no-scrollbar border-b border-[#123f4a]/70 bg-[#061d25]/60">
          {CHAPTERS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => jump(id)}
              className={[
                "shrink-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] border transition-all duration-150 hover:-translate-y-0.5",
                active === id
                  ? "border-gold text-gold-2 bg-gold/15 shadow-[0_0_12px_rgba(255,201,60,0.25)]"
                  : "border-[#1a4a54] text-mist hover:border-flux/50 hover:text-fog",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* body */}
        <div ref={scroller} className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-6 space-y-9 sm:space-y-11">
          {/* 1 — GOAL */}
          <Chap id="goal" step="01" title="How you win">
            <div className="grid sm:grid-cols-2 gap-3">
              <Rev>
                <div className="panel-flat panel-hover p-4 h-full">
                  <div className="flex items-center gap-2.5 mb-2">
                    <CrownIcon className="w-7 h-7 text-blood-2" />
                    <span className="font-display font-black text-fog text-lg">WIN NOW</span>
                  </div>
                  <p className="text-sm text-mist leading-relaxed">
                    Capture the enemy <span className="text-blood-2 font-bold">9 — the Crown</span>. The game ends
                    instantly and you win.
                  </p>
                </div>
              </Rev>
              <Rev delay={90}>
                <div className="panel-flat panel-hover p-4 h-full">
                  <div className="flex items-center gap-2.5 mb-2">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 text-flux" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3.5 2" />
                    </svg>
                    <span className="font-display font-black text-fog text-lg">WIN ON POINTS</span>
                  </div>
                  <p className="text-sm text-mist leading-relaxed">
                    The game lasts <span className="text-fog font-bold">60 moves</span>. When they run out, the side
                    with <span className="text-flux font-bold">more points</span> wins. Points = every number on the
                    board plus every number still in your tray (a Crown counts as 15).
                  </p>
                </div>
              </Rev>
            </div>
            <Rev delay={140}>
              <div className="mt-3 flex items-start gap-2.5 text-xs text-mist border-l-2 border-gold/60 pl-3 py-1">
                <span className="w-3 h-3 rounded-full bg-gold shrink-0 mt-0.5" />
                <span>
                  <span className="text-gold-2 font-bold">Gold is you.</span>{" "}
                  <span className="text-blood-2 font-bold">Red is the enemy.</span> You move first. Your tray of
                  numbers is the row of gold chips under the board.
                </span>
              </div>
            </Rev>
          </Chap>

          {/* 2 — YOUR TURN */}
          <Chap id="turn" step="02" title="Your turn — do ONE thing">
            <div className="grid sm:grid-cols-2 gap-3">
              <Rev>
                <div className="panel-flat panel-hover p-4 h-full">
                  <div className="font-display font-black text-gold text-3xl">A</div>
                  <div className="font-display font-bold text-fog tracking-[0.1em] text-sm mt-1 mb-2">PLACE A NUMBER</div>
                  <ol className="text-sm text-mist space-y-1.5 list-decimal list-inside">
                    <li>Tap a number in your tray.</li>
                    <li>Squares light up with gold dots.</li>
                    <li>Tap one of those squares.</li>
                  </ol>
                </div>
              </Rev>
              <Rev delay={90}>
                <div className="panel-flat panel-hover p-4 h-full">
                  <div className="font-display font-black text-flux text-3xl">B</div>
                  <div className="font-display font-bold text-fog tracking-[0.1em] text-sm mt-1 mb-2">
                    MOVE A PIECE ON THE BOARD
                  </div>
                  <ol className="text-sm text-mist space-y-1.5 list-decimal list-inside">
                    <li>Tap one of your gold pieces.</li>
                    <li>Cyan dots = where it can go. Red rings = enemies it can capture.</li>
                    <li>Tap a dot or a ring.</li>
                  </ol>
                </div>
              </Rev>
            </div>
            <Rev delay={140}>
              <p className="mt-3 text-xs text-mist">
                That's the whole turn: <span className="text-fog font-semibold">one action</span>, then the enemy
                moves. Tap anywhere else to cancel a selection.
              </p>
            </Rev>
          </Chap>

          {/* 3 — MOVES */}
          <Chap id="moves" step="03" title="Every number moves differently">
            <Rev>
              <p className="text-sm text-mist mb-4 max-w-xl">
                Cyan dots show where a piece can go. Pieces <span className="text-fog font-bold">slide</span> and stop
                at the first piece in their way — except the <span className="text-flux font-bold">3 (Knight)</span>,
                which jumps over everything.
              </p>
            </Rev>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v, i) => (
                <Rev key={v} delay={i * 40}>
                  <div className="flex items-center gap-3.5 panel-flat panel-hover px-3 py-2.5">
                    <span
                      className={`w-10 h-10 shrink-0 grid place-items-center rounded-full font-display font-black text-lg shadow ${
                        v === 9 ? "bg-gold text-[#241500] ring-2 ring-white/70" : "bg-gold/90 text-[#241500]"
                      }`}
                    >
                      {v === 9 ? <CrownIcon className="w-5 h-5" /> : v}
                    </span>
                    <MarchDiagram v={v} size={17} />
                    <div className="min-w-0">
                      <div className="font-display font-bold text-fog text-[11px] tracking-[0.16em] uppercase">
                        {PIECE_NAMES[v]}
                      </div>
                      <div className="text-xs text-mist leading-tight mt-0.5">{MARCH_TEXT[v]}</div>
                    </div>
                  </div>
                </Rev>
              ))}
            </div>
          </Chap>

          {/* 4 — CAPTURES */}
          <Chap id="captures" step="04" title="Capturing">
            <Rev>
              <p className="text-sm text-mist mb-4 max-w-xl">
                Move onto an enemy to capture it. You may capture an enemy whose number is{" "}
                <span className="text-fog font-bold">the same or lower</span> than yours. And remember —{" "}
                <span className="text-blood-2 font-bold">any piece can capture the Crown</span>, and the Crown can
                capture anything.
              </p>
            </Rev>
            <div className="space-y-2">
              <Rev><CaptureRow you={5} enemy={3} ok note="5 is bigger than 3 — capture it (+30 points)." /></Rev>
              <Rev delay={60}><CaptureRow you={7} enemy={7} ok note="Equal numbers capture each other (+70)." /></Rev>
              <Rev delay={120}><CaptureRow you={3} enemy={8} ok={false} note="3 is smaller than 8 — blocked. Move away or bring a bigger number." /></Rev>
              <Rev delay={180}>
                <CaptureRow you={1} enemy={9} ok note="REGICIDE! Even the humble 1 can take the Crown — and win the war (+50)." />
              </Rev>
            </div>
          </Chap>

          {/* 5 — THE RULE */}
          <Chap id="rule" step="05" title="The one rule — Law of Rows">
            <Rev>
              <p className="text-sm text-mist mb-4 max-w-xl">
                <span className="text-fog font-bold">Two pieces with the same number can never share a row or a
                column</span> — no matter which side they belong to. The Crown (9) is the only exception. This is why
                placing a number also <span className="text-flux font-bold">locks a line</span> against the enemy.
              </p>
            </Rev>
            <div className="grid sm:grid-cols-2 gap-4">
              <Rev>
                <div className="panel-flat p-4 flex flex-col items-center gap-3 h-full">
                  <MiniBoard
                    pieces={[
                      { r: 2, c: 1, side: 0, value: 4 },
                      { r: 2, c: 3, side: 1, value: 4 },
                    ]}
                    bad={[{ r: 2, c: 1 }, { r: 2, c: 3 }]}
                    caption={
                      <>
                        <span className="text-blood-2 font-bold">WRONG.</span> Two 4s share a row — gold or red, it's
                        forbidden.
                      </>
                    }
                  />
                </div>
              </Rev>
              <Rev delay={90}>
                <div className="panel-flat p-4 flex flex-col items-center gap-3 h-full">
                  <MiniBoard
                    pieces={[{ r: 1, c: 0, side: 0, value: 4 }]}
                    marks={[{ r: 2, c: 4, kind: "ok" }]}
                    caption={
                      <>
                        <span className="text-[#7dffd4] font-bold">RIGHT.</span> The second 4 lands in a different row{" "}
                        <em>and</em> a different column.
                      </>
                    }
                  />
                </div>
              </Rev>
            </div>
          </Chap>

          {/* 6 — CROWN & CLOCK */}
          <Chap id="crown" step="06" title="The Crown & the clock">
            <div className="grid sm:grid-cols-2 gap-3">
              <Rev>
                <div className="panel-flat panel-hover p-4 h-full">
                  <div className="flex items-center gap-2.5 mb-2">
                    <CrownIcon className="w-7 h-7 text-gold-2" />
                    <span className="font-display font-black text-fog text-lg">MUSTER THE CROWN</span>
                  </div>
                  <p className="text-sm text-mist leading-relaxed">
                    Your Crown (9) must enter the board <span className="text-fog font-bold">by your 5th turn</span>,
                    and only inside <span className="text-gold-2 font-bold">your bottom two rows</span> (the
                    gold-tinted rows). When the moment comes, a pulsing{" "}
                    <span className="text-blood-2 font-bold">CROWN NOW</span> badge appears — other moves are locked
                    until the Crown lands. Guard it: any enemy can take it.
                  </p>
                </div>
              </Rev>
              <Rev delay={90}>
                <div className="panel-flat panel-hover p-4 h-full">
                  <div className="flex items-center gap-2.5 mb-2">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 text-flux" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3.5 2" />
                    </svg>
                    <span className="font-display font-black text-fog text-lg">THE 60-MOVE CLOCK</span>
                  </div>
                  <p className="text-sm text-mist leading-relaxed">
                    The <span className="text-fog font-bold">DECREE</span> counter in the top bar counts down from 60
                    total moves. When it hits zero, whoever has more points wins — so capturing matters even if you
                    can't find the Crown. Don't hoard your tray: unplayed numbers count too, but captured ones count
                    for nothing.
                  </p>
                </div>
              </Rev>
            </div>
          </Chap>

          {/* 7 — BUTTONS */}
          <Chap id="buttons" step="07" title="Buttons & keys">
            <div className="grid sm:grid-cols-2 gap-2.5 text-xs text-mist">
              <Rev>
                <div className="panel-flat p-3.5 space-y-2.5 h-full">
                  <div className="flex items-center gap-2.5">
                    <span className="icon-btn shrink-0"><BookIcon /></span>
                    <span><span className="text-fog font-semibold">Book</span> — opens this manual anytime.</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="icon-btn shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                        <path d="M8 5 3 10l5 5" />
                        <path d="M3 10h11a6 6 0 0 1 0 12h-3" transform="translate(0,-3) scale(1,0.9)" />
                      </svg>
                    </span>
                    <span><span className="text-fog font-semibold">Undo (U)</span> — take your move back while the enemy is still thinking.</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-11 h-11 shrink-0 rounded-full grid place-items-center font-display font-black text-xl text-[#241500] border border-[#ffe9ad]" style={{ background: "linear-gradient(180deg,#ffe08a,#ffc93c 45%,#d99a12)" }}>
                      ?
                    </span>
                    <span><span className="text-fog font-semibold">The golden “?”</span> — same manual, always one tap away during battle.</span>
                  </div>
                </div>
              </Rev>
              <Rev delay={90}>
                <div className="panel-flat p-3.5 space-y-2.5 h-full">
                  <div className="flex items-center gap-2.5">
                    <span className="icon-btn shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
                        <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                      </svg>
                    </span>
                    <span><span className="text-fog font-semibold">Pause (Esc or P)</span> — freezes the battle and the clock.</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="icon-btn shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
                        <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
                      </svg>
                    </span>
                    <span><span className="text-fog font-semibold">Sound (M)</span> — mutes the war drums.</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-11 h-11 shrink-0 grid place-items-center border border-[#1a4a54] text-flux">
                      <BladeIcon />
                    </span>
                    <span><span className="text-fog font-semibold">Tip</span> — tap empty ground to cancel a selection. Red squares in the trays mean “already deployed”.</span>
                  </div>
                </div>
              </Rev>
            </div>
            <Rev delay={140}>
              <button className="btn-gold btn-shine w-full mt-5 px-6 py-3.5 text-base sm:text-lg font-black tracking-[0.2em]" onClick={onClose}>
                {firstWar ? "GOT IT — TO BATTLE" : "BACK TO THE FIELD"}
              </button>
            </Rev>
          </Chap>
        </div>
      </div>
    </div>
  );
}
