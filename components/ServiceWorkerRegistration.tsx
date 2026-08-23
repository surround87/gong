"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell service worker, and reloads once when a new one
 * takes over. Without that reload the page you are looking at keeps running
 * the build it was loaded with, so a deployed fix stays invisible on the
 * device until the app is opened a second time.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let ricaricato = false;
    const onControllerChange = () => {
      if (ricaricato) return;
      ricaricato = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const registra = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => reg.update())
        .catch((err) => console.error("Service worker registration failed:", err));
    };
    if (document.readyState === "complete") registra();
    else window.addEventListener("load", registra);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
