const CACHE_NAME = 'joao-caicara-garcom-v6';
const APP_SHELL = ['/garcom/', '/garcom/manifest.json', '/garcom/hotfix-sync.js', '/garcom/modern-hybrid.css', '/garcom/production-status.js', '/garcom/production-status.css', '/tradicao-caicara-logo.webp'];
const respostaHtmlComHotfix = async (response) => {
  let html = await response.text();
  if (!html.includes('/garcom/modern-hybrid.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/garcom/modern-hybrid.css"></head>');
  if (!html.includes('/garcom/production-status.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/garcom/production-status.css"></head>');
  if (!html.includes('/garcom/hotfix-sync.js')) html = html.replace('</body>', '<script src="/garcom/hotfix-sync.js"></script></body>');
  if (!html.includes('/garcom/production-status.js')) html = html.replace('</body>', '<script src="/garcom/production-status.js"></script></body>');
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
      if (request.mode === 'navigate' && url.pathname.startsWith('/garcom/') && (response.headers.get('content-type') || '').includes('text/html')) {
        const patched = await respostaHtmlComHotfix(response);
        caches.open(CACHE_NAME).then(cache => cache.put(request, patched.clone()));
        return patched;
      }
      caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    } catch (erro) {
      const cached = await caches.match(request);
      if (!cached) return caches.match('/garcom/');
      if (request.mode === 'navigate' && (cached.headers.get('content-type') || '').includes('text/html')) return respostaHtmlComHotfix(cached);
      return cached;
    }
  })());
});
