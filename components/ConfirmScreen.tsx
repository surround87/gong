"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  contaDedotti,
  leggiAllenamentoAttivo,
  setAllenamentoAttivo,
  type Allenamento,
  type Blocco,
  type CampoDedotto,
} from "@/lib/parsedSession";
import styles from "./ConfirmScreen.module.css";

interface Correzione {
  bloccoIndex: number;
  dedotto: CampoDedotto;
  valore: number;
}

/** Numeric fields the correction sheet knows how to adjust. */
const CAMPI_NUMERICI: Record<string, { unita: string; passo: number }> = {
  recuperoSec: { unita: "sec", passo: 15 },
  riposoSec: { unita: "sec", passo: 5 },
  lavoroSec: { unita: "sec", passo: 5 },
  ripetizioni: { unita: "rip", passo: 1 },
  round: { unita: "round", passo: 1 },
};

function valoreCorrente(blocco: Blocco, campo: string): number | null {
  const v = (blocco as unknown as Record<string, unknown>)[campo];
  return typeof v === "number" ? v : null;
}

/**
 * `dettaglio` is a display string the parser wrote (e.g. `Squat · rec 180"`),
 * so correcting the underlying number would otherwise leave the line showing
 * the old one. Swap the standalone occurrence; if it isn't there, leave it be.
 */
function aggiornaDettaglio(dettaglio: string, da: number, a: number): string {
  if (da === a) return dettaglio;
  return dettaglio.replace(new RegExp(`\\b${da}\\b`), String(a));
}

