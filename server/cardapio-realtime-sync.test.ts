import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("sincronizacao autenticada do cardapio", () => {
  it("Garcom mantem listener autenticado permanente e recuperável", () => {
    const modulo = read("client/public/garcom/cardapio-auth-reconnect.js");
    const sw = read("client/public/garcom/service-worker.js");
    expect(modulo).toContain("refCardapio.on('value'");
    expect(modulo).toContain("auth.onAuthStateChanged(user => void conectar(user))");
    expect(modulo).toContain("garcom@acesso.joaocaicara.app");
    expect(modulo).toContain("agendarRetry();");
    expect(sw).toContain("cardapio-auth-reconnect.js?v=21");
  });

  it("PDV mantem listener autenticado permanente", () => {
    const modulo = read("client/public/pdv/cardapio-auth-reconnect.js");
    const sw = read("client/public/pdv/service-worker.js");
    expect(modulo).toContain("refCardapio.on('value'");
    expect(modulo).toContain("auth.onAuthStateChanged(conectar)");
    expect(modulo).toContain("adm@acesso.joaocaicara.app");
    expect(sw).toContain("cardapio-auth-reconnect.js?v=1");
  });

  it("regras permitem leitura aos dois perfis e escrita apenas ao PDV", () => {
    const rules = JSON.parse(read("database.rules.json"));
    const readRule = String(rules.rules.cardapio?.[".read"] || "");
    const writeRule = String(rules.rules.cardapio?.[".write"] || "");
    expect(readRule).toContain("adm@acesso.joaocaicara.app");
    expect(readRule).toContain("garcom@acesso.joaocaicara.app");
    expect(writeRule).toContain("adm@acesso.joaocaicara.app");
    expect(writeRule).not.toContain("garcom@acesso.joaocaicara.app");
  });
});
