"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACCENTS, WorkoutStep, fmtCountdown, isContorno, nextStepLabel } from "./workout";
import { speak, type Persona } from "./voice";
import { beep, gong, now as audioNow } from "./audioCues";

export type SessionStatus = "idle" | "running" | "paused" | "done";

const LONG_PRESS_MS = 520;
const RISE_WINDOW_S = 3;
const RISE_MAX_PCT = 100;
const STUCK_NUDGE_S = 90;
const TEN_SECOND_WARNING_MIN_DURATION_S = 20;

interface DisplayState {
  status: SessionStatus;
  elapsedSec: number;
  blocco: string;
  round: string;
  statoLabel: string;
  statoInverted: boolean;
  numText: string;
  unit: string;
  eser: string;
  eserQual: string;
  hint: string;
  nextLabel: string;
  accent: string;
  contorno: boolean;
  showControls: boolean;
  ctrlPrimaryLabel: string;
}

function labelFor(step: WorkoutStep): string {
  if (step.ultimo) return "Ultimo round";
  if (step.t === "prep") return "Pronti";
  if (step.t === "serie") return "Serie";
  return step.t;
}

function initialDisplay(steps: WorkoutStep[]): DisplayState {
  const step = steps[0];
  return {
    status: "idle",
    elapsedSec: 0,
    blocco: step.blocco,
    round: step.round ?? "",
    statoLabel: labelFor(step),
    statoInverted: !!step.ultimo,
    numText: step.attesa ? String(step.rip) : fmtCountdown(step.d ?? 0),
    unit: step.attesa ? "rip" : "",
    eser: step.eser,
    eserQual: step.qual ?? "",
    hint: step.hint ?? "",
    nextLabel: "",
    accent: ACCENTS[step.t],
    contorno: isContorno(step),
    showControls: isContorno(step) || !!step.attesa,
    ctrlPrimaryLabel: "Pausa",
  };
}

/**
 * Drives the workout player's state machine: countdown timers, the
 * tap-to-close-a-set interaction, and long-press-to-pause. Progress-bar and
 * rising-field-transition widths are written directly to the refs this
 * returns on every animation frame (not React state) since they change up
 * to 60x/sec — everything else only changes a few times a second and is
 * plain state.
 */
