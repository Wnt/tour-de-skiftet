/* Tour de Skiftet — service worker
   Offline strategy:
   - App shell (HTML/CSS/JS/data/icons/leaflet): precached, cache-first.
   - Map tiles (OpenStreetMap): cache-first, stored as viewed -> available offline afterwards (capped).
   - Weather API (Open-Meteo): network-first, falls back to last cached response. */

const VERSION = 'skiftet-v15';
const SHELL_CACHE = `${VERSION}-shell`;
const TILE_CACHE = `${VERSION}-tiles`;
const API_CACHE = `${VERSION}-api`;
const TILE_MAX = 600; // rough cap on cached map tiles

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './geometry.js',
  './manifest.webmanifest',
  './vendor/leaflet.js',
  './vendor/leaflet.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // cache:'reload' bypasses the HTTP cache so a freshly-installed worker
      // always precaches the just-deployed asset bytes, never stale ones.
      .then((cache) => cache.addAll(SHELL_ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isTile(url) {
  return /tile\.openstreetmap\.org/.test(url.hostname) || /tile\./.test(url.hostname);
}
function isWeather(url) {
  // FMI forecast WFS (XML) — network-first with cache fallback for offline.
  // Radar WMS (openwms.fmi.fi) is intentionally NOT matched here so it stays real-time/uncached.
  return /opendata\.fmi\.fi/.test(url.hostname);
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) {
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Map tiles: cache-first, then network (and store).
  if (isTile(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          // Cache CORS (200) and opaque (type 'opaque', status 0) tile responses.
          if (res && (res.ok || res.type === 'opaque')) {
            cache.put(req, res.clone());
            trimCache(TILE_CACHE, TILE_MAX);
          }
          return res;
        } catch (e) {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // Weather API: network-first, fall back to cached.
  if (isWeather(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(API_CACHE);
        try {
          const res = await fetch(req);
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        } catch (e) {
          const hit = await cache.match(req);
          if (hit) return hit;
          return Response.error();
        }
      })()
    );
    return;
  }

  // App shell + same-origin: cache-first, fall back to network, then index for navigations.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => {
            if (req.mode === 'navigate') return caches.match('./index.html');
            return Response.error();
          });
      })
    );
  }
});
