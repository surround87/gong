// Kill switch, on purpose.
//
// The first worker cached everything ahead of the network, which meant a fix
// could be live on the server and still absent on the phone — twice we
// debugged code that was no longer running. Offline support isn't worth that
// while the app is still changing daily, so this version deletes the caches,
// unregisters itself, and reloads whatever windows it still controls.
// Reintroduce caching later, deliberately, once the reader is stable.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: "window" });
      for (const w of windows) w.navigate(w.url);
    })(),
  );
});
