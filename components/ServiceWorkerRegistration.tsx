"use client";

import { useEffect } from "react";

/**
 * Deliberately does the opposite of its name for now: it tears down any
 * service worker still registered from an earlier build, and the caches it
 * left behind. A cache-first worker kept devices running old code after a
 * deploy, which cost two debugging rounds on bugs that were already fixed.
 * Caching comes back once the reader is stable — as a decision, not a default.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
    }
  }, []);

  return null;
}
