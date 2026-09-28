const CACHE_NAME = "rovmart-v4";
const CORE = [
  "./",
  "./index.html",
  "./product.html",
  "./style.css",
  "./config.js",
  "./products.js",
  "./cart.js",
  "./order.js",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/favicon.svg",
  "./assets/banner.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.all(CORE.map(async asset => {
        try {
          await cache.add(asset);
        } catch (_) {
          // A single optional asset should not block service-worker installation.
        }
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isCacheableStatic(request) {
  const url = new URL(request.url);
  return /\.(?:css|js|svg|png|jpe?g|webp|gif|ico|webmanifest)$/i.test(url.pathname);
}

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.ok) {
      const copy = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, copy);
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    return cached || fallback || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const copy = response.clone();
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, copy);
  }
  return response;
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, caches.match("./index.html")));
    return;
  }

  if (isCacheableStatic(event.request)) {
    const path = url.pathname.toLowerCase();
    const alwaysFresh = /\/(?:config|products|cart|order|app)\.js$/i.test(path) || /\/style\.css$/i.test(path);
    event.respondWith(alwaysFresh ? networkFirst(event.request) : cacheFirst(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});
