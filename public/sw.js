// Service worker for the GONG app shell.
//
// The first version served everything cache-first, which meant a phone kept
// running the previous build after a deploy — a fix could be live on the
// server and still absent on the device. Two different strategies now:
//
//   navigations (the HTML that pulls in the current JS) → network first,
//     cache only as an offline fallback;
//   everything else → cache first, because Next fingerprints those filenames,
//     so a changed file is a different URL and can never be stale.
const CACHE = "gong-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function metti(req, res) {
  if (res && res.status === 200 && res.type === "basic") {
    const copia = res.clone();
    caches.open(CACHE).then((cache) => cache.put(req, copia));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // The reader is never cached: it's a POST anyway, but be explicit.
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => metti(req, res))
        .catch(() => caches.match(req).then((c) => c || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => metti(req, res));
    }),
  );
});
