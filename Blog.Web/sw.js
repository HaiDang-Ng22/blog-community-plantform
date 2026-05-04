const CACHE_NAME = 'zynk-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/settings.html',
    '/css/style.css',
    '/js/common.js',
    '/assets/logo-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
