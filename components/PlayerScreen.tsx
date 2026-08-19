"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useWorkoutSession } from "@/lib/useWorkoutSession";
import { buildDemoSession, BG, FG } from "@/lib/workout";
import styles from "./PlayerScreen.module.css";

export default function PlayerScreen() {
  const router = useRouter();
  const steps = useMemo(() => buildDemoSession(), []);
  const session = useWorkoutSession(steps);
  const {
    status,
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

  if (status === "done") {
    return (
      <div className={styles.screen} style={{ background: BG }}>
        <div className={styles.done}>
          <div className={styles.doneLabel}>Sessione completata</div>
          <div className={styles.doneTitle} style={{ color: FG }}>
            Ben fatto.
          </div>
          <button className={styles.doneButton} onClick={() => router.push("/")}>
            Ricomincia
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
          <div className={styles.illu} style={{ opacity: contorno ? 0.5 : 0.09 }} />

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
          {showControls && (
            <div className={styles.controls}>
              <div className={styles.ctrl}>{ctrlPrimaryLabel}</div>
              <div className={styles.ctrl}>Termina</div>
            </div>
          )}
        </div>
      </div>

      <div ref={riseRef} className={styles.rise} />

      {paused && <div className={styles.pauseBanner}>In pausa</div>}
    </div>
  );
}
