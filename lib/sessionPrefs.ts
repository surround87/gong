import type { Persona } from "./voice";

const PERSONA_KEY = "gong:persona";
const VOLUME_KEY = "gong:volume";
const SESSIONS_KEY = "gong:sessions";

export const VOLUME_LEVELS = 6;
const DEFAULT_VOLUME_LEVEL = 4;

export function getVolumeLevel(): number {
  if (typeof window === "undefined") return DEFAULT_VOLUME_LEVEL;
  const raw = Number(window.localStorage.getItem(VOLUME_KEY));
  return raw >= 1 && raw <= VOLUME_LEVELS ? raw : DEFAULT_VOLUME_LEVEL;
}

export function setVolumeLevel(level: number) {
  window.localStorage.setItem(VOLUME_KEY, String(level));
}

export function getPersona(): Persona | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(PERSONA_KEY);
  return v === "coach" || v === "tecnico" ? v : null;
}

export function setPersona(persona: Persona) {
  window.localStorage.setItem(PERSONA_KEY, persona);
}

export interface CompletedSession {
  titolo: string;
  durataRealeSec: number;
  durataStimataMin: [number, number];
  blocchi: number;
  round: number;
  serieChiuseAMano: number;
  completedAt: string;
}

export function saveCompletedSession(session: CompletedSession) {
  const existing = getSavedSessions();
  existing.push(session);
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(existing));
}

export function getSavedSessions(): CompletedSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as CompletedSession[]) : [];
  } catch {
    return [];
  }
}
