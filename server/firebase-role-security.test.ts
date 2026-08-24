import { describe, expect, it } from "vitest";
import fs from "node:fs";

const rules = JSON.parse(fs.readFileSync("database.rules.json", "utf8")).rules;
const ADMIN = "adm@acesso.joaocaicara.app";
const GARCOM = "garcom@acesso.joaocaicara.app";

describe("seguranca por conta autenticada no Realtime Database", () => {
  it("mesas e producao aceitam somente as contas operacionais conhecidas", () => {
    const mesasRead = String(rules.mesas?.[".read"] || "");
    const mesasWrite = String(rules.mesas?.$mesaId?.[".write"] || "");
    const producaoRead = String(rules.pedidosProducao?.[".read"] || "");
    const producaoWrite = String(rules.pedidosProducao?.$pedidoId?.[".write"] || "");
    for (const regra of [mesasRead, mesasWrite, producaoRead, producaoWrite]) {
      expect(regra).toContain("auth.token.email");
      expect(regra).toContain(ADMIN);
      expect(regra).toContain(GARCOM);
    }
  });

  it("somente administrador altera cardapio e opera fechamento de caixa", () => {
    const cardapioWrite = String(rules.cardapio?.[".write"] || "");
    const fechamentoRead = String(rules.fechamentosCaixa?.[".read"] || "");
    const fechamentoWrite = String(rules.fechamentosCaixa?.$fechamentoId?.[".write"] || "");
    for (const regra of [cardapioWrite, fechamentoRead, fechamentoWrite]) {
      expect(regra).toContain(ADMIN);
      expect(regra).not.toContain(GARCOM);
    }
  });

  it("garcom pode criar venda mas nao editar uma venda existente", () => {
    const vendasRead = String(rules.vendas?.[".read"] || "");
    const vendasWrite = String(rules.vendas?.$vendaId?.[".write"] || "");
    expect(vendasRead).toContain(ADMIN);
    expect(vendasRead).not.toContain(GARCOM);
    expect(vendasWrite).toContain(ADMIN);
    expect(vendasWrite).toContain(GARCOM);
    expect(vendasWrite).toContain("!data.exists()");
    expect(vendasWrite).toContain("newData.exists()");
  });

  it("auditoria pode ser registrada pelo garcom mas consultada somente pelo administrador", () => {
    const auditoriaRead = String(rules.auditoria?.[".read"] || "");
    const auditoriaWrite = String(rules.auditoria?.$registroId?.[".write"] || "");
    expect(auditoriaRead).toContain(ADMIN);
    expect(auditoriaRead).not.toContain(GARCOM);
    expect(auditoriaWrite).toContain(ADMIN);
    expect(auditoriaWrite).toContain(GARCOM);
    expect(auditoriaWrite).toContain("!data.exists()");
  });

  it("nenhuma conta do cliente escreve perfis de acesso ou configuracoes", () => {
    expect(rules.perfisAcesso?.$uid?.[".write"]).toBe(false);
    expect(rules.configuracoes?.[".read"]).toBe(false);
    expect(rules.configuracoes?.[".write"]).toBe(false);
  });
});
