import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("atualizacao do PWA do Garcom", () => {
  it("invalida o cache antigo ao publicar uma nova versao", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("const CACHE_NAME = 'joao-caicara-garcom-v15-fresh-20260826-live-v18-menu-v19-half-v20-cancel-v21-staged-v22-closefix-v23-restrict-v24-draft-v25-session-v26-checkout-v27-authfix-v28'");
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

  it("publica a versao 2 do meio prato por categoria", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("const SALAD_HALF_ASSET = '/menu-salad-half.js?v=2'");
    expect(sw).toContain('<script src="/menu-salad-half.js?v=2"></script>');
  });

  it("publica o cancelamento atomico depois da concorrencia da mesa", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("const ITEM_CANCELLATION_ASSET = '/item-cancellation-v2.js?v=2'");
    expect(sw).toContain('<script src="/item-cancellation-v2.js?v=2"></script>');
    expect(sw.indexOf('MESA_CONCURRENCY_ASSET')).toBeLessThan(sw.indexOf('ITEM_CANCELLATION_ASSET'));
  });

  it("carrega o fechamento em duas etapas depois do cancelamento e da concorrencia", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("const STAGED_CHECKOUT_ASSET = '/staged-checkout-v1.js?v=1'");
    expect(sw).toContain('<script src="/staged-checkout-v1.js?v=1"></script>');
    expect(sw.indexOf('ITEM_CANCELLATION_ASSET')).toBeLessThan(sw.indexOf('STAGED_CHECKOUT_ASSET'));
  });

  it("força a versão corrigida da taxa de serviço no fechamento", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("'/garcom/garcom-service-fee.js?v=19'");
    expect(sw).toContain('<script src="/garcom/garcom-service-fee.js?v=19"></script>');
  });

  it("carrega a versão 3 das restrições depois do fechamento em duas etapas", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("const GARCOM_RESTRICTIONS_ASSET = '/garcom/restricoes-operacionais.js?v=3'");
    expect(sw).toContain('<script src="/garcom/restricoes-operacionais.js?v=3"></script>');
    expect(sw.indexOf('STAGED_CHECKOUT_ASSET')).toBeLessThan(sw.indexOf('GARCOM_RESTRICTIONS_ASSET'));
  });
});
