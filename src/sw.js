// --- Service worker (compiled by vite-plugin-pwa, injectManifest mode) ---
// The precache list below (self.__WB_MANIFEST) is generated at build time
// with a content hash per file: shipping a new build automatically retires
// stale assets. No more hand-bumped cache names.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// autoUpdate: a freshly-deployed SW activates immediately instead of waiting
// for a user tap, so returning visitors get the latest build on their next
// navigation — no manual cache-clear ever needed.
self.addEventListener('install', () => self.skipWaiting());

// App-shell navigation: every in-scope navigation serves the precached index.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// The update prompt in features/pwa.js posts SKIP_WAITING when the user
// taps "Recharger" — never yank the page out from under someone mid-entry.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Delete the legacy hand-rolled cache ('gradevibe-vaud-cache-v1').
        // Workbox's cleanupOutdatedCaches only removes old WORKBOX caches,
        // it will never touch this one.
        const keys = await caches.keys();
        await Promise.all(
            keys.filter((key) => key.startsWith('gradevibe-vaud-cache')).map((key) => caches.delete(key))
        );
        await clientsClaim();
    })());
});

// Google Fonts stylesheets: tolerate updates, work offline after first visit.
registerRoute(
    ({ url }) => url.origin === 'https://fonts.googleapis.com',
    new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' })
);

// Font files are immutable — cache hard, expire lazily.
registerRoute(
    ({ url }) => url.origin === 'https://fonts.gstatic.com',
    new CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 })]
    })
);

// Tesseract OCR runtime chunks (worker/wasm/traineddata, ~15MB): cached on
// first use so the scanner works offline afterwards, without bloating the
// install-time precache for students who never use OCR.
registerRoute(
    ({ url }) => url.hostname === 'unpkg.com' || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'tessdata.projectnaptha.com',
    new CacheFirst({
        cacheName: 'tesseract-ocr',
        plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 180 })]
    })
);
