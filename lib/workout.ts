export type StepType = "prep" | "lavoro" | "riposo" | "recupero" | "serie";

export interface WorkoutStep {
  t: StepType;
  /** Duration in seconds, for timed steps. Absent for tap-to-end (`attesa`) steps. */
  d?: number;
  blocco: string;
  round?: string;
  eser: string;
  /** Secondary qualifier line under the exercise name. */
  qual?: string;
  hint?: string;
  /** Last round of its block — shown with an inverted (filled) state badge. */
  ultimo?: boolean;
  /** Waiting for a tap to close the step (rep-based set), rather than counting down. */
  attesa?: boolean;
  /** Rep count, for `attesa` steps. */
  rip?: number;
}

export const ACCENTS: Record<StepType, string> = {
  lavoro: "#C8FF00",
  riposo: "#00C2FF",
  prep: "#FF9500",
  recupero: "#00C2FF",
  serie: "#FF3D6E",
};

export const BG = "#0A0A0B";
export const FG = "#F5F5F0";
export const DIM = "#6E6E76";

/** Rest/recovery steps render the digit outlined instead of filled. */
export function isContorno(step: WorkoutStep): boolean {
  return step.t === "riposo" || step.t === "recupero";
}

export function fmtCountdown(seconds: number): string {
  const c = Math.ceil(seconds);
  if (c >= 60) return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, "0")}`;
  return String(c);
}

/**
 * The demo session: preparation, a 4-round work/rest tabata, a long recovery,
 * two tap-to-end rep sets, and a two-round circuit with a long exercise name.
 * Ported 1:1 from the design prototype's `costruisci()`.
 */
export function buildDemoSession(): WorkoutStep[] {
  const steps: WorkoutStep[] = [];

  steps.push({
    t: "prep",
    d: 6,
    blocco: "Preparazione",
    eser: "Preparati",
    hint: "Tieni premuto per mettere in pausa",
  });

  const es = ["Kettlebell swing", "Burpee"];
  for (let r = 1; r <= 4; r++) {
    steps.push({
      t: "lavoro",
      d: 20,
      blocco: "Tabata A",
      round: `Round ${r}/4`,
      eser: es[(r - 1) % 2],
      ultimo: r === 4,
    });
    if (r < 4) {
      steps.push({
        t: "riposo",
        d: 10,
        blocco: "Tabata A",
        round: `Round ${r}/4`,
        eser: `→ ${es[r % 2]}`,
      });
    }
  }

  steps.push({
    t: "recupero",
    d: 75,
    blocco: "Transizione",
    eser: "→ Panca piana",
  });

  for (let i = 1; i <= 2; i++) {
    steps.push({
      t: "serie",
      attesa: true,
      rip: 8,
      blocco: "A1 Panca piana",
      round: `Serie ${i}/2`,
      eser: "Panca piana",
      hint: "Tocca lo schermo a fine serie",
    });
    if (i < 2) {
      steps.push({
        t: "recupero",
        d: 20,
        blocco: "A1 Panca piana",
        round: `Serie ${i}/2`,
        eser: "→ Panca piana",
      });
    }
  }

  for (let r = 1; r <= 2; r++) {
    steps.push({
      t: "lavoro",
      d: 30,
      blocco: "Circuito B",
      round: `Round ${r}/2`,
      eser: "Affondi camminati",
      qual: "con manubri sopra la testa",
      ultimo: r === 2,
    });
    if (r < 2) {
      steps.push({
        t: "riposo",
        d: 15,
        blocco: "Circuito B",
        round: `Round ${r}/2`,
        eser: "→ Affondi camminati",
      });
    }
  }

  return steps;
}

/** Label shown for the *next* step, used on the "Poi · …" line. */
export function nextStepLabel(next: WorkoutStep): string {
  const what =
    next.t === "serie"
      ? "Serie"
      : next.t === "riposo"
        ? "Riposo"
        : next.t === "recupero"
          ? "Recupero"
          : next.eser;
  return next.d ? `Poi · ${what} · ${next.d}s` : `Poi · ${what}`;
}
