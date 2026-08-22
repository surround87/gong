"use client";

import { useRouter } from "next/navigation";
import { unlockAudio } from "@/lib/audioCues";
import { unlockSpeech } from "@/lib/voice";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();

  const handleStart = () => {
    // Must run inside this click handler — it's the only trusted user
    // gesture we get, and iOS only opens the audio/speech channels there.
    unlockAudio();
    unlockSpeech();
    router.push("/input");
  };

  return (
    <div className={styles.home}>
      <div className={styles.mark}>GONG</div>

      <div className={styles.middle}>
        <h1 className={styles.title}>
          Pronti,
          <br />
          via.
        </h1>
        <p className={styles.subtitle}>
          Incolla la scheda che ti ha dato il PT, fotografala o caricala.
          GONG la legge e te la fa da timer, con la voce.
        </p>
      </div>

      <button className={styles.cta} onClick={handleStart}>
        Carica una scheda
      </button>
    </div>
  );
}
