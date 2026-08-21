/* aitiku service worker: covers 永久缓存(cache-first) + 核心资源版本缓存(随 ?v= 版本重建) */
const VER = "20260821h";
const CORE = "aitiku-core-" + VER;
const IMGS = "aitiku-imgs-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CORE)
      .then((c) => c.addAll(["./", "./app.js?v=" + VER, "./styles.css?v=" + VER]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(
        ks.filter((k) => k.startsWith("aitiku-core-") && k !== CORE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  const isImg = u.pathname.includes("/covers/");
  const cacheName = isImg ? IMGS : CORE;
  e.respondWith(
    caches.match(e.request, { cacheName: cacheName }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(cacheName).then((c) => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
