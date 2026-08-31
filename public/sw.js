const CACHE = "agenda-profissa-static-v4";
const STATIC_ASSETS = ["/manifest.webmanifest", "/brand/agenda-profissa-symbol-v2.png", "/brand/agenda-profissa-logo-light.svg", "/brand/agenda-profissa-logo-dark.svg"];
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
});
self.addEventListener("activate", (event) => event.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
])));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || event.request.mode === "navigate") return;
  if (!STATIC_ASSETS.includes(url.pathname) && !url.pathname.startsWith("/_next/static/")) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
