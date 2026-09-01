const CACHE_NAME = 'joao-caicara-garcom-v15-fresh-20260826-live-v18-menu-v19-half-v20-cancel-v21-staged-v22-closefix-v23-restrict-v24-draft-v25-session-v26-checkout-v27-authfix-v28-menu-reconnect-v29-mesas-reconnect-v30-sync-guard-v31';
const AUTH_SESSION_ASSET = '/auth-session-isolation.js?v=20';
const LOGIN_ASSET = '/garcom/shared-login.js?v=19';
const CARDAPIO_AUTH_ASSET = '/garcom/cardapio-auth-reconnect.js?v=21';
const MESAS_AUTH_ASSET = '/garcom/mesas-auth-reconnect.js?v=38';
const MESA_ATOMIC_ASSET = '/mesa-atomic.js?v=38';
const MESA_CONCURRENCY_ASSET = '/garcom/' + 'mesa-concurrency.js?v=36';
const ITEM_CANCELLATION_ASSET = '/item-cancellation-v2.js?v=2';
const STAGED_CHECKOUT_ASSET = '/staged-checkout-v1.js?v=1';
const GARCOM_RESTRICTIONS_ASSET = '/garcom/restricoes-operacionais.js?v=3';
const MENU_ORDER_OPTIONS_ASSET = '/menu-order-options.js?v=1';
const SALAD_HALF_ASSET = '/menu-salad-half.js?v=2';
const MENU_UPDATE_ASSET = '/menu-20260828.js?v=1';
const LIVE_UPDATE_ASSET = '/pwa-live-update.js?v=1';
const APP_SHELL = ['/garcom/', '/garcom/manifest.json', AUTH_SESSION_ASSET, MESA_ATOMIC_ASSET, '/garcom/access-control.js', LOGIN_ASSET, MESAS_AUTH_ASSET, CARDAPIO_AUTH_ASSET, '/garcom/access-diagnostics.js', '/garcom/hotfix-sync.js', '/garcom/waiter-attribution.js', '/garcom/garcom-service-fee.js?v=19', '/garcom/modern-hybrid.css', '/garcom/waiter-speed.js', '/garcom/waiter-speed.css', MESA_CONCURRENCY_ASSET, ITEM_CANCELLATION_ASSET, STAGED_CHECKOUT_ASSET, GARCOM_RESTRICTIONS_ASSET, MENU_ORDER_OPTIONS_ASSET, SALAD_HALF_ASSET, MENU_UPDATE_ASSET, LIVE_UPDATE_ASSET, '/tradicao-caicara-logo.webp'];

function removerListenersLegados(html) {
  const inicio = html.indexOf("    db.ref('cardapio').on('value', (snap) => {");
  const fim = inicio >= 0 ? html.indexOf('    function mesaVazia() {', inicio) : -1;
  if (inicio < 0 || fim < 0) return html;
  return `${html.slice(0, inicio)}    // /cardapio e /mesas são assinados somente pelos módulos autenticados do Garçom.\n\n${html.slice(fim)}`;
}

