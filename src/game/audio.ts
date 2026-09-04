// Tiny WebAudio synth — every game action gets a blip. No assets, all oscillators.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  slideTo?: number,
  delay = 0,
) {
  const c = ensure();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  setMuted(m: boolean) {
    muted = m;
  },
  isMuted: () => muted,
  unlock() {
    ensure();
  },
  select() {
    tone(660, 0.06, "triangle", 0.5);
  },
  hover() {
    tone(520, 0.03, "sine", 0.12);
  },
  place() {
    tone(190, 0.14, "triangle", 0.9, 90);
    tone(760, 0.05, "sine", 0.25, undefined, 0.01);
  },
  move() {
    tone(320, 0.08, "square", 0.28, 170);
  },
  capture() {
    tone(820, 0.16, "sawtooth", 0.5, 110);
    tone(140, 0.18, "square", 0.5, 60, 0.02);
  },
  crownHit() {
    tone(90, 0.5, "sawtooth", 0.8, 40);
    tone(1200, 0.3, "sawtooth", 0.4, 100, 0.05);
    tone(60, 0.7, "triangle", 0.9, 32, 0.12);
  },
  invalid() {
    tone(120, 0.1, "square", 0.4, 90);
    tone(110, 0.12, "square", 0.35, 80, 0.09);
  },
  turnEnemy() {
    tone(240, 0.1, "sine", 0.3, 200);
  },
  turnYou() {
    tone(440, 0.09, "sine", 0.35, 560);
  },
  warn() {
    tone(880, 0.07, "square", 0.3);
    tone(880, 0.07, "square", 0.3, undefined, 0.12);
  },
  win() {
    const seq = [523, 659, 784, 1046, 1318];
    seq.forEach((f, i) => tone(f, 0.22, "triangle", 0.5, undefined, i * 0.11));
    tone(262, 0.9, "sine", 0.3, undefined, 0.5);
  },
  lose() {
    tone(320, 0.8, "sawtooth", 0.4, 70);
    tone(240, 0.9, "triangle", 0.4, 55, 0.15);
  },
  draw() {
    tone(392, 0.3, "triangle", 0.4);
    tone(392, 0.3, "triangle", 0.4, undefined, 0.35);
  },
};
