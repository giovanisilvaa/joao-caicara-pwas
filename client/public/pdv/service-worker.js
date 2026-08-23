const CACHE_NAME = 'joao-caicara-pdv-v6';
const APP_SHELL = ['/pdv/', '/pdv/manifest.json', '/pdv/hotfix-sync.js', '/pdv/modern-hybrid.css', '/pdv/production-status.js', '/pdv/production-status.css', '/tradicao-caicara-logo.webp'];
const respostaHtmlComHotfix = async (response) => {
  let html = await response.text();
  if (!html.includes('/pdv/modern-hybrid.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/pdv/modern-hybrid.css"></head>');
  if (!html.includes('/pdv/production-status.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/pdv/production-status.css"></head>');
  if (!html.includes('/pdv/hotfix-sync.js')) html = html.replace('</body>', '<script src="/pdv/hotfix-sync.js"></script></body>');
  if (!html.includes('/pdv/production-status.js')) html = html.replace('</body>', '<script src="/pdv/production-status.js"></script></body>');
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
};
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
      if (request.mode === 'navigate' && url.pathname.startsWith('/pdv/') && (response.headers.get('content-type') || '').includes('text/html')) {
        const patched = await respostaHtmlComHotfix(response);
        caches.open(CACHE_NAME).then(cache => cache.put(request, patched.clone()));
        return patched;
      }
      caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    } catch (erro) {
      const cached = await caches.match(request);
      if (!cached) return caches.match('/pdv/');
      if (request.mode === 'navigate' && (cached.headers.get('content-type') || '').includes('text/html')) return respostaHtmlComHotfix(cached);
      return cached;
    }
  })());
});
