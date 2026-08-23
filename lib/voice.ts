export type Persona = "coach" | "tecnico";

type PhraseTable = {
  lavoro: (eser?: string) => string;
  riposo: () => string;
  ultimi: () => string;
  ultimoRound: () => string;
  meta: () => string;
  serie: (eser: string, rip: number) => string;
  recupero: () => string;
  riposoConProssimo: (prossimo: string) => string;
  fine: () => string;
  sveglia: () => string;
};

const FRASI: Record<Persona, PhraseTable> = {
  coach: {
    lavoro: (e) => (e ? `${e}! Vai!` : "Vai!"),
    riposo: () => "Respira",
    ultimi: () => "Ultimi dieci!",
    ultimoRound: () => "Ultimo round, dai tutto!",
    meta: () => "Metà sessione, tieni duro!",
    serie: (e, r) => `${e}, ${r} ripetizioni. Tocca quando hai finito.`,
    recupero: () => "Recupero",
    riposoConProssimo: (p) => `Respira. Poi ${p}.`,
    fine: () => "Finita! Grande.",
    sveglia: () => "Ci sei ancora? Tocca lo schermo quando hai finito.",
  },
  tecnico: {
    lavoro: (e) => e || "Lavoro",
    riposo: () => "Riposo",
    ultimi: () => "Dieci secondi",
    ultimoRound: () => "Ultimo round",
    meta: () => "Metà",
    serie: (e, r) => `${e}, ${r} ripetizioni. Tocca a fine serie.`,
    recupero: () => "Recupero",
    riposoConProssimo: (p) => `Riposo. Poi ${p}.`,
    fine: () => "Sessione conclusa.",
    sveglia: () => "In attesa. Tocca lo schermo.",
  },
};

/** A sample line shown on the Pre-flight voice-picker cards (f13). */
export function samplePhrase(persona: Persona): string {
  return persona === "coach" ? "Ultimi dieci! Non molli adesso, tieni!" : "Dieci secondi. Poi riposo.";
}

let volumeGain = 1;

/** 0..1, applied to every utterance from here on — set from the user's Pre-flight volume test. */
export function setVolumeGain(v: number) {
  volumeGain = Math.max(0, Math.min(1, v));
}

function speakRaw(testo: string, persona: Persona) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(testo);
    u.lang = "it-IT";
    u.rate = persona === "coach" ? 1.12 : 1.0;
    u.pitch = persona === "coach" ? 1.1 : 1.0;
    u.volume = volumeGain;
    window.speechSynthesis.speak(u);
  } catch {
    // speech synthesis unavailable — the session continues silently
  }
}

export function speak(persona: Persona, key: keyof PhraseTable, ...args: [string?, number?]) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const table = FRASI[persona];
  const fn = table[key] as (...a: unknown[]) => string;
  speakRaw(fn(...args), persona);
}

/** Speaks the persona's sample phrase — used by the Pre-flight volume test button. */
export function speakSample(persona: Persona) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  speakRaw(samplePhrase(persona), persona);
}

/** Must run inside a real user-gesture handler (iOS opens the TTS channel only there). */
export function unlockSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}
