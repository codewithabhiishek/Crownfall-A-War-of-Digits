// Shared inline SVG glyphs — no assets, all paths.

export function CrownIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M3 19h18v2H3zM2.5 7.5 6 10.8 12 4l6 6.8 3.5-3.3L19.6 17H4.4L2.5 7.5z" />
    </svg>
  );
}

export function BookIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 4h9a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 3V4z" transform="translate(2,-2) scale(0.92)" />
      <path d="M8 8h6M8 12h6" />
    </svg>
  );
}

export function MarchGlyph({ v, className = "w-4 h-4" }: { v: number; className?: string }) {
  const paths: Record<number, string> = {
    1: "M8 2v3M8 11v3M2 8h3M11 8h3",
    2: "M8 2v4M8 10v4M2 8h4M10 8h4",
    3: "M5 13V7a2 2 0 0 1 2-2h4M9 3l2 2-2 2",
    4: "M4 4l3 3M9 9l3 3M12 4l-3 3M7 9l-3 3",
    5: "M8 1v14M1 8h14",
    6: "M2 2l12 12M14 2L2 14",
    7: "M8 3v10M3 8h10M4.5 4.5l7 7M11.5 4.5l-7 7",
    8: "M8 1v14M1 8h14M2.5 2.5l11 11M13.5 2.5l-11 11",
    9: "M3 12.5 2 6.5l4 3 2-5 2 5 4-3-1 6zM3 12.5h10",
  };
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      {v === 1 && <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />}
      <path d={paths[v]} />
    </svg>
  );
}

export function BladeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M19 5 8 16M19 5l-3.2-.8M19 5l.8 3.2M8 16l-2.5 2.5M5.5 18.5 4 20M5.5 18.5 7 20M5.5 18.5 4 17" />
    </svg>
  );
}

export function CloseIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
