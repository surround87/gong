"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearApiKey,
  getApiKey,
  getProvider,
  indovinaProvider,
  looksLikeApiKey,
  maskApiKey,
  PROVIDERS,
  setApiKey,
  type Provider,
} from "@/lib/apiKey";
import styles from "./ApiKeyScreen.module.css";

export default function ApiKeyScreen() {
  const router = useRouter();
  const [salvata, setSalvata] = useState<string | null>(null);
  const [providerSalvato, setProviderSalvato] = useState<Provider>("anthropic");
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [valore, setValore] = useState("");
  const [toccato, setToccato] = useState(false);

  useEffect(() => {
    setSalvata(getApiKey());
    const p = getProvider();
    setProviderSalvato(p);
    setProvider(p);
  }, []);

  const info = PROVIDERS[provider];
  const formaValida = looksLikeApiKey(valore, provider);
  const mostraAvviso = toccato && valore.trim().length > 0 && !formaValida;

  const scriviValore = (v: string) => {
    setValore(v);
    setToccato(true);
    // If they paste before picking, the prefix tells us which one it is.
    const indovinato = indovinaProvider(v);
    if (indovinato) setProvider(indovinato);
  };

  const salva = () => {
    setApiKey(valore, provider);
    setSalvata(valore.trim());
    setProviderSalvato(provider);
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
              GONG legge le tue schede con {PROVIDERS[providerSalvato].nome}. La chiave resta su
              questo dispositivo.
            </div>
            <div className={styles.saved}>
              <span className={styles.savedKey}>{maskApiKey(salvata)}</span>
              <button className={styles.link} onClick={rimuovi}>
                Rimuovi
              </button>
            </div>
            <div className={styles.hint}>{PROVIDERS[providerSalvato].nota}</div>
          </>
        ) : (
          <>
            <div className={styles.title}>
              Serve una chiave
              <br />
              per leggere.
            </div>
            <div className={styles.lead}>
              GONG legge la scheda con un modello. La chiave è tua e paghi solo quello che leggi —
              qualche centesimo a scheda.
            </div>

            <div className={styles.providers}>
              {(Object.values(PROVIDERS) as (typeof PROVIDERS)[Provider][]).map((p) => (
                <button
                  key={p.id}
                  className={`${styles.providerCard} ${provider === p.id ? styles.selected : ""}`}
                  onClick={() => setProvider(p.id)}
                >
                  <div className={styles.providerName}>{p.nome}</div>
                  <div className={styles.providerNote}>{p.nota}</div>
                </button>
              ))}
            </div>

            <input
              className={`${styles.field} ${mostraAvviso ? styles.fieldInvalid : ""}`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={valore}
              onChange={(e) => scriviValore(e.target.value)}
              placeholder={`${info.prefisso}…`}
              aria-label={`Chiave API ${info.nome}`}
            />

            {mostraAvviso ? (
              <div className={styles.warning}>
                Non sembra una chiave {info.nome}: cominciano tutte con «{info.prefisso}».
              </div>
            ) : (
              <div className={styles.hint}>La trovi su {info.dove}.</div>
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
