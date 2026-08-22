"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  setAllenamentoAttivo,
  type Allenamento,
  type RisultatoParsing,
} from "@/lib/parsedSession";
import { getSavedSessions, type CompletedSession } from "@/lib/sessionPrefs";
import { getApiKey } from "@/lib/apiKey";
import styles from "./InputScreen.module.css";

type Fase =
  | { nome: "input" }
  | { nome: "fileRicevuto"; file: FileScelto }
  | { nome: "lettura" }
  | { nome: "errore"; titolo: string; testoLetto: string | null; diagnosi: string | null };

interface FileScelto {
  nome: string;
  estensione: string;
  kb: number;
  mediaType: string;
  base64: string;
}

const MARCHIO = (
  <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
    <circle cx="13" cy="13" r="11" fill="none" stroke="#F5F5F0" strokeWidth="2.5" />
    <circle cx="13" cy="13" r="3.4" fill="#F5F5F0" />
  </svg>
);

function leggiFile(file: File): Promise<FileScelto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("lettura fallita"));
    reader.onload = () => {
      const result = String(reader.result);
      resolve({
        nome: file.name,
        estensione: (file.name.split(".").pop() ?? "file").toLowerCase(),
        kb: Math.max(1, Math.round(file.size / 1024)),
        mediaType: file.type || "application/octet-stream",
        base64: result.slice(result.indexOf(",") + 1),
      });
    };
    reader.readAsDataURL(file);
  });
}

const TESTUALI = ["txt", "csv", "md", "text"];

