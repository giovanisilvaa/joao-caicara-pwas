import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("cardapio autenticado do garcom", () => {
  it("recarrega o cardapio somente para a conta compartilhada real", () => {
    const reconnect = read("client/public/garcom/cardapio-auth-reconnect.js");
    expect(reconnect).toContain("garcom@acesso.joaocaicara.app");
    expect(reconnect).toContain("!user.isAnonymous");
    expect(reconnect).toContain("db.ref('cardapio').once('value')");
    expect(reconnect).toContain("renderizarTabsG");
    expect(reconnect).toContain("filtrarCardapioG('favoritos')");
  });

  it("service worker carrega a reconexao logo apos o login compartilhado", () => {
    const sw = read("client/public/garcom/service-worker.js");
    const login = sw.indexOf("/garcom/shared-login.js?v=17");
    const reconnect = sw.indexOf("/garcom/cardapio-auth-reconnect.js?v=19");
    const diagnostics = sw.indexOf("/garcom/access-diagnostics.js");
    expect(login).toBeGreaterThanOrEqual(0);
    expect(reconnect).toBeGreaterThan(login);
    expect(diagnostics).toBeGreaterThan(reconnect);
  });

  it("garcom pode ler cardapio mas somente admin pode editar", () => {
    const rules = JSON.parse(read("database.rules.json"));
    const cardapio = rules.rules.cardapio;
    expect(String(cardapio[".read"])).toContain("garcom@acesso.joaocaicara.app");
    expect(String(cardapio[".write"])).toContain("adm@acesso.joaocaicara.app");
    expect(String(cardapio[".write"])).not.toContain("garcom@acesso.joaocaicara.app");
  });
});
