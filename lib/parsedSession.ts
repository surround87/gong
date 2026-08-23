import { z } from "zod";
import type { WorkoutStep } from "./workout";

/**
 * The shape the parser returns. It has to do two jobs at once: be *displayable*
 * on the Confirm screen (schema strings, per-field provenance for anything the
 * parser inferred) and be *executable* by the player (enough numbers to flatten
 * into steps). Both are covered here so nothing has to be re-derived later.
 */

export const CampoDedottoSchema = z.object({
  /** Which field was inferred — e.g. "recuperoSec". */
  campo: z.string(),
  /** Human label for the correction sheet — e.g. "Recupero fra le serie". */
  etichetta: z.string(),
  /** The verbatim line from the user's own card the value came from. */
  daRiga: z.string(),
  /** Why the parser landed on this value, in the app's voice. */
  spiegazione: z.string(),
});

export const EsercizioSchema = z.object({
  nome: z.string(),
  /** Secondary line, e.g. "con manubri sopra la testa". */
  qualifica: z.string().nullable(),
});

export const BloccoSchema = z.object({
  /** Display name, e.g. "A · Forza". */
  nome: z.string(),
  /**
   * "tempo"  — timed rounds (tabata, EMOM, circuits)
   * "serie"  — rep-based sets closed by a tap
   * "non-supportato" — e.g. free-running chipper; GONG can't referee it
   */
  tipo: z.enum(["tempo", "serie", "non-supportato"]),
  esercizi: z.array(EsercizioSchema),
  /** Rounds (tempo) or sets (serie). */
  round: z.number().int().positive(),
  /** tempo only — seconds of work per round. */
  lavoroSec: z.number().int().nonnegative().nullable(),
  /** tempo only — seconds of rest between rounds. */
  riposoSec: z.number().int().nonnegative().nullable(),
  /** serie only — reps per set. */
  ripetizioni: z.number().int().positive().nullable(),
  /** serie only — seconds of recovery between sets. */
  recuperoSec: z.number().int().nonnegative().nullable(),
  /** Display string, e.g. "8 × 20/10" or "4×8". */
  schema: z.string(),
  /** Short detail line under the block name on the Confirm screen. */
  dettaglio: z.string(),
  dedotti: z.array(CampoDedottoSchema),
  /** non-supportato only — plain-English reason, shown in full. */
  motivoNonSupportato: z.string().nullable(),
});

export const AllenamentoSchema = z.object({
  titolo: z.string(),
  durataStimataMin: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  blocchi: z.array(BloccoSchema),
});

export const RisultatoParsingSchema = z.object({
  /**
   * false when the input plainly isn't a workout card — the error screen shows
   * `testoLetto` back so the user can recognise a mis-paste at a glance.
   */
  eUnAllenamento: z.boolean(),
  /** Populated when eUnAllenamento is false. */
  testoLetto: z.string().nullable(),
  diagnosi: z.string().nullable(),
  /** More than one means the "which one today?" screen. */
  allenamenti: z.array(AllenamentoSchema),
});

export type CampoDedotto = z.infer<typeof CampoDedottoSchema>;
export type Esercizio = z.infer<typeof EsercizioSchema>;
export type Blocco = z.infer<typeof BloccoSchema>;
export type Allenamento = z.infer<typeof AllenamentoSchema>;
export type RisultatoParsing = z.infer<typeof RisultatoParsingSchema>;

export function contaDedotti(a: Allenamento): number {
  return a.blocchi.reduce((n, b) => n + b.dedotti.length, 0);
}

const PREP_SEC = 10;

/**
 * Flattens a parsed workout into the flat step list the player runs.
 * Unsupported blocks are skipped — the Confirm screen has already told the
 * user which ones GONG won't guide.
 */
export function flattenAllenamento(a: Allenamento): WorkoutStep[] {
  const steps: WorkoutStep[] = [];

  steps.push({
    t: "prep",
    d: PREP_SEC,
    blocco: "Preparazione",
    eser: "Preparati",
    hint: "Tieni premuto per mettere in pausa",
    pseudo: true,
  });

  for (const blocco of a.blocchi) {
    if (blocco.tipo === "non-supportato") continue;
    const esercizi = blocco.esercizi.length ? blocco.esercizi : [{ nome: blocco.nome, qualifica: null }];

    for (let r = 1; r <= blocco.round; r++) {
      const es = esercizi[(r - 1) % esercizi.length];
      const round = blocco.round > 1 ? `Round ${r}/${blocco.round}` : undefined;
      const ultimo = r === blocco.round && blocco.round > 1;

      if (blocco.tipo === "serie") {
        steps.push({
          t: "serie",
          attesa: true,
          rip: blocco.ripetizioni ?? 0,
          blocco: blocco.nome,
          round: blocco.round > 1 ? `Serie ${r}/${blocco.round}` : undefined,
          eser: es.nome,
          qual: es.qualifica ?? undefined,
          hint: "Tocca lo schermo a fine serie",
        });
        if (r < blocco.round && blocco.recuperoSec) {
          steps.push({
            t: "recupero",
            d: blocco.recuperoSec,
            blocco: blocco.nome,
            round: `Serie ${r}/${blocco.round}`,
            eser: `→ ${es.nome}`,
          });
        }
        continue;
      }

      steps.push({
        t: "lavoro",
        d: blocco.lavoroSec ?? 30,
        blocco: blocco.nome,
        round,
        eser: es.nome,
        qual: es.qualifica ?? undefined,
        ultimo,
      });
      if (r < blocco.round && blocco.riposoSec) {
        const prossimo = esercizi[r % esercizi.length];
        steps.push({
          t: "riposo",
          d: blocco.riposoSec,
          blocco: blocco.nome,
          round,
          eser: `→ ${prossimo.nome}`,
        });
      }
    }
  }

  return steps;
}

/* ---------- handoff between Input → Confirm → Player ---------- */

const ACTIVE_KEY = "gong:allenamentoAttivo";

export function setAllenamentoAttivo(a: Allenamento) {
  window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(a));
}

export type EsitoAllenamento =
  | { stato: "ok"; allenamento: Allenamento }
  | { stato: "assente" }
  | { stato: "illeggibile"; motivo: string };

/**
 * Distinguishes "there is nothing here" from "there is something and I can't
 * read it" — the second used to send the user silently back to the input
 * screen, which looked exactly like the read having failed.
 */
export function leggiAllenamentoAttivo(): EsitoAllenamento {
  if (typeof window === "undefined") return { stato: "assente" };
  const raw = window.localStorage.getItem(ACTIVE_KEY);
  if (!raw) return { stato: "assente" };

  let grezzo: unknown;
  try {
    grezzo = JSON.parse(raw);
  } catch {
    return { stato: "illeggibile", motivo: "il risultato salvato non è leggibile" };
  }

  const esito = AllenamentoSchema.safeParse(grezzo);
  if (esito.success) return { stato: "ok", allenamento: esito.data };

  const primo = esito.error.issues[0];
  const dove = primo?.path.join(".") || "la sessione";
  return { stato: "illeggibile", motivo: `campo «${dove}»: ${primo?.message ?? "forma inattesa"}` };
}

export function getAllenamentoAttivo(): Allenamento | null {
  const esito = leggiAllenamentoAttivo();
  return esito.stato === "ok" ? esito.allenamento : null;
}
