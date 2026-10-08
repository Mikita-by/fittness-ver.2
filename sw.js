// ==================== SERVICE WORKER ====================
const CACHE_NAME = 'fittrack-v1';
const CACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

// Установка: кэшируем базовые файлы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS).catch((err) => {
        console.warn('Не удалось закэшировать некоторые файлы:', err);
      });
    })
  );
  self.skipWaiting();
});

// Активация: удаляем старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Стратегия: cache-first для своих файлов, network-first для внешних API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Не кэшируем запросы к ИИ и внешним API — они должны идти в сеть
  if (
    url.hostname.includes('puter.com') ||
    url.hostname.includes('openfoodfacts.org') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('unpkg.com')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response('', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // Для остальных — сначала кэш, потом сеть
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        // Кэшируем успешные GET-запросы
        if (event.request.method === 'GET' && fetchResponse.status === 200) {
          const clone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return fetchResponse;
      });
    }).catch(() => {
      // Офлайн fallback
      if (event.request.destination === 'document') {
        return caches.match('./index.html');
      }
      return new Response('', { status: 503, statusText: 'Offline' });
    })
  );
});