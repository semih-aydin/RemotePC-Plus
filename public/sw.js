// Service Worker - Hızlı açılış ve önbellekleme
const CACHE_NAME = 'remotepc-cache-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/haptics.js',
    '/js/multi_monitor.js',
    '/js/touchpad.js',
    '/js/context_cards.js',
    '/js/magnifier.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

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
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // WebSocket istekleri ve API isteklerini direkt geçir
    if (e.request.url.includes('/api/') || e.request.url.startsWith('ws')) {
        return;
    }
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
