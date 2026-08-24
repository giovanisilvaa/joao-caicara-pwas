import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("regressoes criticas Firebase e PWAs", () => {
  it("permite limpar uma mesa autenticada no Realtime Database", () => {
    const rules = JSON.parse(read("database.rules.json"));
    const mesasWrite = String(rules.rules.mesas?.$mesaId?.[".write"] ?? rules.rules.mesas?.[".write"] ?? "");
    expect(mesasWrite).toContain("auth != null");
    expect(mesasWrite).not.toContain("newData.exists()");
  });

  it("permite rollback de pedido parcial de producao", () => {
    const rules = JSON.parse(read("database.rules.json"));
    const pedidoWrite = String(rules.rules.pedidosProducao?.$pedidoId?.[".write"] ?? "");
    expect(pedidoWrite).toContain("auth != null");
    expect(pedidoWrite).not.toContain("newData.exists()");
  });

  it("mantem configuracoes bloqueadas para clientes", () => {
    const rules = JSON.parse(read("database.rules.json"));
    expect(rules.rules.configuracoes?.[".read"]).toBe(false);
    expect(rules.rules.configuracoes?.[".write"]).toBe(false);
  });

  it("camada consolidada protege limpeza e backup", () => {
    const safety = read("client/public/pdv/pdv-safety.js");
    expect(safety).toContain("window.confirmarLimpezaMesa");
    expect(safety).toContain(".remove()");
    expect(safety).toContain("CAMINHOS_BACKUP_SEGUROS");
    expect(safety).toContain("mesas");
    expect(safety).toContain("vendas");
    expect(safety).toContain("pedidosProducao");
    const lista = safety.match(/const CAMINHOS_BACKUP_SEGUROS = \[([^\]]+)\]/)?.[1] ?? "";
    expect(lista).not.toContain("configuracoes");
  });

  it("hotfix principal nao volta a sobrescrever modulos consolidados", () => {
    const hotfix = read("client/public/pdv/hotfix-sync.js");
    expect(hotfix).not.toContain("window.confirmarLimpezaMesa");
    expect(hotfix).not.toContain("window.transferirMesa");
    expect(hotfix).not.toContain("window.imprimirCaixa");
    expect(hotfix).not.toContain("window.imprimirProducao");
  });

  it("operacoes do PDV preservam transferencia atomica entre mesas", () => {
    const operations = read("client/public/pdv/pdv-operations.js");
    expect(operations).toContain("window.transferirMesa");
    expect(operations).toContain("db.ref('/').update");
    expect(operations).toContain("mesas/${origem}");
    expect(operations).toContain("mesas/${destino}");
    expect(operations).toContain("registrarAuditoriaPdv('transferir_mesa'");
  });

  it("fechamento do PDV registra venda e libera mesa na mesma atualizacao", () => {
    const checkout = read("client/public/pdv/pdv-checkout-core.js");
    expect(checkout).toContain("window.imprimirCaixa");
    expect(checkout).toContain("db.ref('/').update");
    expect(checkout).toContain("vendas/${vendaRef.key}");
    expect(checkout).toContain("mesas/${mesaId}");
    expect(checkout).toContain("O pagamento informado ainda é insuficiente");
    expect(checkout).toContain("registrarAuditoriaPdv('fechar_conta'");
  });

  it("producao imprime apenas itens validos e confirma sincronizacao", () => {
    const production = read("client/public/pdv/pdv-production.js");
    expect(production).toContain("window.imprimirProducao");
    expect(production).toContain("item.enviado === false && item.rascunho !== true");
    expect(production).toContain("item.enviado === true");
    expect(production).toContain("db.ref(`mesas/${numeroMesa}`).set(dadosMesa)");
    expect(production).toContain("db.ref('pedidosProducao').push");
  });

  it("PDV carrega camadas consolidadas depois do hotfix principal", () => {
    const sw = read("client/public/pdv/service-worker.js");
    const hotfix = sw.indexOf("/pdv/hotfix-sync.js");
    const safety = sw.indexOf("/pdv/pdv-safety.js");
    const operations = sw.indexOf("/pdv/pdv-operations.js");
    const checkout = sw.indexOf("/pdv/pdv-checkout-core.js");
    const production = sw.indexOf("/pdv/pdv-production.js");
    const fastCheckout = sw.indexOf("/pdv/fast-checkout.js");
    expect(hotfix).toBeGreaterThanOrEqual(0);
    expect(safety).toBeGreaterThan(hotfix);
    expect(operations).toBeGreaterThan(hotfix);
    expect(checkout).toBeGreaterThan(hotfix);
    expect(production).toBeGreaterThan(hotfix);
    expect(fastCheckout).toBeGreaterThan(checkout);
    expect(sw).toContain("joao-caicara-pdv-v17");
    expect(sw).not.toContain("/pdv/mesa-delete-fix.js");
    expect(sw).not.toContain("/pdv/backup-safety.js");
  });

  it("deploy inclui Hosting e regras do Realtime Database em etapas separadas", () => {
    const workflow = read(".github/workflows/firebase-hosting-deploy.yml");
    expect(workflow).toContain("Deploy to Firebase Hosting");
    expect(workflow).toContain("--only hosting");
    expect(workflow).toContain("Deploy Realtime Database rules");
    expect(workflow).toContain("--only database");
  });
});
