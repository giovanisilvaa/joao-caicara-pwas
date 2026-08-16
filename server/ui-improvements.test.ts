import { describe, expect, it } from "vitest";
import fs from "node:fs";

const readPwa = (name: string) => fs.readFileSync(`client/public/${name}/index.html`, "utf8");

describe("melhorias operacionais dos PWAs", () => {
  it("mantém no garçom a legenda, o usuário e o envio com estado visual", () => {
    const html = readPwa("garcom");
    expect(html).toContain("legenda-mesas-g");
    expect(html).toContain("usuario-logado-g");
    expect(html).toContain("btn-enviar-g");
    expect(html).toContain("atualizarStatusConexaoG");
  });

  it("mantém no PDV os filtros de produção e a identificação do operador", () => {
    const html = readPwa("pdv");
    expect(html).toContain("usuario-logado-pdv");
    expect(html).toContain("filtro-producao-setor");
    expect(html).toContain("filtro-producao-status");
    expect(html).toContain("alterarFiltroProducao");
    expect(html).not.toContain('onclick="toggleProducao()">📦 Produção');
  });
});
