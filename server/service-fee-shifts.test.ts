import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("relatorio de taxa de servico por turno", () => {
  it("carrega o modulo depois do relatorio por garcom", () => {
    const sw = read("client/public/pdv/service-worker.js");
    const relatorio = sw.indexOf("/pdv/waiter-sales-report.js");
    const taxaTurnos = sw.indexOf("/pdv/service-fee-shifts.js");
    expect(relatorio).toBeGreaterThanOrEqual(0);
    expect(taxaTurnos).toBeGreaterThan(relatorio);
    expect(sw).toContain("service-fee-shifts.js?v=28");
  });

  it("usa fechamentos de caixa como limites e soma a taxa real das vendas", () => {
    const modulo = read("client/public/pdv/service-fee-shifts.js");
    expect(modulo).toContain("fechamentosCaixa");
    expect(modulo).toContain("fechadoEm");
    expect(modulo).toContain("Number(v?.taxa)");
    expect(modulo).toContain("totalTaxa");
    expect(modulo).toContain("TOTAL 10% DO DIA");
    expect(modulo).toContain("Turno ${turno.numero}${turno.aberto ? ' · atual' : ''}");
    expect(modulo).not.toContain("subtotal * 0.10");
  });

  it("mantem a taxa coletiva separada da venda individual por garcom", () => {
    const relatorio = read("client/public/pdv/waiter-sales-report.js");
    const turnos = read("client/public/pdv/service-fee-shifts.js");
    expect(relatorio).toContain("garcomLancamento");
    expect(turnos).toContain("Fundo coletivo para divisão entre os garçons");
    expect(turnos).toContain("taxa de serviço efetivamente cobrada");
  });
});
