import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("cardapio autenticado do garcom", () => {
  it("mantem o cardapio sincronizado somente para a conta compartilhada real", () => {
    const reconnect = read("client/public/garcom/cardapio-auth-reconnect.js");
    expect(reconnect).toContain("garcom@acesso.joaocaicara.app");
    expect(reconnect).toContain("!user.isAnonymous");
    expect(reconnect).toContain("refCardapio.on('value'");
    expect(reconnect).toContain("auth.onAuthStateChanged(user => void conectar(user))");
    expect(reconnect).toContain("renderizarTabsG");
    expect(reconnect).toContain("renderizarProdutosG");
  });

  it("usa diretamente o Firebase principal e recupera listener que falhar no primeiro acesso", () => {
    const reconnect = read("client/public/garcom/cardapio-auth-reconnect.js");
    expect(reconnect).toContain("window.firebase?.database?.()");
    expect(reconnect).toContain("window.firebase?.auth?.()");
    expect(reconnect).toContain("user.getIdToken()");
    expect(reconnect).toContain("limparListener();");
    expect(reconnect).toContain("agendarRetry();");
    expect(reconnect).toContain("RETRY_MAX_MS = 8000");
    expect(reconnect).toContain("Carregando cardápio...");
    expect(reconnect).toContain("Reconectando cardápio...");
    expect(reconnect).toContain("window.addEventListener('online'");
  });

  it("service worker carrega a reconexao autenticada junto do login compartilhado e remove a v20", () => {
    const sw = read("client/public/garcom/service-worker.js");
    const login = sw.indexOf("/garcom/shared-login.js?v=19");
    const reconnect = sw.indexOf("/garcom/cardapio-auth-reconnect.js?v=21");
    const diagnostics = sw.indexOf("/garcom/access-diagnostics.js");
    expect(login).toBeGreaterThanOrEqual(0);
    expect(reconnect).toBeGreaterThanOrEqual(0);
    expect(diagnostics).toBeGreaterThan(reconnect);
    expect(sw).toContain("replaceAll('<script src=\"/garcom/cardapio-auth-reconnect.js?v=20\"></script>', '')");
  });

  it("garcom pode ler cardapio mas somente admin pode editar", () => {
    const rules = JSON.parse(read("database.rules.json"));
    const cardapio = rules.rules.cardapio;
    expect(String(cardapio[".read"])).toContain("garcom@acesso.joaocaicara.app");
    expect(String(cardapio[".write"])).toContain("adm@acesso.joaocaicara.app");
    expect(String(cardapio[".write"])).not.toContain("garcom@acesso.joaocaicara.app");
  });
});