const respostaHtmlComHotfix = async (response) => {
  let html = await response.text();
  html = html.replace(`    firebase.auth().signInAnonymously().catch((erro) => {
        console.error('Erro ao autenticar no Firebase:', erro);
        atualizarStatusConexaoG('🔴 erro de conexão', 'sync-error');
    });`, `    // A autenticação operacional do Garçom é feita somente pela conta real compartilhada.`);
  html = removerListenersLegados(html);
  html = html.replace(
    `        firebaseAuthReadyG = Boolean(user);\n        if (!user) atualizarStatusConexaoG('🔴 aguardando conexão', 'sync-error');`,
    `        firebaseAuthReadyG = Boolean(user && !user.isAnonymous && String(user.email || '').toLowerCase() === 'garcom@acesso.joaocaicara.app');\n        if (!firebaseAuthReadyG) atualizarStatusConexaoG('🟠 autenticando Garçom', 'sync-pending');`
  );
  html = html.replace(
    `        } else if (!firebaseConectadoG) {\n            atualizarStatusConexaoG('🟠 conectando Firebase', 'sync-pending');\n        } else if (pendencias.length) {`,
    `        } else if (!firebaseConectadoG) {\n            atualizarStatusConexaoG('🟠 conectando Firebase', 'sync-pending');\n        } else if (!firebaseAuthReadyG || window.GarcomMesasAuth?.conectado !== true) {\n            atualizarStatusConexaoG('🟠 sincronizando mesas', 'sync-pending');\n        } else if (pendencias.length) {`
  );
  if (!html.includes('/garcom/modern-hybrid.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/garcom/modern-hybrid.css"></head>');
  if (!html.includes('/garcom/waiter-speed.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/garcom/waiter-speed.css"></head>');
  if (!html.includes('/auth-session-isolation.js')) html = html.replace('</body>', '<script src="/auth-session-isolation.js?v=20"></script></body>');
  if (!html.includes('/mesa-atomic.js')) html = html.replace('</body>', '<script src="/mesa-atomic.js?v=38"></script></body>');
  if (!html.includes('/garcom/access-control.js')) html = html.replace('</body>', '<script src="/garcom/access-control.js"></script></body>');
  html = html.replaceAll('<script src="/garcom/shared-login.js?v=17"></script>', '');
  html = html.replaceAll('<script src="/garcom/shared-login.js?v=18"></script>', '');
  if (!html.includes('shared-login.js?v=19')) html = html.replace('</body>', '<script src="/garcom/shared-login.js?v=19"></script></body>');
  html = html.replaceAll('<script src="/garcom/mesas-auth-reconnect.js?v=37"></script>', '');
  if (!html.includes('mesas-auth-reconnect.js?v=38')) html = html.replace('</body>', '<script src="/garcom/mesas-auth-reconnect.js?v=38"></script></body>');
  html = html.replaceAll('<script src="/garcom/cardapio-auth-reconnect.js?v=20"></script>', '');
  if (!html.includes('cardapio-auth-reconnect.js?v=21')) html = html.replace('</body>', '<script src="/garcom/cardapio-auth-reconnect.js?v=21"></script></body>');
  if (!html.includes('/garcom/access-diagnostics.js')) html = html.replace('</body>', '<script src="/garcom/access-diagnostics.js"></script></body>');
  if (!html.includes('/garcom/hotfix-sync.js')) html = html.replace('</body>', '<script src="/garcom/hotfix-sync.js"></script></body>');
  if (!html.includes('/garcom/waiter-attribution.js')) html = html.replace('</body>', '<script src="/garcom/waiter-attribution.js"></script></body>');
  if (!html.includes('/garcom/garcom-service-fee.js')) html = html.replace('</body>', '<script src="/garcom/garcom-service-fee.js?v=19"></script></body>');
  if (!html.includes('/garcom/waiter-speed.js')) html = html.replace('</body>', '<script src="/garcom/waiter-speed.js"></script></body>');
  if (!html.includes('/garcom/mesa-concurrency.js')) html = html.replace('</body>', '<script src="/garcom/mesa-concurrency.js?v=36"></script></body>');
  if (!html.includes('/item-cancellation-v2.js')) html = html.replace('</body>', '<script src="/item-cancellation-v2.js?v=2"></script></body>');
  if (!html.includes('/staged-checkout-v1.js')) html = html.replace('</body>', '<script src="/staged-checkout-v1.js?v=1"></script></body>');
  if (!html.includes('/garcom/restricoes-operacionais.js')) html = html.replace('</body>', '<script src="/garcom/restricoes-operacionais.js?v=3"></script></body>');
  if (!html.includes('/menu-order-options.js')) html = html.replace('</body>', '<script src="/menu-order-options.js?v=1"></script></body>');
  if (!html.includes('/menu-salad-half.js')) html = html.replace('</body>', '<script src="/menu-salad-half.js?v=2"></script></body>');
  if (!html.includes('/menu-20260828.js')) html = html.replace('</body>', '<script src="/menu-20260828.js?v=1"></script></body>');
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
      if (url.origin !== self.location.origin || !url.pathname.startsWith('/garcom/')) return null;
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