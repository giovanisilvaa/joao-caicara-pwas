import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("atualizacao do PWA do Garcom", () => {
  it("invalida o cache antigo ao publicar uma nova versao", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("const CACHE_NAME = 'joao-caicara-garcom-v15-fresh-20260826-live-v18-menu-v19'");
  });

  it("recarrega clientes do Garcom quando o novo service worker assume", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("self.clients.claim()");
    expect(sw).toContain("self.clients.matchAll({ type: 'window', includeUncontrolled: true })");
    expect(sw).toContain("url.pathname.startsWith('/garcom/')");
    expect(sw).toContain("client.navigate(client.url)");
  });

  it("continua usando rede primeiro para evitar HTML desatualizado", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("fetch(request, { cache: 'no-store' })");
  });

  it("injeta o verificador ativo de atualizacoes", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("LIVE_UPDATE_ASSET");
    expect(sw).toContain("/pwa-live-update.js?v=1");
  });

  it("publica o complemento de categorias e estilo do cardapio", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("const MENU_UPDATE_ASSET = '/menu-20260828.js?v=1'");
    expect(sw).toContain('MENU_UPDATE_ASSET');
    expect(sw).toContain("if (!html.includes('/menu-20260828.js'))");
  });
});
