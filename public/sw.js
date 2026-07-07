const CACHE_NAME = 'gradevibe-vaud-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.svg',
  './sounds/fah.mp3',
  './sounds/confetti.mp3',
  './assets/ruby-zoisite.png',
  './assets/red-jasper.png',
  './assets/ocean-jasper.png',
  './assets/rainbow-moonstone.png',
  './assets/selenite.png',
  './assets/sodalite.png',
  './assets/serpentine.png',
  './assets/rose-quartz.png',
  './assets/labradorite.png',
  './assets/picture-jasper.png',
  './assets/amazonite.png'
];

// Install Event - cache assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event - clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event - cache first strategy
self.addEventListener('fetch', (e) => {
  // Only handle GET requests and local scope fetches
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch new version in background to update cache for next load
        fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, networkResponse);
            });
          }
        }).catch(() => {/* Ignore network errors offline */});

        return cachedResponse;
      }

      return fetch(e.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
