from pathlib import Path
import json

root = Path('/home/ubuntu/joao-caicara-pwas/client/public')
mark = '/manus-storage/joao-caicara-mark_eadc19d3.png'

apps = {
    'garcom': {
        'name': 'João Caiçara — Garçom',
        'short_name': 'Garçom',
        'description': 'Abertura e gerenciamento de comandas no salão.',
        'background': '/manus-storage/joao-caicara-garcom-bg_46b937d2.jpg',
        'theme': '#0F4C5C',
    },
    'pdv': {
        'name': 'João Caiçara — PDV',
        'short_name': 'PDV',
        'description': 'Operação de caixa, produção e fechamento de contas.',
        'background': '/manus-storage/joao-caicara-pdv-bg_e9179969.jpg',
        'theme': '#0F4C5C',
    },
}

for slug, app in apps.items():
    folder = root / slug
    html = (folder / 'index.html').read_text(encoding='utf-8')
    manifest = {
        'name': app['name'],
        'short_name': app['short_name'],
        'description': app['description'],
        'start_url': f'/{slug}/',
        'scope': f'/{slug}/',
        'display': 'standalone',
        'orientation': 'any',
        'background_color': '#F7F4EC',
        'theme_color': app['theme'],
        'icons': [
            {'src': mark, 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}
        ],
    }
    (folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    sw = f"""const CACHE_NAME = 'joao-caicara-{slug}-v1';
const APP_SHELL = ['/{slug}/', '/{slug}/manifest.json', '{mark}'];
self.addEventListener('install', event => {{
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', event => {{
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
}});
self.addEventListener('fetch', event => {{
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {{
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    return response;
  }}).catch(() => caches.match(request).then(cached => cached || caches.match('/{slug}/'))));
}});
"""
    (folder / 'service-worker.js').write_text(sw, encoding='utf-8')
    additions = f'''\n<link rel="manifest" href="/{slug}/manifest.json">\n<meta name="theme-color" content="{app['theme']}">\n<link rel="apple-touch-icon" href="{mark}">\n<style>body{{background-image:linear-gradient(rgba(247,244,236,.9),rgba(247,244,236,.9)),url("{app['background']}");background-size:cover;background-attachment:fixed;}}</style>\n'''
    if f'/{slug}/manifest.json' not in html:
        html = html.replace('</head>', additions + '</head>', 1)
    registration = f'''\n<script>if ('serviceWorker' in navigator) {{ window.addEventListener('load', () => navigator.serviceWorker.register('/{slug}/service-worker.js', {{scope: '/{slug}/'}})); }}</script>\n'''
    if f'/{slug}/service-worker.js' not in html:
        html = html.replace('</body>', registration + '</body>', 1)
    (folder / 'index.html').write_text(html, encoding='utf-8')

landing = '''<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0F4C5C"><title>João Caiçara — Sistemas</title><style>body{margin:0;min-height:100vh;background:#F7F4EC;color:#133C4A;font-family:Segoe UI,Arial,sans-serif;display:grid;place-items:center}.box{max-width:560px;padding:32px}.mark{width:72px}.eyebrow{color:#D95D39;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:.75rem}h1{font:700 2.5rem Georgia,serif;margin:.4rem 0 1rem}.links{display:grid;gap:12px;margin-top:28px}a{display:block;padding:18px 20px;background:#0F4C5C;color:white;text-decoration:none;border-radius:12px;font-weight:700}a span{display:block;color:#d7e8e8;font-size:.85rem;font-weight:400;margin-top:4px}</style></head><body><main class="box"><img class="mark" src="/manus-storage/joao-caicara-mark_eadc19d3.png" alt="João Caiçara"><div class="eyebrow">João Caiçara Tradição</div><h1>Sistemas de operação</h1><p>Escolha o acesso correto para instalar o sistema no celular ou abrir no computador.</p><div class="links"><a href="/garcom/index.html">Abrir sistema do garçom<span>Comandas e atendimento no salão</span></a><a href="/pdv/index.html">Abrir PDV<span>Caixa, produção e fechamento</span></a></div></main></body></html>'''
(root / 'index.html').write_text(landing, encoding='utf-8')
