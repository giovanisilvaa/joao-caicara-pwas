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

  it("backup seguro nao inclui configuracoes protegidas", () => {
    const backupFix = read("client/public/pdv/backup-fix.js");
    expect(backupFix).toContain("mesas");
    expect(backupFix).toContain("vendas");
    expect(backupFix).toContain("pedidosProducao");
    expect(backupFix).not.toMatch(/CAMINHOS[^\n]*configuracoes/);
  });

  it("PDV carrega a correcao de limpeza depois do hotfix principal", () => {
    const sw = read("client/public/pdv/service-worker.js");
    const hotfix = sw.indexOf("/pdv/hotfix-sync.js");
    const deleteFix = sw.indexOf("/pdv/mesa-delete-fix.js");
    expect(hotfix).toBeGreaterThanOrEqual(0);
    expect(deleteFix).toBeGreaterThan(hotfix);
  });

  it("deploy inclui Hosting e regras do Realtime Database em etapas separadas", () => {
    const workflow = read(".github/workflows/firebase-hosting-deploy.yml");
    expect(workflow).toContain("Deploy to Firebase Hosting");
    expect(workflow).toContain("--only hosting");
    expect(workflow).toContain("Deploy Realtime Database rules");
    expect(workflow).toContain("--only database");
  });
});
