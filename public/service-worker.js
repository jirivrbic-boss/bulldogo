// Service Worker pro Bulldogo.cz - Optimalizovaná caching strategie
const CACHE_VERSION = 'v1.2.3';
const CACHE_NAME = `bulldogo-cache-${CACHE_VERSION}`;
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB limit

// Kritické statické zdroje k cache (CSS, JS, obrázky)
const STATIC_ASSETS = [
    '/styles.css',
    '/electric-border.css',
    '/script.js',
    '/auth.js',
    '/firebase-init.js',
    '/fotky/bulldogo-logo.png',
    '/site.webmanifest'
];

// Strategie: Cache First (pro statické zdroje)
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        // Fallback na offline stránku, pokud existuje
        return new Response('Offline', { status: 503 });
    }
}

// Strategie: Network First (pro HTML stránky - vždy zkusit síť, pak cache)
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        return cachedResponse || new Response('Offline', { status: 503 });
    }
}

// Install event - cache statické zdroje
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((error) => {
                console.log('SW: Některé statické zdroje se nepodařilo cache:', error);
            });
        })
    );
    self.skipWaiting(); // Aktivovat ihned
});

// Activate event - vyčistit staré cache
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim(); // Převzít kontrolu nad stránkami
});

// Fetch event - optimalizované strategie
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const request = event.request;
    
    // Ignorovat Firebase a externí API (necacheovat)
    if (url.hostname.includes('firebase') || 
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('googleusercontent.com') ||
        url.hostname.includes('chimpstatic.com') ||
        url.hostname.includes('cdnjs.cloudflare.com')) {
        return; // Nechat projít bez cache
    }
    
    // HTML stránky - Stale While Revalidate (rychlejší než Network First)
    if (request.destination === 'document' || 
        request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }
    
    // CSS, JS - Cache First (nejrychlejší pro statické zdroje)
    if (request.destination === 'style' ||
        request.destination === 'script' ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js')) {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // Obrázky - Cache First s fallbackem
    if (request.destination === 'image' || 
        /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(url.pathname)) {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // Ostatní - Network First
    event.respondWith(networkFirst(request));
});

// Stale While Revalidate - rychlejší než Network First
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => cachedResponse);
    
    return cachedResponse || fetchPromise;
}

