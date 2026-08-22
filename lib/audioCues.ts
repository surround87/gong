let ctx: AudioContext | null = null;
let masterGain = 1;

/** 0..1, applied to every beep/gong from here on — set from the user's Pre-flight volume test. */
export function setMasterGain(v: number) {
  masterGain = Math.max(0, Math.min(1, v));
}

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

/** Must run inside a real user-gesture handler — iOS only opens the audio channel there. */
export function unlockAudio() {
  if (ctx) return;
  try {
    const w = window as WindowWithWebkitAudio;
    const Ctor = window.AudioContext || w.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    ctx.resume();
  } catch {
    // Web Audio unavailable — the session continues without cues
  }
}

/** Resume the context if iOS suspended it while the tab was backgrounded. */
export function resumeIfSuspended() {
  if (ctx && ctx.state === "suspended") ctx.resume();
}

/** Current position on the audio clock — schedule cues relative to this, never with setTimeout. */
export function now(): number {
  return ctx ? ctx.currentTime : 0;
}

/** Short countdown beep. `when` is an absolute time on the AudioContext timeline. */
export function beep(when: number, freq: number, dur: number, vol: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(vol * masterGain, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

/** The gong: inharmonic partials with a long decay. Also the sound logo. */
export function gong(when: number, base = 196) {
  if (!ctx) return;
  const partials: [number, number][] = [
    [1, 0.5],
    [2.76, 0.22],
    [5.4, 0.12],
    [8.9, 0.06],
  ];
  for (const [mult, vol] of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = base * mult;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol * masterGain, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 1.9);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 2);
  }
}