export default function ConfirmScreen() {
  const router = useRouter();
  const [allenamento, setAllenamento] = useState<Allenamento | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [correzione, setCorrezione] = useState<Correzione | null>(null);

  useEffect(() => {
    const esito = leggiAllenamentoAttivo();
    if (esito.stato === "ok") {
      setAllenamento(esito.allenamento);
      return;
    }
    if (esito.stato === "assente") {
      router.replace("/input");
      return;
    }
    setProblema(esito.motivo);
  }, [router]);

  if (problema) {
    return (
      <div className={styles.screen}>
        <div className={styles.kicker}>Letta, ma non mostrabile</div>
        <div className={styles.rule} />
        <div className={styles.sceltaTitle}>
          Ho letto la scheda,
          <br />
          ma non riesco a mostrarla.
        </div>
        <div className={styles.sceltaNota}>{problema}</div>
        <div className={styles.spacer} />
        <button className={styles.avvia} onClick={() => router.push("/input")}>
          Riprova
        </button>
      </div>
    );
  }

  if (!allenamento) return <div className={styles.screen} />;

  const dedotti = contaDedotti(allenamento);

  const salvaTitolo = (titolo: string) => {
    const next = { ...allenamento, titolo };
    setAllenamento(next);
    setAllenamentoAttivo(next);
  };

  const apriCorrezione = (bloccoIndex: number, dedotto: CampoDedotto) => {
    const corrente = valoreCorrente(allenamento.blocchi[bloccoIndex], dedotto.campo);
    if (corrente === null || !CAMPI_NUMERICI[dedotto.campo]) return;
    setCorrezione({ bloccoIndex, dedotto, valore: corrente });
  };

  const confermaCorrezione = () => {
    if (!correzione) return;
    const blocchi = allenamento.blocchi.map((b, i) => {
      if (i !== correzione.bloccoIndex) return b;
      const precedente = valoreCorrente(b, correzione.dedotto.campo);
      return {
        ...b,
        [correzione.dedotto.campo]: correzione.valore,
        dettaglio:
          precedente === null
            ? b.dettaglio
            : aggiornaDettaglio(b.dettaglio, precedente, correzione.valore),
        // Corrected by hand — it's no longer an inference, so the dashes go.
        dedotti: b.dedotti.filter((d) => d.campo !== correzione.dedotto.campo),
      } as Blocco;
    });
    const next = { ...allenamento, blocchi };
    setAllenamento(next);
    setAllenamentoAttivo(next);
    setCorrezione(null);
  };

  const avvia = () => {
    setAllenamentoAttivo(allenamento);
    router.push("/preflight");
  };

  const unita = correzione ? (CAMPI_NUMERICI[correzione.dedotto.campo]?.unita ?? "") : "";
  const passo = correzione ? (CAMPI_NUMERICI[correzione.dedotto.campo]?.passo ?? 1) : 1;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <span className={styles.kicker}>Letta tutta</span>
        {dedotti > 0 && (
          <span className={styles.dedottiCount}>
            {dedotti} {dedotti === 1 ? "dedotto" : "dedotti"}
          </span>
        )}
      </div>

      <input
        className={styles.titolo}
        value={allenamento.titolo}
        onChange={(e) => salvaTitolo(e.target.value)}
        aria-label="Titolo della sessione"
      />

      <div className={styles.durataRow}>
        <span className={styles.durata}>
          {allenamento.durataStimataMin[0]}-{allenamento.durataStimataMin[1]}
        </span>
        <span className={styles.durataLabel}>min stimati</span>
      </div>

      <div className={styles.rule} />

      <div className={styles.list}>
        {allenamento.blocchi.map((blocco, i) => (
          <div key={`${blocco.nome}-${i}`} className={styles.blocco}>
            <div className={styles.bloccoHead}>
              <span className={styles.bloccoNome}>{blocco.nome}</span>
              <span className={styles.bloccoSchema}>{blocco.schema}</span>
            </div>
            <div className={styles.bloccoDettaglio}>{blocco.dettaglio}</div>

            {blocco.tipo === "non-supportato" && blocco.motivoNonSupportato && (
              <div className={styles.nonSupportato}>
                {blocco.motivoNonSupportato} — questo blocco non lo guido, gli altri sì.
              </div>
            )}

            {blocco.dedotti.map((d) => (
              <div key={d.campo}>
                <button className={styles.dedottoTag} onClick={() => apriCorrezione(i, d)}>
                  {d.etichetta}
                  {valoreCorrente(blocco, d.campo) !== null && `: ${valoreCorrente(blocco, d.campo)}`}
                </button>
                <div className={styles.provenienza}>da «{d.daRiga}»</div>
              </div>
            ))}
          </div>
        ))}

        <div className={styles.hint}>
          {dedotti > 0
            ? "Il tratteggio vuol dire che l'ho ricavato io. Toccalo per vedere da dove."
            : "Tutto letto dalla scheda, niente dedotto."}
        </div>
      </div>

      <button className={styles.avvia} onClick={avvia}>
        Avvia
      </button>

      {correzione && (
        <>
          <div className={styles.sheetBackdrop} onClick={() => setCorrezione(null)} />
          <div className={styles.sheet}>
            <div className={styles.sheetKicker}>
              Dedotto · {allenamento.blocchi[correzione.bloccoIndex].nome}
            </div>
            <div className={styles.sheetTitle}>{correzione.dedotto.etichetta}</div>
            <div className={styles.sheetQuote}>
              nella tua scheda:
              <br />«{correzione.dedotto.daRiga}»
            </div>
            <div className={styles.sheetWhy}>{correzione.dedotto.spiegazione}</div>
            <div className={styles.stepper}>
              <button
                className={styles.stepBtn}
                onClick={() =>
                  setCorrezione({ ...correzione, valore: Math.max(0, correzione.valore - passo) })
                }
                aria-label="Diminuisci"
              >
                −
              </button>
              <div className={styles.stepValue}>
                <span className={styles.stepNumber}>{correzione.valore}</span>
                <span className={styles.stepUnit}>{unita}</span>
              </div>
              <button
                className={styles.stepBtn}
                onClick={() => setCorrezione({ ...correzione, valore: correzione.valore + passo })}
                aria-label="Aumenta"
              >
                +
              </button>
            </div>
            <button className={styles.sheetConfirm} onClick={confermaCorrezione}>
              Confermo {correzione.valore}
              {unita === "sec" ? '"' : ` ${unita}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
