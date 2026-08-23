"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useWorkoutSession } from "@/lib/useWorkoutSession";
import {
  buildDemoSession,
  BG,
  FG,
  DEMO_SESSION_TITLE,
  DEMO_SESSION_ESTIMATE_MIN,
  summarizeSession,
  estimateComparison,
  fmtCountdown,
} from "@/lib/workout";
import { flattenAllenamento, getAllenamentoAttivo } from "@/lib/parsedSession";
import { getPersona, saveCompletedSession } from "@/lib/sessionPrefs";
import { requestWakeLock, releaseWakeLock, watchVisibilityForReacquire } from "@/lib/wakeLock";
import { resumeIfSuspended } from "@/lib/audioCues";
import styles from "./PlayerScreen.module.css";

export default function PlayerScreen() {
  const router = useRouter();
  // Runs the workout the user loaded; falls back to the built-in demo session
  // when the player is opened directly without one.
  const attivo = useMemo(() => getAllenamentoAttivo(), []);
  const steps = useMemo(
    () => (attivo ? flattenAllenamento(attivo) : buildDemoSession()),
    [attivo],
  );
  const titolo = attivo?.titolo ?? DEMO_SESSION_TITLE;
  const stima = attivo?.durataStimataMin ?? DEMO_SESSION_ESTIMATE_MIN;
  const persona = useMemo(() => getPersona() ?? "tecnico", []);
  const session = useWorkoutSession(steps, persona);
  const {
    status,
    elapsedSec,
    blocco,
    round,
    statoLabel,
    statoInverted,
    numText,
    unit,
    eser,
    eserQual,
    hint,
    nextLabel,
    accent,
    contorno,
    showControls,
    ctrlPrimaryLabel,
    progressRef,
    riseRef,
    start,
    togglePause,
    avanti,
    indietro,
    azzera,
    onPointerDown,
    onPointerUp,
    onTap,
  } = session;

  const [flipKey, setFlipKey] = useState(0);
  useEffect(() => {
    setFlipKey((k) => k + 1);
  }, [numText]);

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    requestWakeLock();
    const stopWatchingVisibility = watchVisibilityForReacquire();
    const onVisibility = () => resumeIfSuspended();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      releaseWakeLock();
      stopWatchingVisibility();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (status === "done") {
    const summary = summarizeSession(steps);
    const summaryLine = `${summary.blocchi} blocchi · ${summary.round} round${
      summary.serieChiuseAMano ? ` · ${summary.serieChiuseAMano} serie chiuse a mano` : ""
    }`;

    const handleSave = () => {
      saveCompletedSession({
        titolo,
        durataRealeSec: elapsedSec,
        durataStimataMin: stima,
        blocchi: summary.blocchi,
        round: summary.round,
        serieChiuseAMano: summary.serieChiuseAMano,
        completedAt: new Date().toISOString(),
      });
      router.push("/");
    };

    return (
      <div className={styles.screen} style={{ background: BG }}>
        <div className={styles.done}>
          <div className={styles.doneKicker}>{titolo}</div>
          <div className={styles.doneDivider} />
          <svg width="86" height="86" viewBox="0 0 86 86" className={styles.doneMark}>
            <circle cx="43" cy="43" r="37" fill="none" stroke="#C8FF00" strokeWidth="9" />
            <circle cx="43" cy="43" r="11" fill="#C8FF00" />
          </svg>
          <div className={styles.doneTitle}>Fatta.</div>
          <div className={styles.doneTime}>{fmtCountdown(elapsedSec)}</div>
          <div className={styles.doneSummary}>{summaryLine}</div>
          <div className={styles.doneEstimate}>
            {estimateComparison(elapsedSec, stima)}
          </div>
          <div className={styles.doneSpacer} />
          <button className={styles.doneButtonPrimary} onClick={() => router.push("/preflight")}>
            Rifai
          </button>
          <button className={styles.doneButtonSecondary} onClick={handleSave}>
            Salva in libreria
          </button>
        </div>
      </div>
    );
  }

  const paused = status === "paused";
  const numFill = contorno ? "transparent" : accent;
  const numStroke = contorno ? `6px ${accent}` : "0";
  const eserColor = contorno ? FG : accent;

  return (
    <div
      className={styles.screen}
      style={
        {
          "--accent": accent,
          "--num-fill": numFill,
          "--num-stroke": numStroke,
          "--eser-color": eserColor,
        } as CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={onTap}
    >
      <div className={styles.wrap} style={{ opacity: paused ? 0.34 : 1 }}>
        <div className={styles.header}>
          <span className={styles.blocco}>{blocco}</span>
          <span className={styles.round}>{round}</span>
        </div>
        <div className={styles.divider} />

        <div className={styles.center}>
          <div className={`${styles.stato} ${statoInverted ? styles.inverted : ""}`}>
            {statoLabel}
          </div>

          <div className={styles.numRow}>
            <div key={flipKey} className={`${styles.num} ${numText.includes(":") ? styles.mmss : ""}`}>
              {numText}
            </div>
            <div className={styles.numHinge} />
            {unit && <div className={styles.unit}>{unit}</div>}
          </div>

          <div className={styles.eser}>{eser}</div>
          {eserQual && <div className={styles.qual}>{eserQual}</div>}
          {hint && <div className={styles.hint}>{hint}</div>}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerDivider} />
          {nextLabel && <div className={styles.next}>{nextLabel}</div>}
          <div className={styles.meter}>
            <div ref={progressRef} className={styles.meterFill} />
            <div className={styles.meterTicks} />
          </div>
        </div>
      </div>

      <div ref={riseRef} className={styles.rise} />

      {paused && <div className={styles.pauseBanner}>In pausa</div>}

      {/* Outside .wrap on purpose: the rising field inverts everything it
          covers, and the controls have to stay legible underneath it.
          They also swallow the tap/long-press handlers on the screen. */}
      <div
        className={styles.controls}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button className={styles.ctrl} onClick={indietro} aria-label="Indietro">
          ‹
        </button>
        <button className={`${styles.ctrl} ${styles.ctrlPrimary}`} onClick={togglePause}>
          {status === "idle" ? "Avvia" : status === "paused" ? "Riprendi" : "Pausa"}
        </button>
        <button className={styles.ctrl} onClick={avanti} aria-label="Avanti">
          ›
        </button>
        <button className={styles.ctrl} onClick={azzera} aria-label="Azzera">
          ⟲
        </button>
      </div>
    </div>
  );
}
