let sentinel: WakeLockSentinel | null = null;

export async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request("screen");
  } catch {
    // rejected (e.g. low battery, backgrounded tab) — session continues without it
  }
}

export function releaseWakeLock() {
  if (!sentinel) return;
  sentinel.release().catch(() => {});
  sentinel = null;
}

/**
 * iOS releases the wake lock whenever the tab backgrounds (screen lock,
 * app switch) and never re-requests it automatically on return — this
 * listener does that. Returns a cleanup function for the caller's effect.
 */
export function watchVisibilityForReacquire(): () => void {
  const onVisibility = () => {
    if (!document.hidden && sentinel === null) requestWakeLock();
  };
  document.addEventListener("visibilitychange", onVisibility);
  return () => document.removeEventListener("visibilitychange", onVisibility);
}
