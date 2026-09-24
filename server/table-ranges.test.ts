import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("faixas de mesas do Salão e Deck/Praia", () => {
  const garcom = read("client/public/garcom/index.html");
  const garcomSync = read("client/public/garcom/hotfix-sync.js");
  const pdv = read("client/public/pdv/index.html");
  const pdvSync = read("client/public/pdv/pdv-sync.js");
  const operations = read("client/public/pdv/pdv-operations.js");
  const itemTransfer = read("client/public/pdv/pdv-item-transfer.js");
  const mesaWrite = String(JSON.parse(read("database.rules.json")).rules.mesas.$mesaId[".write"]);

  it("exibe exatamente 100 mesas únicas nos dois sistemas", () => {
    expect(garcom).toContain("for (let i = 1; i <= 49; i++)");
    expect(garcom).toContain("for (let i = 50; i <= 100; i++)");
    expect(garcomSync).toContain("for (let i = 1; i <= 49; i++)");
    expect(garcomSync).toContain("for (let i = 50; i <= 100; i++)");
    expect(pdv).toContain("for(let i = 1; i <= 49; i++)");
    expect(pdv).toContain("for(let i = 50; i <= 100; i++)");
    expect(pdvSync).toContain("renderFaixa('grid-salao', 1, 49)");
    expect(pdvSync).toContain("renderFaixa('grid-deck', 50, 100)");
  });

  it("identifica as áreas corretamente no PDV", () => {
    expect(pdv).toContain("Salão (1 - 49)");
    expect(pdv).toContain("Deck / Praia (50 - 100)");
  });

  it("aceita transferências somente entre mesas de 1 a 100", () => {
    expect(operations).toContain("(destino >= 1 && destino <= 49) || (destino >= 50 && destino <= 100)");
    expect(itemTransfer).toContain("(numero >= 1 && numero <= 49) || (numero >= 50 && numero <= 100)");
    expect(operations).toContain("número de 1 a 49 ou 50 a 100");
  });

  it("permite gravação nas 100 mesas e bloqueia números fora da faixa", () => {
    const regex = mesaWrite.match(/\$mesaId\.matches\(\/(.+)\/\)/)?.[1];
    expect(regex).toBeTruthy();
    const numerosPermitidos = new RegExp(regex!);
    for (let numero = 1; numero <= 100; numero++) {
      expect(numerosPermitidos.test(String(numero)), `mesa ${numero}`).toBe(true);
    }
    for (const numero of [0, 101, 150, -1, "01", "1a"]) {
      expect(numerosPermitidos.test(String(numero)), `mesa ${numero}`).toBe(false);
    }
  });

  it("força a atualização dos caches dos dois PWAs", () => {
    expect(read("client/public/pdv/service-worker.js")).toContain("tables-v53");
    expect(read("client/public/garcom/service-worker.js")).toContain("tables-v39");
  });
});
