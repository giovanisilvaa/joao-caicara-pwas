import { describe, expect, it } from "vitest";
import fs from "node:fs";
import vm from "node:vm";

const readPwa = (name: string) => fs.readFileSync(`client/public/${name}/index.html`, "utf8");
const readServer = () => fs.readFileSync("server/_core/index.ts", "utf8");

describe("melhorias operacionais dos PWAs", () => {
  it("mantém no garçom a legenda, o usuário e o envio com estado visual", () => {
    const html = readPwa("garcom");
    expect(html).toContain("legenda-mesas-g");
    expect(html).toContain("usuario-logado-g");
    expect(html).toContain("btn-enviar-g");
    expect(html).toContain("atualizarStatusConexaoG");
  });

  it("mostra estados detalhados de conexão nos dois PWAs", () => {
    const garcom = readPwa("garcom");
    const pdv = readPwa("pdv");
    expect(garcom).toContain("sem internet");
    expect(garcom).toContain("firebaseConectadoG");
    expect(pdv).toContain("status-conexao-pdv");
    expect(pdv).toContain("firebaseConectadoPdv");
  });

  it("expõe um health check para monitoramento externo", () => {
    expect(readServer()).toContain("app.get('/api/health'");
    expect(readServer()).toContain("service: 'joao-caicara-pwas'");
    expect(readServer()).not.toContain('monitorWhatsApp');
    expect(readServer()).not.toContain('TWILIO');
  });

  it("mantém o timestamp numérico nos fechamentos do garçom", () => {
    const html = readPwa("garcom");
    expect(html).toContain("criadoEm: Date.now()");
  });

  it("reenvia uma pendência de fechamento com o payload completo", async () => {
    const html = readPwa("garcom");
    const inicio = html.indexOf("    function atualizarStatusConexaoG");
    const fim = html.indexOf("    firebase.auth().onAuthStateChanged", inicio);
    const funcoes = html.slice(inicio, fim);
    const armazenamento = new Map<string, string>();
    const escritas: Array<{ caminho: string; payload: unknown }> = [];
    const contexto = {
      localStorage: {
        getItem: (chave: string) => armazenamento.get(chave) ?? null,
        setItem: (chave: string, valor: string) => armazenamento.set(chave, valor),
      },
      navigator: { onLine: true },
      document: { getElementById: () => ({ innerText: "", classList: { remove() {}, add() {} } }) },
      db: { ref: (caminho: string) => ({ set: async (payload: unknown) => { escritas.push({ caminho, payload }); } }) },
      alert: () => {},
      console,
    };
    armazenamento.set("garcom_pendencias_firebase", JSON.stringify([{
      tipo: "fechamento",
      mesa: 7,
      vendaChave: "venda-fixa-7",
      venda: { id: "garcom-venda-7", mesa: 7, total: 42.5, itens: [{ nome: "Peixe", qtd: 1, preco: 42.5 }] },
      mesaFechada: { itens: [], cliente: "", abertura: null },
    }]));
    await vm.runInNewContext(`(async () => { ${funcoes}; firebaseConectadoG = true; await reprocessarPendenciasG(); })()`, contexto);
    expect(escritas.map(item => item.caminho)).toEqual(["vendas/venda-fixa-7", "mesas/7"]);
    expect(escritas[0].payload).toMatchObject({ id: "garcom-venda-7", total: 42.5 });
    expect(armazenamento.get("garcom_pendencias_firebase")).toBe("[]");
  });

  it("reenvia uma pendência de produção com a mesa completa", async () => {
    const html = readPwa("garcom");
    const inicio = html.indexOf("    function atualizarStatusConexaoG");
    const fim = html.indexOf("    firebase.auth().onAuthStateChanged", inicio);
    const funcoes = html.slice(inicio, fim);
    const armazenamento = new Map<string, string>();
    const escritas: Array<{ caminho: string; payload: any }> = [];
    const mesaCompleta = { cliente: "Mesa teste", abertura: 123, itens: [{ envioId: "envio-fixo", enviado: false, nome: "Peixe", qtd: 1, preco: 42.5 }] };
    const contexto = {
      localStorage: {
        getItem: (chave: string) => armazenamento.get(chave) ?? null,
        setItem: (chave: string, valor: string) => armazenamento.set(chave, valor),
      },
      navigator: { onLine: true },
      document: { getElementById: () => ({ innerText: "", classList: { remove() {}, add() {} } }) },
      db: { ref: (caminho: string) => ({
        set: async (payload: unknown) => { escritas.push({ caminho, payload }); },
      }) },
      alert: () => {},
      console,
    };
    armazenamento.set("garcom_pendencias_firebase", JSON.stringify([{
      tipo: "producao",
      mesa: 4,
      envioId: "envio-fixo",
      pedidos: [{ chave: "pedido-fixo", mesa: 4, setor: "cozinha", status: "recebido", itens: [{ envioId: "envio-fixo", nome: "Peixe", qtd: 1, preco: 42.5 }] }],
      mesaCompleta,
    }]));
    await vm.runInNewContext(`(async () => { ${funcoes}; firebaseConectadoG = true; await reprocessarPendenciasG(); })()`, contexto);
    expect(escritas.map(item => item.caminho)).toEqual(["pedidosProducao/pedido-fixo", "mesas/4"]);
    expect(escritas[1].payload.itens[0]).toMatchObject({ envioId: "envio-fixo", enviado: true, nome: "Peixe" });
    expect(armazenamento.get("garcom_pendencias_firebase")).toBe("[]");
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

  it("mantém backup, fechamento de caixa e auditoria consultável no PDV", () => {
    const html = readPwa("pdv");
    expect(html).toContain("abrirModalBackup");
    expect(html).toContain("exportarBackupFirebase");
    expect(html).toContain("restaurarBackupFirebase");
    expect(html).toContain("registrarFechamentoCaixa");
    expect(html).toContain("abrirModalAuditoria");
    expect(html).toContain("renderizarAuditoria");
    expect(html).toContain("fechamentosCaixa");
    expect(html).toContain("CAMINHOS_BACKUP_PDV");
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
