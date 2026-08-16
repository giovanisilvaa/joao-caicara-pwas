import { describe, expect, it } from "vitest";
import fs from "node:fs";
import vm from "node:vm";

const readPwa = (name: string) => fs.readFileSync(`client/public/${name}/index.html`, "utf8");

describe("melhorias operacionais dos PWAs", () => {
  it("mantém no garçom a legenda, o usuário e o envio com estado visual", () => {
    const html = readPwa("garcom");
    expect(html).toContain("legenda-mesas-g");
    expect(html).toContain("usuario-logado-g");
    expect(html).toContain("btn-enviar-g");
    expect(html).toContain("atualizarStatusConexaoG");
  });

  it("mantém o timestamp numérico nos fechamentos do garçom", () => {
    const html = readPwa("garcom");
    expect(html).toContain("criadoEm: Date.now()");
  });

  it("renderiza produção sem o contador visual removido e atualiza o painel diário", () => {
    const html = readPwa("pdv");
    const inicio = html.indexOf("        function renderizarPainelProducao()");
    const fim = html.indexOf("        db.ref('pedidosProducao')", inicio);
    const funcao = html.slice(inicio, fim);
    const elementos = new Map([
      ["producao-resumo", { innerText: "" }],
      ["producao-lista", { innerHTML: "" }],
    ]);
    let painelAtualizado = false;
    const contexto = {
      producaoCache: { pedido1: { mesa: 4, setor: "cozinha", status: "recebido", criadoEm: Date.now(), itens: [{ qtd: 1, nome: "Peixe" }] } },
      producaoFiltroSetor: "todos",
      producaoFiltroStatus: "pendentes",
      document: { getElementById: (id: string) => elementos.get(id) ?? null },
      atualizarPainelDiario: () => { painelAtualizado = true; },
    };
    vm.runInNewContext(`${funcao}\nrenderizarPainelProducao();`, contexto);
    expect(painelAtualizado).toBe(true);
    expect(elementos.get("producao-resumo")?.innerText).toContain("1 pedido(s)");
  });

  it("mantém no PDV os filtros de produção e a identificação do operador", () => {
    const html = readPwa("pdv");
    expect(html).toContain("usuario-logado-pdv");
    expect(html).toContain("filtro-producao-setor");
    expect(html).toContain("filtro-producao-status");
    expect(html).toContain("alterarFiltroProducao");
    expect(html).not.toContain('onclick="toggleProducao()">📦 Produção');
    expect(html).toContain("painel-diario");
    expect(html).toContain("indicador-vendas");
    expect(html).toContain("indicador-mesas");
    expect(html).not.toContain("indicador-pedidos");
    expect(html).toContain("vendaEhDeHoje");
    expect(html).toContain("if (contadorProducao) contadorProducao.innerText = pendentes;");
  });
});
