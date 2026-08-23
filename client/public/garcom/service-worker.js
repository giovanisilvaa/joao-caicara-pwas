const CACHE_NAME = 'joao-caicara-garcom-v3';
const APP_SHELL = ['/garcom/', '/garcom/manifest.json', '/garcom/hotfix-sync.js', '/tradicao-caicara-logo.webp'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (request.mode === 'navigate' && url.pathname.startsWith('/garcom/')) {
        const type = response.headers.get('content-type') || '';
        if (type.includes('text/html')) {
          let html = await response.text();
          if (!html.includes('/garcom/hotfix-sync.js')) html = html.replace('</body>', '<script src="/garcom/hotfix-sync.js"></script></body>');
          const patched = new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
          caches.open(CACHE_NAME).then(cache => cache.put(request, patched.clone()));
          return patched;
        }
      }
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    } catch (erro) {
      const cached = await caches.match(request);
      if (!cached) return caches.match('/garcom/');
      if (request.mode === 'navigate') {
        const type = cached.headers.get('content-type') || '';
        if (type.includes('text/html')) {
          let html = await cached.text();
          if (!html.includes('/garcom/hotfix-sync.js')) html = html.replace('</body>', '<script src="/garcom/hotfix-sync.js"></script></body>');
          return new Response(html, { status: cached.status, statusText: cached.statusText, headers: cached.headers });
        }
      }
      return cached;
    }
  })());
});
