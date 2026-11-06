/* Hub Trade offline service worker: app shell + static assets */
const SHELL = "hubtrade-shell-v1";
const ASSETS = "hubtrade-assets-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", "/index.html"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/") || url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => { caches.open(SHELL).then((c) => c.put("/index.html", res.clone())); return res; })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  if (/\.(js|css|png|jpg|jpeg|svg|woff2?|ico|json)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => { caches.open(ASSETS).then((c) => c.put(req, res.clone())); return res; }))
    );
  }
});