export default function InputScreen() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>({ nome: "input" });
  const [testo, setTesto] = useState("");
  const [scrivendo, setScrivendo] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [libreria, setLibreria] = useState<CompletedSession[]>([]);
  const [righeLette, setRigheLette] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    setLibreria(getSavedSessions().slice().reverse());
  }, []);

  const righe = testo.split("\n").filter((r) => r.trim()).slice(0, 40);

  // The parsing screen shows the card being taken apart line by line. The pace
  // is cosmetic — it just has to still be moving when the request returns.
  useEffect(() => {
    if (fase.nome !== "lettura") return;
    setRigheLette(0);
    const id = setInterval(() => {
      setRigheLette((n) => (righe.length ? Math.min(n + 1, righe.length - 1) : n + 1));
    }, 220);
    return () => clearInterval(id);
  }, [fase.nome, righe.length]);

  async function invia(payload: { testo?: string; immagine?: { mediaType: string; data: string }; nomeFile?: string }) {
    const chiave = getApiKey();
    if (!chiave) {
      router.push("/chiave");
      return;
    }

    setFase({ nome: "lettura" });
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-anthropic-key": chiave },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        // A key problem is a detour, not a dead end — send them to fix it.
        if (data?.chiaveMancante) {
          router.push("/chiave");
          return;
        }
        setFase({
          nome: "errore",
          titolo: "Non sono riuscito a leggerla.",
          testoLetto: null,
          diagnosi: data?.errore ?? "Riprova fra poco.",
        });
        return;
      }

      const risultato = data as RisultatoParsing;
      if (!risultato.eUnAllenamento || risultato.allenamenti.length === 0) {
        setFase({
          nome: "errore",
          titolo: "Qui dentro non c'è un allenamento.",
          testoLetto: risultato.testoLetto,
          diagnosi: risultato.diagnosi,
        });
        return;
      }

      if (risultato.allenamenti.length === 1) {
        setAllenamentoAttivo(risultato.allenamenti[0]);
        router.push("/conferma");
        return;
      }

      window.sessionStorage.setItem("gong:scelte", JSON.stringify(risultato.allenamenti));
      router.push("/scelta");
    } catch {
      setFase({
        nome: "errore",
        titolo: "Non sono riuscito a leggerla.",
        testoLetto: null,
        diagnosi: "La connessione è caduta durante la lettura.",
      });
    }
  }

  async function gestisciFile(file: File) {
    const scelto = await leggiFile(file);
    if (TESTUALI.includes(scelto.estensione)) {
      const contenuto = atob(scelto.base64);
      setFase({ nome: "input" });
      setTesto(contenuto);
      setScrivendo(true);
      return;
    }
    setFase({ nome: "fileRicevuto", file: scelto });
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void gestisciFile(file);
  };

  const dragProps = {
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current += 1;
      setDragOver(true);
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current -= 1;
      if (dragDepth.current <= 0) setDragOver(false);
    },
    onDrop,
  };

  /* ---------- f6 · parsing ---------- */
  if (fase.nome === "lettura") {
    const totale = righe.length || 1;
    const pct = Math.min(96, Math.round(((righeLette + 1) / totale) * 100));
    return (
      <div className={styles.screen}>
        <div className={styles.parseHeader}>
          <span className={styles.parseLabel}>Sto leggendo</span>
          <span className={styles.mono}>
            {righe.length ? `riga ${Math.min(righeLette + 1, totale)}/${totale}` : "…"}
          </span>
        </div>
        <div className={styles.rule} />
        <div className={styles.parseLines}>
          {righe.slice(Math.max(0, righeLette - 2), righeLette + 3).map((riga, i) => {
            const indice = Math.max(0, righeLette - 2) + i;
            const cls =
              indice < righeLette
                ? styles.lineDone
                : indice === righeLette
                  ? styles.lineCurrent
                  : styles.linePending;
            return (
              <div key={indice} className={cls}>
                {riga}
              </div>
            );
          })}
          {!righe.length && <div className={styles.lineCurrent}>Sto guardando l&rsquo;immagine…</div>}
        </div>
        <div className={styles.spacer} />
        <div className={styles.parseNote}>
          Le righe barrate sono già capite.
          <br />
          Nessuna scheda lascia questo telefono senza il tuo via.
        </div>
        <div className={styles.meter}>
          <div className={styles.meterFill} style={{ width: `${pct}%` }} />
          <div className={styles.meterTicks} />
        </div>
      </div>
    );
  }

  /* ---------- f5 · error ---------- */
  if (fase.nome === "errore") {
    return (
      <div className={styles.screen}>
        <div className={styles.kicker}>Lettura fallita</div>
        <div className={styles.rule} />
        <div className={styles.centerBody}>
          <div className={styles.errorTitle}>{fase.titolo}</div>
          {fase.testoLetto && (
            <>
              <div className={styles.errorLead}>
                Non ho trovato tempi, ripetizioni o nomi di esercizi. Questo è quello che ho letto:
              </div>
              <div className={styles.errorQuote}>{fase.testoLetto}</div>
            </>
          )}
          {fase.diagnosi && <div className={styles.errorDiagnosis}>{fase.diagnosi}</div>}
        </div>
        <button
          className={styles.outline}
          onClick={() => {
            setFase({ nome: "input" });
            setScrivendo(true);
          }}
        >
          Incolla qualcos&rsquo;altro
        </button>
        <button className={styles.ghost} onClick={() => fileInputRef.current?.click()}>
          Scegli un altro file
        </button>
        <input
          ref={fileInputRef}
          className={styles.hiddenInput}
          type="file"
          accept=".xlsx,.csv,.pdf,.jpg,.jpeg,.png,.txt,.md,image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void gestisciFile(f);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  /* ---------- f4 · file received ---------- */
  if (fase.nome === "fileRicevuto") {
    const { file } = fase;
    return (
      <div className={styles.screen}>
        <div className={styles.kicker}>Ricevuto</div>
        <div className={styles.rule} />
        <div className={styles.centerBody}>
          <div className={styles.mono}>{file.estensione}</div>
          <div className={styles.fileName}>{file.nome}</div>
          <div className={styles.fileMeta}>{file.kb} KB</div>
          <div className={styles.thinRule} />
          <div className={styles.privacy}>
            Non l&rsquo;ho ancora letto. La scheda viene mandata solo al lettore di GONG, e non
            viene conservata.
          </div>
        </div>
        <button
          className={`${styles.action} ${styles.primary}`}
          onClick={() =>
            void invia({
              immagine: { mediaType: file.mediaType, data: file.base64 },
              nomeFile: file.nome,
            })
          }
        >
          Leggi la scheda
        </button>
        <button className={styles.ghost} onClick={() => setFase({ nome: "input" })}>
          Cambia file
        </button>
      </div>
    );
  }

  /* ---------- f1 / f2 / f3 · input + library ---------- */
  const haLibreria = libreria.length > 0;

  return (
    <div className={styles.screen} {...dragProps}>
      {dragOver && (
        <div className={styles.dragOverlay}>
          <div className={styles.dragTitle}>
            Rilascia
            <br />
            qui.
          </div>
          <div className={styles.dragSub}>xlsx · csv · pdf · jpg · png · testo</div>
        </div>
      )}

      <div className={dragOver ? styles.dimmed : undefined} style={{ display: "contents" }}>
        <div className={styles.brand}>
          {MARCHIO}
          <span className={styles.brandName}>GONG</span>
          <button className={styles.chiaveLink} onClick={() => router.push("/chiave")}>
            Chiave
          </button>
        </div>

        {haLibreria && !scrivendo ? (
          <>
            <button className={styles.dropSmall} onClick={() => setScrivendo(true)}>
              <span>Incolla una scheda nuova</span>
              <span className={styles.plus}>+</span>
            </button>
            <div className={styles.footerDivider} />
            <div className={styles.libraryLabel}>
              Libreria · {libreria.length} {libreria.length === 1 ? "sessione" : "sessioni"}
            </div>
            <div className={styles.libraryList}>
              {libreria.map((s, i) => (
                <button key={`${s.completedAt}-${i}`} className={styles.libraryRow} disabled>
                  <div className={styles.libraryTitle}>{s.titolo}</div>
                  <div className={styles.libraryMeta}>
                    {s.blocchi} blocchi · {s.durataStimataMin[0]}-{s.durataStimataMin[1]} min ·{" "}
                    {new Date(s.completedAt).toLocaleDateString("it-IT")}
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.emptyBody}>
            {scrivendo ? (
              <textarea
                className={styles.pasteArea}
                autoFocus
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                placeholder={"A1 Panca piana 4x8 rec 90\"\nTABATA: swing/burpee 8 giri\nB1 Affondi camminati 3x20"}
              />
            ) : (
              <button className={styles.dropBig} onClick={() => setScrivendo(true)}>
                <div className={styles.dropTitle}>
                  Incolla
                  <br />
                  la scheda.
                </div>
                <div className={styles.dropSub}>
                  Il testo del PT su WhatsApp, un Excel,
                  <br />
                  la foto del foglio in borsa.
                </div>
              </button>
            )}

            {scrivendo && testo.trim() ? (
              <div className={styles.actionRow}>
                <button
                  className={`${styles.action} ${styles.primary}`}
                  onClick={() => void invia({ testo })}
                >
                  Leggi la scheda
                </button>
              </div>
            ) : (
              <div className={styles.actionRow}>
                <button className={styles.action} onClick={() => cameraInputRef.current?.click()}>
                  Scatta una foto
                </button>
                <button className={styles.action} onClick={() => fileInputRef.current?.click()}>
                  Scegli un file
                </button>
              </div>
            )}
          </div>
        )}

        {!haLibreria && (
          <>
            <div className={styles.footerDivider} />
            <div className={styles.footerNote}>Libreria vuota</div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        className={styles.hiddenInput}
        type="file"
        accept=".xlsx,.csv,.pdf,.jpg,.jpeg,.png,.txt,.md,image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void gestisciFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void gestisciFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
