"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setAllenamentoAttivo, type Allenamento } from "@/lib/parsedSession";
import styles from "./ConfirmScreen.module.css";

/**
 * f9 — the parser found more than one workout in the card. No confirm button:
 * the tap is the choice, and nothing is preselected, because on three days
 * there is no honest default.
 */
export default function ChoiceScreen() {
  const router = useRouter();
  const [allenamenti, setAllenamenti] = useState<Allenamento[] | null>(null);

  useEffect(() => {
    const raw = window.sessionStorage.getItem("gong:scelte");
    if (!raw) {
      router.replace("/input");
      return;
    }
    try {
      setAllenamenti(JSON.parse(raw) as Allenamento[]);
    } catch {
      router.replace("/input");
    }
  }, [router]);

  if (!allenamenti) return <div className={styles.screen} />;

  const scegli = (a: Allenamento) => {
    setAllenamentoAttivo(a);
    router.push("/conferma");
  };

  return (
    <div className={styles.screen}>
      <div className={styles.kicker}>Serve una scelta</div>
      <div className={styles.rule} />
      <div className={styles.sceltaTitle}>
        Ho trovato {allenamenti.length} allenamenti.
        <br />
        Quale facciamo?
      </div>

      <div className={styles.sceltaList}>
        {allenamenti.map((a, i) => (
          <button key={`${a.titolo}-${i}`} className={styles.sceltaRow} onClick={() => scegli(a)}>
            <div className={styles.sceltaNome}>{a.titolo}</div>
            <div className={styles.sceltaMeta}>
              {a.blocchi.length} blocchi · {a.durataStimataMin[0]}-{a.durataStimataMin[1]} min
            </div>
          </button>
        ))}
      </div>

      <div className={styles.spacer} />
      <div className={styles.sceltaNota}>
        Le altre restano in memoria.
        <br />
        Non devi ricaricare niente adesso.
      </div>
    </div>
  );
}
