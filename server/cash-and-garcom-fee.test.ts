import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("zeragem do caixa e taxa do garcom", () => {
  it("zera o caixa por marco sem apagar vendas do Firebase", () => {
    const js = read("client/public/pdv/cash-reset.js");
    expect(js).toContain("joao_caicara_caixa_zerado_em");
    expect(js).toContain("As vendas continuarão guardadas no Firebase");
    expect(js).not.toContain("ref('vendas').remove");
    expect(js).toContain("acao:'zerar_caixa'");
    const sw = read("client/public/pdv/service-worker.js");
    expect(sw).toContain("/pdv/cash-reset.js?v=35");
  });

  it("oferece 10 por cento no fechamento do garcom e grava taxa na venda", () => {
    const js = read("client/public/garcom/garcom-service-fee.js");
    expect(js).toContain("Adicionar 10% de serviço");
    expect(js).toContain("const TAXA = 0.10");
    expect(js).toContain("payload.taxa = taxa");
    expect(js).toContain("payload.total = totalComTaxa");
    expect(js).toContain("payload.taxaServicoPercentual");
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("/garcom/garcom-service-fee.js?v=18");
  });
});
