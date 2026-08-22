"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearApiKey, getApiKey, looksLikeApiKey, maskApiKey, setApiKey } from "@/lib/apiKey";
import styles from "./ApiKeyScreen.module.css";

export default function ApiKeyScreen() {
  const router = useRouter();
  const [salvata, setSalvata] = useState<string | null>(null);
  const [valore, setValore] = useState("");
  const [toccato, setToccato] = useState(false);

  useEffect(() => {
    setSalvata(getApiKey());
  }, []);

  const formaValida = looksLikeApiKey(valore);
  const mostraAvviso = toccato && valore.trim().length > 0 && !formaValida;

  const salva = () => {
    setApiKey(valore);
    setSalvata(valore.trim());
    setValore("");
    setToccato(false);
    router.push("/input");
  };

  const rimuovi = () => {
    clearApiKey();
    setSalvata(null);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.kicker}>La tua chiave</div>
      <div className={styles.rule} />

      <div className={styles.body}>
        {salvata ? (
          <>
            <div className={styles.title}>La chiave c&rsquo;è.</div>
            <div className={styles.lead}>
              GONG la usa per leggere le tue schede. Resta su questo dispositivo.
            </div>
            <div className={styles.saved}>
              <span className={styles.savedKey}>{maskApiKey(salvata)}</span>
              <button className={styles.link} onClick={rimuovi}>
                Rimuovi
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.title}>
              Serve una chiave
              <br />
              per leggere.
            </div>
            <div className={styles.lead}>
              GONG legge la scheda con Claude. La chiave è tua e paghi solo quello che leggi —
              qualche centesimo a scheda.
            </div>

            <input
              className={`${styles.field} ${mostraAvviso ? styles.fieldInvalid : ""}`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={valore}
              onChange={(e) => {
                setValore(e.target.value);
                setToccato(true);
              }}
              placeholder="sk-ant-…"
              aria-label="Chiave API Anthropic"
            />

            {mostraAvviso ? (
              <div className={styles.warning}>
                Non sembra una chiave Anthropic: cominciano tutte con «sk-ant-».
              </div>
            ) : (
              <div className={styles.hint}>
                La trovi su console.anthropic.com, sotto API keys.
              </div>
            )}
          </>
        )}

        <div className={styles.privacy}>
          La chiave resta nella memoria di questo browser. Viene mandata al lettore di GONG solo
          nel momento in cui leggi una scheda, e non viene né salvata né registrata sul server.
        </div>
      </div>

      {salvata ? (
        <button className={styles.primary} onClick={() => router.push("/input")}>
          Continua
        </button>
      ) : (
        <button className={styles.primary} disabled={!formaValida} onClick={salva}>
          Salva la chiave
        </button>
      )}
      <button className={styles.ghost} onClick={() => router.push("/")}>
        Torna indietro
      </button>
    </div>
  );
}
