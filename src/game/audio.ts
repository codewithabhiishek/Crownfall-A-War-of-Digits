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

function noise(dur: number, vol: number, filterFreq = 1800, delay = 0) {
  const c = ensure();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const bufferSize = Math.max(256, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noiseSource = c.createBufferSource();
  noiseSource.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(filterFreq, t0);
  filter.Q.setValueAtTime(1.5, t0);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  noiseSource.connect(filter).connect(g).connect(master);
  noiseSource.start(t0);
  noiseSource.stop(t0 + dur + 0.02);
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
    // organic slight frequency variation so repeated clicks don't drone identically
    const p = 630 + (Math.random() * 50 - 25);
    tone(p, 0.05, "triangle", 0.42);
  },
  hover() {
    tone(520, 0.025, "sine", 0.1);
  },
  buttonClick() {
    tone(490, 0.05, "triangle", 0.4, 380);
  },
  tabSwitch() {
    noise(0.04, 0.14, 2000);
    tone(640, 0.045, "sine", 0.22, 500);
  },
  manualOpen() {
    // crisp parchment rustle + leather tome opening tick
    noise(0.08, 0.22, 2400);
    tone(820, 0.06, "sine", 0.2, 600);
    tone(410, 0.07, "triangle", 0.16, 290, 0.02);
  },
  manualClose() {
    // soft wooden/leather book-closing thud
    noise(0.06, 0.18, 1400);
    tone(260, 0.09, "triangle", 0.38, 130);
  },
  foeSelect(diff: string) {
    if (diff === "squire") {
      // light wooden tap + soft chime
      noise(0.03, 0.12, 1400);
      tone(440, 0.06, "sine", 0.28, 550);
    } else if (diff === "knight") {
      // crisp tactile piece placement
      noise(0.03, 0.15, 2000);
      tone(587, 0.06, "triangle", 0.3, 440);
    } else {
      // deep solid hardwood piece thud
      noise(0.04, 0.15, 900);
      tone(160, 0.12, "triangle", 0.4, 75);
    }
  },
  chipSelect(v: number) {
    if (v === 9) {
      // royal golden chime for the Crown (King)
      tone(880, 0.22, "sine", 0.55);
      tone(1320, 0.26, "sine", 0.4, undefined, 0.03);
      tone(1760, 0.18, "triangle", 0.3, undefined, 0.06);
    } else {
      // progressive harmonic pitch scale for units 1 through 8
      const f = 360 + v * 52;
      tone(f, 0.055, "triangle", 0.45, f + 28);
      tone(f * 1.5, 0.03, "sine", 0.16);
    }
  },
  battleStart() {
    // Satisfying tactile board game start: wooden chess piece placement on hardwood
    // 1. Initial crisp wooden contact
    noise(0.03, 0.15, 1200);
    tone(200, 0.06, "triangle", 0.32, 110);
    // 2. Light secondary settling tap
    noise(0.025, 0.1, 1600, 0.035);
    tone(380, 0.06, "sine", 0.2, 300, 0.035);
    // 3. Gentle warm wood resonance
    tone(523, 0.09, "sine", 0.15, 460, 0.07);
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
  assistCapture() {
    tone(587, 0.2, "triangle", 0.5, 740);
    tone(880, 0.22, "sine", 0.45, undefined, 0.03);
    tone(140, 0.22, "square", 0.6, 60, 0.02);
    noise(0.08, 0.28, 1600, 0.01);
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
