import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("concorrencia atomica de mesas", () => {
  it("usa transaction, ids de item e locks no nucleo compartilhado", () => {
    const core = read("client/public/mesa-atomic.js");
    expect(core).toContain(".transaction(current =>");
    expect(core).toContain("itemOperacaoId");
    expect(core).toContain("bloqueioOperacional");
    expect(core).toContain("reservarEnvio");
    expect(core).toContain("bloquearMesa");
    expect(core).toContain("cancelarBloqueio");
  });

  it("garcom altera comanda, envia producao e fecha conta pela camada atomica", () => {
    const garcom = read("client/public/garcom/mesa-concurrency.js");
    expect(garcom).toContain("adicionarItemGAtomico");
    expect(garcom).toContain("alterarQtdGAtomico");
    expect(garcom).toContain("reservarEnvio");
    expect(garcom).toContain("db.ref('/').update(atualizacoes)");
    expect(garcom).toContain("confirmarFechamentoGAtomico");
    expect(garcom).toContain("bloquearMesa(numero, { tipo: 'fechamento'");
    expect(garcom).toContain("[`mesas/${numero}`]: atomic().mesaVazia()");
  });

  it("observacao rapida nao volta a salvar a mesa inteira quando a camada atomica existe", () => {
    const speed = read("client/public/garcom/waiter-speed.js");
    expect(speed).toContain("GarcomConcorrencia?.salvarObservacao");
    expect(speed).toContain("await window.GarcomConcorrencia.salvarObservacao");
  });

  it("pdv edita itens por transacao e producao nao faz set da mesa inteira", () => {
    const pdv = read("client/public/pdv/mesa-concurrency.js");
    const producao = read("client/public/pdv/pdv-production.js");
    expect(pdv).toContain("adicionarProdutoAtomico");
    expect(pdv).toContain("alterarQtdItemAtomico");
    expect(pdv).toContain("atomic().atualizarItem");
    expect(producao).toContain("MesaAtomic.reservarEnvio");
    expect(producao).toContain("db.ref('/').update(atualizacoes)");
    expect(producao).not.toContain(".set(dadosMesa)");
  });

  it("fechamento e transferencia do pdv usam locks antes do update final", () => {
    const checkout = read("client/public/pdv/pdv-checkout-core.js");
    const operations = read("client/public/pdv/pdv-operations.js");
    expect(checkout).toContain("MesaAtomic.bloquearMesa(mesaId");
    expect(checkout).toContain("[`mesas/${mesaId}`]: window.MesaAtomic.mesaVazia()");
    expect(operations).toContain("MesaAtomic.bloquearMesa(origem");
    expect(operations).toContain("MesaAtomic.bloquearMesa(destino");
    expect(operations).toContain("db.ref('/').update");
  });

  it("service workers carregam o nucleo antes e a camada de concorrencia por ultimo", () => {
    const pdvSw = read("client/public/pdv/service-worker.js");
    const garcomSw = read("client/public/garcom/service-worker.js");

    expect(pdvSw.indexOf("/mesa-atomic.js?v=36")).toBeGreaterThanOrEqual(0);
    expect(pdvSw.indexOf("/mesa-atomic.js?v=36")).toBeLessThan(pdvSw.indexOf("/pdv/pdv-checkout-core.js"));
    expect(pdvSw.indexOf("/pdv/mesa-concurrency.js?v=36")).toBeGreaterThan(pdvSw.indexOf("/pdv/pdv-production.js"));

    expect(garcomSw.indexOf("/mesa-atomic.js?v=36")).toBeGreaterThanOrEqual(0);
    expect(garcomSw.indexOf("/mesa-atomic.js?v=36")).toBeLessThan(garcomSw.indexOf("/garcom/hotfix-sync.js"));
    expect(garcomSw.indexOf("/garcom/mesa-concurrency.js?v=36")).toBeGreaterThan(garcomSw.indexOf("/garcom/waiter-speed.js"));
  });
});
