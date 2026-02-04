/* LeadMarka minimal service worker
 *
 * Goals:
 * - Enable installability / app-like feel
 * - Avoid caching API responses (prevent stale data)
 * - Provide basic offline resilience for the app shell
 */

const CACHE_VERSION = 'v1';
const APP_SHELL_CACHE = `leadmarka-app-shell-${CACHE_VERSION}`;

const APP_SHELL_URLS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith('leadmarka-') && key !== APP_SHELL_CACHE)
              .map((key) => caches.delete(key))
          )
        ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isApiRequest(url) {
  // Keep API calls network-only (avoid stale data).
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/cron/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isApiRequest(url)) {
    // Network-only for API endpoints
    event.respondWith(fetch(req));
    return;
  }

  // Navigation requests (SPA): network-first, fallback to cached index.html.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Update cached index.html opportunistically
          const resClone = res.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put('/index.html', resClone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: cache-first, then update cache in background.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Only cache successful, basic responses
        if (res && res.ok && res.type === 'basic') {
          const resClone = res.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, resClone)).catch(() => {});
        }
        return res;
      });
    })
  );
});

