const CACHE_NAME = 'joao-caicara-pdv-v25';
const APP_SHELL = ['/pdv/', '/pdv/manifest.json', '/pdv/access-control.js', '/pdv/access-diagnostics.js', '/pdv/pdv-sync.js', '/pdv/pdv-safety.js', '/pdv/pdv-operations.js', '/pdv/pdv-checkout-core.js', '/pdv/pdv-production.js', '/pdv/modern-hybrid.css', '/pdv/fast-checkout.js', '/pdv/fast-checkout.css', '/pdv/fast-split.js', '/pdv/fast-split.css', '/tradicao-caicara-logo.webp'];
const respostaHtmlComHotfix = async (response) => {
  let html = await response.text();
  if (!html.includes('/pdv/modern-hybrid.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/pdv/modern-hybrid.css"></head>');
  if (!html.includes('/pdv/fast-checkout.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/pdv/fast-checkout.css"></head>');
  if (!html.includes('/pdv/fast-split.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/pdv/fast-split.css"></head>');
  if (!html.includes('/pdv/access-control.js')) html = html.replace('</body>', '<script src="/pdv/access-control.js"></script></body>');
  if (!html.includes('/pdv/access-diagnostics.js')) html = html.replace('</body>', '<script src="/pdv/access-diagnostics.js"></script></body>');
  if (!html.includes('/pdv/pdv-sync.js')) html = html.replace('</body>', '<script src="/pdv/pdv-sync.js"></script></body>');
  if (!html.includes('/pdv/pdv-safety.js')) html = html.replace('</body>', '<script src="/pdv/pdv-safety.js"></script></body>');
  if (!html.includes('/pdv/pdv-operations.js')) html = html.replace('</body>', '<script src="/pdv/pdv-operations.js"></script></body>');
  if (!html.includes('/pdv/pdv-checkout-core.js')) html = html.replace('</body>', '<script src="/pdv/pdv-checkout-core.js"></script></body>');
  if (!html.includes('/pdv/pdv-production.js')) html = html.replace('</body>', '<script src="/pdv/pdv-production.js"></script></body>');
  if (!html.includes('/pdv/fast-checkout.js')) html = html.replace('</body>', '<script src="/pdv/fast-checkout.js"></script></body>');
  if (!html.includes('/pdv/fast-split.js')) html = html.replace('</body>', '<script src="/pdv/fast-split.js"></script></body>');
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
