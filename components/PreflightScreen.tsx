"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPersona,
  getVolumeLevel,
  setPersona as persistPersona,
  setVolumeLevel as persistVolumeLevel,
  VOLUME_LEVELS,
} from "@/lib/sessionPrefs";
import { samplePhrase, setVolumeGain, speakSample, type Persona } from "@/lib/voice";
import { setMasterGain, unlockAudio } from "@/lib/audioCues";
import { buildDemoSession, DEMO_SESSION_TITLE } from "@/lib/workout";
import { flattenAllenamento, getAllenamentoAttivo } from "@/lib/parsedSession";
import styles from "./PreflightScreen.module.css";

const COUNTDOWN_S = 3;
const RING_R = 138;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function applyVolumeLevel(level: number) {
  const gain = level / VOLUME_LEVELS;
  setVolumeGain(gain);
  setMasterGain(gain);
}

export default function PreflightScreen() {
  const router = useRouter();
  const attivo = useMemo(() => getAllenamentoAttivo(), []);
  const steps = useMemo(
    () => (attivo ? flattenAllenamento(attivo) : buildDemoSession()),
    [attivo],
  );
  const titolo = attivo?.titolo ?? DEMO_SESSION_TITLE;
  const firstExercise = steps[1] ?? steps[0];

  const [persona, setPersonaState] = useState<Persona | null>(null);
  const [picking, setPicking] = useState(false);
  const [pendingPersona, setPendingPersona] = useState<Persona>("coach");
  const [volumeLevel, setVolumeLevelState] = useState(4);
  const [countLeft, setCountLeft] = useState(COUNTDOWN_S);

  const anchorRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  // `useRouter()` hands back a fresh object on some renders; keeping it in a
  // ref keeps it out of the countdown effect's deps, which would otherwise
  // tear down and restart the countdown — resetting its anchor — every render.
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const level = getVolumeLevel();
    setVolumeLevelState(level);
    applyVolumeLevel(level);

    const existing = getPersona();
    if (existing) setPersonaState(existing);
    else setPicking(true);
  }, []);

  useEffect(() => {
    if (picking || !persona) return;
    anchorRef.current = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - anchorRef.current) / 1000;
      const left = Math.max(0, COUNTDOWN_S - elapsed);
      setCountLeft(left);
      if (left <= 0) {
        routerRef.current.push("/player");
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [picking, persona]);

  const chooseVolume = (level: number) => {
    setVolumeLevelState(level);
    persistVolumeLevel(level);
    applyVolumeLevel(level);
  };

  const tryVoice = () => {
    unlockAudio();
    speakSample(pendingPersona);
  };

  const confirmPersona = () => {
    unlockAudio();
    persistPersona(pendingPersona);
    setPersonaState(pendingPersona);
    setPicking(false);
  };

  const togglePersona = () => {
    if (!persona) return;
    const next: Persona = persona === "coach" ? "tecnico" : "coach";
    persistPersona(next);
    setPersonaState(next);
  };

  if (picking) {
    return (
      <div className={styles.screen}>
        <div className={styles.kicker}>Solo questa volta</div>
        <div className={styles.title}>
          Chi ti parla
          <br />
          nell&rsquo;orecchio?
        </div>

        <div className={styles.cards}>
          <button
            className={`${styles.card} ${pendingPersona === "coach" ? styles.selected : ""}`}
            onClick={() => setPendingPersona("coach")}
          >
            <div className={styles.cardLabel}>Coach</div>
            <div className={styles.cardPhrase}>&laquo;{samplePhrase("coach")}&raquo;</div>
            <div className={styles.cardDesc}>Ti spinge. Parla anche quando non serve.</div>
          </button>
          <button
            className={`${styles.card} ${pendingPersona === "tecnico" ? styles.selected : ""}`}
            onClick={() => setPendingPersona("tecnico")}
          >
            <div className={styles.cardLabel}>Tecnico</div>
            <div className={styles.cardPhrase}>&laquo;{samplePhrase("tecnico")}&raquo;</div>
            <div className={styles.cardDesc}>Dice i numeri. Tace il resto del tempo.</div>
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.volumeRow}>
          <span className={styles.volumeLabel}>Volume</span>
          <button className={styles.tryButton} onClick={tryVoice}>
            Prova
          </button>
        </div>
        <div className={styles.ticks}>
          {Array.from({ length: VOLUME_LEVELS }, (_, i) => i + 1).map((level) => (
            <button
              key={level}
              className={`${styles.tick} ${level <= volumeLevel ? styles.filled : ""}`}
              onClick={() => chooseVolume(level)}
              aria-label={`Volume ${level}`}
            />
          ))}
        </div>

        <div className={styles.spacer} />

        <button className={styles.primaryButton} onClick={confirmPersona}>
          Continua
        </button>
      </div>
    );
  }

  const ringOffset = RING_CIRCUMFERENCE * (1 - countLeft / COUNTDOWN_S);

  return (
    <div className={styles.screen}>
      <div className={styles.dialHeader}>
        <span className={styles.dialTitle}>{titolo}</span>
        <button className={styles.personaSwitch} onClick={togglePersona}>
          {persona === "coach" ? "Coach" : "Tecnico"}
        </button>
      </div>
      <div className={styles.divider} />

      <div className={styles.dialBody}>
        <div className={styles.ring}>
          <svg width="100%" height="100%" viewBox="0 0 300 300">
            <circle cx="150" cy="150" r={RING_R} fill="none" stroke="#232327" strokeWidth="12" />
            <circle
              cx="150"
              cy="150"
              r={RING_R}
              fill="none"
              stroke="#FF9500"
              strokeWidth="12"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 150 150)"
            />
          </svg>
          <div className={styles.ringNumber}>{Math.ceil(countLeft)}</div>
        </div>
        <div className={styles.dialLead}>Appoggia il telefono.</div>
        <div className={styles.dialSub}>
          Primo: {firstExercise.eser}, {firstExercise.d}
          {"s."}
        </div>
      </div>

      <div className={styles.divider} />
      <button className={styles.skipButton} onClick={() => router.push("/player")}>
        Salta e parti subito
      </button>
    </div>
  );
}
