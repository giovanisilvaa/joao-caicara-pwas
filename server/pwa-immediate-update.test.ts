import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('atualizacao imediata dos PWAs', () => {
  it('forca o registro do service worker sem usar cache HTTP', () => {
    const updater = read('client/public/pwa-live-update.js');
    expect(updater).toContain("updateViaCache: 'none'");
    expect(updater).toContain('await registro.update()');
    expect(updater).toContain("location.pathname.startsWith('/pdv/')");
    expect(updater).toContain("location.pathname.startsWith('/garcom/')");
  });

  it('verifica atualizacao ao abrir, voltar ao app, recuperar rede e enquanto permanece aberto', () => {
    const updater = read('client/public/pwa-live-update.js');
    expect(updater).toContain("window.addEventListener('load', verificarAtualizacao");
    expect(updater).toContain("window.addEventListener('online', verificarAtualizacao)");
    expect(updater).toContain("window.addEventListener('focus', verificarAtualizacao)");
    expect(updater).toContain("document.addEventListener('visibilitychange'");
    expect(updater).toContain('setInterval');
    expect(updater).toContain('60000');
    expect(updater).toContain('void verificarAtualizacao()');
  });

  it('injeta a camada de atualizacao tanto no PDV quanto no Garcom', () => {
    const pdv = read('client/public/pdv/service-worker.js');
    const garcom = read('client/public/garcom/service-worker.js');
    for (const sw of [pdv, garcom]) {
      expect(sw).toContain("const LIVE_UPDATE_ASSET = '/pwa-live-update.js?v=1'");
      expect(sw).toContain("if (!html.includes('/pwa-live-update.js'))");
      expect(sw).toContain('LIVE_UPDATE_ASSET');
      expect(sw).toContain('self.skipWaiting()');
      expect(sw).toContain('self.clients.claim()');
      expect(sw).toContain('client.navigate(client.url)');
      expect(sw).toContain("fetch(request, { cache: 'no-store' })");
    }
  });

  it('Firebase Hosting nao permite cache do service worker, updater e entradas principais', () => {
    const firebase = JSON.parse(read('firebase.json'));
    const headers = firebase.hosting?.headers || [];
    const porFonte = new Map(headers.map((item: any) => [item.source, item.headers || []]));
    const fontes = [
      '/pdv/service-worker.js',
      '/garcom/service-worker.js',
      '/pwa-live-update.js',
      '/pdv/',
      '/garcom/',
      '/pdv/index.html',
      '/garcom/index.html'
    ];
    for (const fonte of fontes) {
      const regras = porFonte.get(fonte) as any[] | undefined;
      expect(regras).toBeTruthy();
      const cache = regras?.find(item => String(item.key).toLowerCase() === 'cache-control');
      expect(cache?.value).toContain('no-store');
      expect(cache?.value).toContain('no-cache');
      expect(cache?.value).toContain('max-age=0');
    }
  });
});