export function useWorkoutSession(steps: WorkoutStep[], persona: Persona) {
  const [display, setDisplay] = useState<DisplayState>(() => initialDisplay(steps));

  const progressRef = useRef<HTMLDivElement | null>(null);
  const riseRef = useRef<HTMLDivElement | null>(null);

  const indexRef = useRef(0);
  const statusRef = useRef<SessionStatus>("idle");
  const anchorRef = useRef(0);
  const sessionStartRef = useRef(0);
  const remainingAtPauseRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressFiredRef = useRef(false);

  // Per-step audio/voice cue tracking — reset whenever a new step is entered,
  // so each cue fires exactly once even though the countdown is re-evaluated
  // on every animation frame.
  const beepedAtRef = useRef<Set<number>>(new Set());
  const endSoundedRef = useRef(false);
  const tenSecondWarnedRef = useRef(false);
  const stuckNudgedRef = useRef(false);
  const halfwaySaidRef = useRef(false);

  const setProgress = useCallback((pct: number) => {
    if (progressRef.current) progressRef.current.style.width = `${pct}%`;
  }, []);
  const setRise = useCallback((pct: number) => {
    if (riseRef.current) riseRef.current.style.height = `${pct}%`;
  }, []);

  const applyStep = useCallback(
    (index: number) => {
      const step = steps[index];
      const contorno = isContorno(step);
      const next = steps[index + 1];
      setDisplay((prev) => ({
        ...prev,
        blocco: step.blocco,
        round: step.round ?? "",
        statoLabel: labelFor(step),
        statoInverted: !!step.ultimo,
        numText: step.attesa ? String(step.rip) : fmtCountdown(step.d ?? 0),
        unit: step.attesa ? "rip" : "",
        eser: step.eser,
        eserQual: step.qual ?? "",
        hint: step.hint ?? "",
        nextLabel: !contorno && !step.attesa && next ? nextStepLabel(next) : "",
        accent: ACCENTS[step.t],
        contorno,
        showControls: contorno || !!step.attesa,
        ctrlPrimaryLabel: "Pausa",
      }));
      setProgress((index / steps.length) * 100);
      setRise(0);

      beepedAtRef.current = new Set();
      endSoundedRef.current = false;
      tenSecondWarnedRef.current = false;
      stuckNudgedRef.current = false;

      if (step.attesa) {
        speak(persona, "serie", step.eser, step.rip ?? 0);
      } else if (step.t === "lavoro") {
        if (step.ultimo) speak(persona, "ultimoRound");
        else speak(persona, "lavoro", step.eser);
      } else if (step.t === "riposo") {
        speak(persona, "riposo");
      } else if (step.t === "recupero") {
        speak(persona, "recupero");
      }

      if (!halfwaySaidRef.current && index > steps.length / 2 && steps.length > 20) {
        halfwaySaidRef.current = true;
        speak(persona, "meta");
      }
    },
    [steps, setProgress, setRise, persona],
  );

  const goTo = useCallback(
    (index: number) => {
      if (index >= steps.length) {
        indexRef.current = steps.length - 1;
        statusRef.current = "done";
        cancelAnimationFrame(rafRef.current!);
        speak(persona, "fine");
        gong(audioNow(), 147);
        const elapsedSec = (Date.now() - sessionStartRef.current) / 1000;
        setDisplay((prev) => ({ ...prev, status: "done", elapsedSec }));
        return;
      }
      indexRef.current = index;
      anchorRef.current = Date.now();
      applyStep(index);
    },
    [steps, applyStep, persona],
  );

  const loop = useCallback(() => {
    rafRef.current = requestAnimationFrame(loop);
    if (statusRef.current !== "running") return;
    const step = steps[indexRef.current];
    if (!step) return;

    if (step.attesa) {
      const waitedFor = (Date.now() - anchorRef.current) / 1000;
      if (waitedFor > STUCK_NUDGE_S && !stuckNudgedRef.current) {
        stuckNudgedRef.current = true;
        speak(persona, "sveglia");
      }
      return;
    }

    const elapsed = (Date.now() - anchorRef.current) / 1000;
    const duration = step.d ?? 0;
    const remaining = Math.max(0, duration - elapsed);
    const remainingCeil = Math.ceil(remaining);

    setDisplay((prev) => {
      const nextText = fmtCountdown(remaining);
      return prev.numText === nextText ? prev : { ...prev, numText: nextText };
    });
    setProgress(((indexRef.current + elapsed / duration) / steps.length) * 100);

    if (remaining <= RISE_WINDOW_S && remaining > 0) {
      const q = (RISE_WINDOW_S - remaining) / RISE_WINDOW_S;
      setRise(q * RISE_MAX_PCT);
    } else {
      setRise(0);
    }

    if (
      step.t === "lavoro" &&
      duration >= TEN_SECOND_WARNING_MIN_DURATION_S &&
      remainingCeil === 10 &&
      !tenSecondWarnedRef.current
    ) {
      tenSecondWarnedRef.current = true;
      speak(persona, "ultimi");
    }

    if (duration > RISE_WINDOW_S && remainingCeil >= 1 && remainingCeil <= RISE_WINDOW_S) {
      if (!beepedAtRef.current.has(remainingCeil)) {
        beepedAtRef.current.add(remainingCeil);
        beep(audioNow(), 760, 0.09, 0.35);
      }
    }

    if (remaining <= 0) {
      if (!endSoundedRef.current) {
        endSoundedRef.current = true;
        if (step.t === "lavoro") gong(audioNow(), 220);
        else beep(audioNow(), 980, 0.16, 0.4);
      }
      goTo(indexRef.current + 1);
    }
  }, [steps, goTo, setProgress, setRise, persona]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => {
    if (statusRef.current === "running") return;
    statusRef.current = "running";
    anchorRef.current = Date.now();
    sessionStartRef.current = Date.now();
    setDisplay((prev) => ({ ...prev, status: "running" }));
  }, []);

  const togglePause = useCallback(() => {
    const step = steps[indexRef.current];
    if (!step || step.attesa || statusRef.current === "idle" || statusRef.current === "done") return;

    if (statusRef.current === "running") {
      const elapsed = (Date.now() - anchorRef.current) / 1000;
      remainingAtPauseRef.current = (step.d ?? 0) - elapsed;
      statusRef.current = "paused";
      setDisplay((prev) => ({ ...prev, status: "paused", ctrlPrimaryLabel: "Riprendi" }));
    } else {
      anchorRef.current = Date.now() - ((step.d ?? 0) - remainingAtPauseRef.current) * 1000;
      statusRef.current = "running";
      setDisplay((prev) => ({ ...prev, status: "running", ctrlPrimaryLabel: "Pausa" }));
    }
  }, [steps]);

  const onPointerDown = useCallback(() => {
    longPressFiredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      togglePause();
    }, LONG_PRESS_MS);
  }, [togglePause]);

  const onPointerUp = useCallback(() => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, []);

  const onTap = useCallback(() => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    const step = steps[indexRef.current];
    if (step && step.attesa && statusRef.current !== "idle") {
      statusRef.current = "running";
      goTo(indexRef.current + 1);
    }
  }, [steps, goTo]);

  return {
    ...display,
    progressRef,
    riseRef,
    start,
    onPointerDown,
    onPointerUp,
    onTap,
  };
}
