const CACHE_NAME = 'joao-caicara-pdv-v28-report-v29-live-v30-print-v31';
const AUTH_SESSION_ASSET = '/auth-session-isolation.js?v=20';
const MESA_ATOMIC_ASSET = '/mesa-atomic.js?v=38';
const MESA_CONCURRENCY_ASSET = '/pdv/' + 'mesa-concurrency.js?v=40';
const MENU_ORDER_OPTIONS_ASSET = '/menu-order-options.js?v=1';
const PDV_PRODUCTION_ASSET = '/pdv/' + 'pdv-production.js?v=40&flow=2';
const PDV_MESAS_AUTH_ASSET = '/pdv/' + 'mesas-auth-reconnect.js?v=1';
const PDV_CARDAPIO_AUTH_ASSET = '/pdv/' + 'cardapio-auth-reconnect.js?v=1';
const AUTO_PRODUCTION_PRINT_ASSET = '/pdv/' + 'pdv-auto-production-print.js?v=3';
const AUTO_CLOSE_PRINT_ASSET = '/pdv/' + 'pdv-auto-close-print.js?v=2';
const RUNTIME_GUARD_ASSET = '/pdv/' + 'runtime-guard.js?v=40';
const DAILY_SALES_REPORT_ASSET = '/pdv/' + 'daily-sales-report.js?v=29';
const PRINT_HEALTH_ASSET = '/pdv/' + 'pdv-print-health.js?v=1';
const LIVE_UPDATE_ASSET = '/pwa-live-update.js?v=1';
const APP_SHELL = ['/pdv/', '/pdv/manifest.json', AUTH_SESSION_ASSET, MESA_ATOMIC_ASSET, '/pdv/access-control.js?v=31', '/pdv/admin-login.js?v=33', '/pdv/access-diagnostics.js?v=32', '/pdv/pdv-sync.js', PDV_MESAS_AUTH_ASSET, PDV_CARDAPIO_AUTH_ASSET, '/pdv/pdv-safety.js', '/pdv/pdv-operations.js', '/pdv/pdv-checkout-core.js', '/pdv/waiter-sales-report.js?v=28', '/pdv/service-fee-shifts.js?v=28', '/pdv/cash-reset.js?v=35', PRINT_HEALTH_ASSET, PDV_PRODUCTION_ASSET, MESA_CONCURRENCY_ASSET, MENU_ORDER_OPTIONS_ASSET, AUTO_PRODUCTION_PRINT_ASSET, AUTO_CLOSE_PRINT_ASSET, '/pdv/modern-hybrid.css', '/pdv/menu-admin-cta.css?v=34', '/pdv/fast-checkout.js', '/pdv/fast-checkout.css', '/pdv/fast-split.js', '/pdv/fast-split.css', RUNTIME_GUARD_ASSET, DAILY_SALES_REPORT_ASSET, LIVE_UPDATE_ASSET, '/tradicao-caicara-logo.webp'];
const respostaHtmlComHotfix = async (response) => {
  let html = await response.text();
  if (!html.includes('/pdv/modern-hybrid.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/pdv/modern-hybrid.css"></head>');
  if (!html.includes('/pdv/menu-admin-cta.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/pdv/menu-admin-cta.css?v=34"></head>');
  if (!html.includes('/pdv/fast-checkout.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/pdv/fast-checkout.css"></head>');
  if (!html.includes('/pdv/fast-split.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/pdv/fast-split.css"></head>');
  if (!html.includes('/auth-session-isolation.js')) html = html.replace('</body>', '<script src="/auth-session-isolation.js?v=20"></script></body>');
  if (!html.includes('/mesa-atomic.js')) html = html.replace('</body>', '<script src="/mesa-atomic.js?v=38"></script></body>');
  if (!html.includes('/pdv/access-control.js')) html = html.replace('</body>', '<script src="/pdv/access-control.js?v=31"></script></body>');
  if (!html.includes('/pdv/admin-login.js')) html = html.replace('</body>', '<script src="/pdv/admin-login.js?v=33"></script></body>');
  if (!html.includes('/pdv/access-diagnostics.js')) html = html.replace('</body>', '<script src="/pdv/access-diagnostics.js?v=32"></script></body>');
  if (!html.includes('/pdv/pdv-sync.js')) html = html.replace('</body>', '<script src="/pdv/pdv-sync.js"></script></body>');
  if (!html.includes('/pdv/mesas-auth-reconnect.js')) html = html.replace('</body>', '<script src="/pdv/mesas-auth-reconnect.js?v=1"></script></body>');
  if (!html.includes('/pdv/cardapio-auth-reconnect.js')) html = html.replace('</body>', '<script src="/pdv/cardapio-auth-reconnect.js?v=1"></script></body>');
  if (!html.includes('/pdv/pdv-safety.js')) html = html.replace('</body>', '<script src="/pdv/pdv-safety.js"></script></body>');
  if (!html.includes('/pdv/pdv-operations.js')) html = html.replace('</body>', '<script src="/pdv/pdv-operations.js"></script></body>');
  if (!html.includes('/pdv/pdv-checkout-core.js')) html = html.replace('</body>', '<script src="/pdv/pdv-checkout-core.js"></script></body>');
  if (!html.includes('/pdv/waiter-sales-report.js')) html = html.replace('</body>', '<script src="/pdv/waiter-sales-report.js?v=28"></script></body>');
  if (!html.includes('/pdv/service-fee-shifts.js')) html = html.replace('</body>', '<script src="/pdv/service-fee-shifts.js?v=28"></script></body>');
  if (!html.includes('/pdv/cash-reset.js')) html = html.replace('</body>', '<script src="/pdv/cash-reset.js?v=35"></script></body>');
  if (!html.includes('/pdv/pdv-print-health.js')) html = html.replace('</body>', '<script src="/pdv/pdv-print-health.js?v=1"></script></body>');
  if (!html.includes('/pdv/pdv-production.js')) html = html.replace('</body>', '<script src="/pdv/pdv-production.js?v=40&flow=2"></script></body>');
  if (!html.includes('/pdv/mesa-concurrency.js')) html = html.replace('</body>', '<script src="/pdv/mesa-concurrency.js?v=40"></script></body>');
  if (!html.includes('/menu-order-options.js')) html = html.replace('</body>', '<script src="/menu-order-options.js?v=1"></script></body>');
  if (!html.includes('/pdv/pdv-auto-production-print.js')) html = html.replace('</body>', '<script src="/pdv/pdv-auto-production-print.js?v=3"></script></body>');
  if (!html.includes('/pdv/pdv-auto-close-print.js')) html = html.replace('</body>', '<script src="/pdv/pdv-auto-close-print.js?v=2"></script></body>');
  if (!html.includes('/pdv/fast-checkout.js')) html = html.replace('</body>', '<script src="/pdv/fast-checkout.js"></script></body>');
  if (!html.includes('/pdv/fast-split.js')) html = html.replace('</body>', '<script src="/pdv/fast-split.js"></script></body>');
  if (!html.includes('/pdv/runtime-guard.js')) html = html.replace('</body>', '<script src="/pdv/runtime-guard.js?v=40"></script></body>');
  if (!html.includes('/pdv/daily-sales-report.js')) html = html.replace('</body>', '<script src="/pdv/daily-sales-report.js?v=29"></script></body>');
  if (!html.includes('/pwa-live-update.js')) html = html.replace('</body>', '<script src="/pwa-live-update.js?v=1"></script></body>');
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
    const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clientes.map(client => {
      const url = new URL(client.url);
      if (url.origin !== self.location.origin || !url.pathname.startsWith('/pdv/')) return null;
      return client.navigate(client.url);
    }));
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: 'no-store' });
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
