/* O catálogo, o painel, uploads e pedidos precisam sempre da rede. */
const VERSION = 'wesllen-pwa-1';
const CORE_CACHE = `${VERSION}-core`;
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
const OWN_CACHES = [CORE_CACHE, STATIC_CACHE, IMAGE_CACHE];
const CORE = ['/offline.html', '/icons/icon-192.png'];
const MAX_IMAGES = 40;
const MAX_IMAGE_BYTES = 400_000;
const MAX_STATIC = 30;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CORE_CACHE).then(cache => cache.addAll(CORE)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('wesllen-pwa-') && !OWN_CACHES.includes(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  try {
    const response = await fetch(request);
    const bytes = Number(response.headers.get('content-length'));
    if (response.ok && response.type === 'basic' && bytes > 0 && bytes <= MAX_IMAGE_BYTES) {
      try {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        if (keys.length > MAX_IMAGES) await Promise.all(keys.slice(0, keys.length - MAX_IMAGES).map(key => cache.delete(key)));
      } catch { /* Cache cheio não deve impedir a imagem de carregar. */ }
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function networkFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      try {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        if (keys.length > MAX_STATIC) await Promise.all(keys.slice(0, keys.length - MAX_STATIC).map(key => cache.delete(key)));
      } catch { /* Recurso da rede continua válido. */ }
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('Recurso indisponível sem conexão');
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (path.startsWith('/api/') || path.startsWith('/admin') || path.startsWith('/uploads/') || path === '/manifest.webmanifest' || path === '/sw.js') return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/offline.html')) || Response.error()));
    return;
  }
  if (path.startsWith('/assets/') && /\.(?:png|jpe?g|webp|svg)$/i.test(path)) {
    event.respondWith(cacheImage(request));
    return;
  }
  if (/\.(?:css|js)$/i.test(path)) event.respondWith(networkFirstStatic(request));
});
