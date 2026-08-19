"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACCENTS, WorkoutStep, fmtCountdown, isContorno, nextStepLabel } from "./workout";

export type SessionStatus = "idle" | "running" | "paused" | "done";

const LONG_PRESS_MS = 520;
const RISE_WINDOW_S = 3;
const RISE_MAX_PCT = 62;

interface DisplayState {
  status: SessionStatus;
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
export function useWorkoutSession(steps: WorkoutStep[]) {
  const [display, setDisplay] = useState<DisplayState>(() => initialDisplay(steps));

  const progressRef = useRef<HTMLDivElement | null>(null);
  const riseRef = useRef<HTMLDivElement | null>(null);

  const indexRef = useRef(0);
  const statusRef = useRef<SessionStatus>("idle");
  const anchorRef = useRef(0);
  const remainingAtPauseRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressFiredRef = useRef(false);

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
    },
    [steps, setProgress, setRise],
  );

  const goTo = useCallback(
    (index: number) => {
      if (index >= steps.length) {
        indexRef.current = steps.length - 1;
        statusRef.current = "done";
        cancelAnimationFrame(rafRef.current!);
        setDisplay((prev) => ({ ...prev, status: "done" }));
        return;
      }
      indexRef.current = index;
      anchorRef.current = Date.now();
      applyStep(index);
    },
    [steps, applyStep],
  );

  const loop = useCallback(() => {
    rafRef.current = requestAnimationFrame(loop);
    if (statusRef.current !== "running") return;
    const step = steps[indexRef.current];
    if (!step || step.attesa) return;

    const elapsed = (Date.now() - anchorRef.current) / 1000;
    const duration = step.d ?? 0;
    const remaining = Math.max(0, duration - elapsed);

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

    if (remaining <= 0) goTo(indexRef.current + 1);
  }, [steps, goTo, setProgress, setRise]);

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
