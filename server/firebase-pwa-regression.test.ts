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

  it("perfis de acesso sao privados por uid e somente leitura no cliente", () => {
    const rules = JSON.parse(read("database.rules.json"));
    const perfil = rules.rules.perfisAcesso?.$uid;
    expect(String(perfil?.[".read"] ?? "")).toContain("auth.uid === $uid");
    expect(perfil?.[".write"]).toBe(false);
  });

  it("camada consolidada protege limpeza e backup", () => {
    const safety = read("client/public/pdv/pdv-safety.js");
    expect(safety).toContain("window.confirmarLimpezaMesa");
    expect(safety).toContain(".remove()");
    expect(safety).toContain("CAMINHOS_BACKUP_SEGUROS");
    const lista = safety.match(/const CAMINHOS_BACKUP_SEGUROS = \[([^\]]+)\]/)?.[1] ?? "";
    expect(lista).not.toContain("configuracoes");
  });

  it("sincronizacao do PDV grava somente a mesa selecionada", () => {
    const sync = read("client/public/pdv/pdv-sync.js");
    expect(sync).toContain("window.salvarMesas");
    expect(sync).toContain("db.ref(`mesas/${mesaAtualSelecionada}`).set");
    expect(sync).not.toContain("db.ref('mesas').set");
    expect(sync).not.toContain('db.ref("mesas").set');
    expect(sync).toContain("window.gerarMesas");
    expect(sync).toContain("window.atualizarPainelDiario");
  });

  it("operacoes do PDV preservam transferencia atomica entre mesas", () => {
    const operations = read("client/public/pdv/pdv-operations.js");
    expect(operations).toContain("window.transferirMesa");
    expect(operations).toContain("db.ref('/').update");
    expect(operations).toContain("mesas/${origem}");
    expect(operations).toContain("mesas/${destino}");
    expect(operations).toContain("registrarAuditoriaPdv('transferir_mesa'");
  });

  it("fechamento do PDV registra venda, abertura, atendentes e libera mesa", () => {
    const checkout = read("client/public/pdv/pdv-checkout-core.js");
    expect(checkout).toContain("window.imprimirCaixa");
    expect(checkout).toContain("db.ref('/').update");
    expect(checkout).toContain("vendas/${vendaRef.key}");
    expect(checkout).toContain("mesas/${mesaId}");
    expect(checkout).toContain("garcomResponsavel");
    expect(checkout).toContain("garcomNome");
    expect(checkout).toContain("garconsAtendimento");
    expect(checkout).toContain("Mesa aberta por:");
    expect(checkout).toContain("Atendida por:");
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

  it("PDV usa modulos consolidados, relatorio por garcom e cache atualizado", () => {
    const sw = read("client/public/pdv/service-worker.js");
    const access = sw.indexOf("/pdv/access-control.js");
    const diagnostics = sw.indexOf("/pdv/access-diagnostics.js");
    const sync = sw.indexOf("/pdv/pdv-sync.js");
    const safety = sw.indexOf("/pdv/pdv-safety.js");
    const operations = sw.indexOf("/pdv/pdv-operations.js");
    const checkout = sw.indexOf("/pdv/pdv-checkout-core.js");
    const waiterReport = sw.indexOf("/pdv/waiter-sales-report.js");
    const production = sw.indexOf("/pdv/pdv-production.js");
    const fastCheckout = sw.indexOf("/pdv/fast-checkout.js");
    expect(access).toBeGreaterThanOrEqual(0);
    expect(diagnostics).toBeGreaterThan(access);
    expect(sync).toBeGreaterThan(diagnostics);
    expect(safety).toBeGreaterThan(sync);
    expect(operations).toBeGreaterThan(sync);
    expect(checkout).toBeGreaterThan(sync);
    expect(waiterReport).toBeGreaterThan(checkout);
    expect(production).toBeGreaterThan(waiterReport);
    expect(fastCheckout).toBeGreaterThan(checkout);
    expect(sw).toContain("joao-caicara-pdv-v27");
    expect(sw).not.toContain("/pdv/hotfix-sync.js");
  });

  it("relatorio diario divide venda por autoria do item sem ratear taxa de servico", () => {
    const report = read("client/public/pdv/waiter-sales-report.js");
    expect(report).toContain("obterVendasDoDiaPdv");
    expect(report).toContain("garcomLancamento");
    expect(report).toContain("qtd * preco");
    expect(report).toContain("garcomResponsavel");
    expect(report).toContain("garconsAtendimento");
    expect(report).toContain("taxa de serviço");
    expect(report).toContain("Vendas por Garçom");
    expect(report).toContain("Não identificado");
    expect(report).not.toContain("venda.total / ");
  });

  it("PDV somente consulta perfil remoto e preserva modo compatibilidade", () => {
    const access = read("client/public/pdv/access-control.js");
    expect(access).toContain("perfilAtual: 'administrador'");
    expect(access).toContain("modoCompatibilidade: true");
    expect(access).toContain("consultarPerfilRemoto");
    expect(access).toContain("perfisAcesso/${uid}");
    expect(access).toContain("aplicado: false");
    expect(access).not.toContain("BOOTSTRAP_ADMIN_UID");
    expect(access).not.toContain("ref.set({ perfil: 'administrador' })");
    expect(access).not.toContain("tentarBootstrapAdministrador");
  });

  it("Garcom carrega login, atribuicao e velocidade na ordem correta", () => {
    const access = read("client/public/garcom/access-control.js");
    const sw = read("client/public/garcom/service-worker.js");
    const shared = sw.indexOf("/garcom/shared-login.js");
    const diagnostics = sw.indexOf("/garcom/access-diagnostics.js");
    const hotfix = sw.indexOf("/garcom/hotfix-sync.js");
    const attribution = sw.indexOf("/garcom/waiter-attribution.js");
    const speed = sw.indexOf("/garcom/waiter-speed.js");
    expect(access).toContain("perfilAtual: 'garcom'");
    expect(access).toContain("modoCompatibilidade: true");
    expect(access).toContain("consultarPerfilRemoto");
    expect(access).toContain("perfisAcesso/${uid}");
    expect(shared).toBeGreaterThanOrEqual(0);
    expect(diagnostics).toBeGreaterThan(shared);
    expect(hotfix).toBeGreaterThan(diagnostics);
    expect(attribution).toBeGreaterThan(hotfix);
    expect(speed).toBeGreaterThan(attribution);
    expect(sw).toContain("joao-caicara-garcom-v15");
  });

  it("login compartilhado pede nome e senha sem armazenar a senha da equipe", () => {
    const login = read("client/public/garcom/shared-login.js");
    expect(login).toContain("LOGIN_COMPARTILHADO = 'garcom'");
    expect(login).toContain("garcom-login-name");
    expect(login).toContain('type="password"');
    expect(login).toContain("sessionStorage");
    expect(login).toContain("trocarGarcom");
    expect(login).toContain("signInWithEmailAndPassword");
    expect(login).toContain("funcionarioId: user.uid");
    expect(login).toContain("sessaoGarcomAtual");
    expect(login).not.toContain("895623");
  });

  it("uma mesa pode ser atendida por varios garçons sem perder autoria dos itens", () => {
    const hotfix = read("client/public/garcom/hotfix-sync.js");
    const attribution = read("client/public/garcom/waiter-attribution.js");
    expect(hotfix).toContain("garcomResponsavel");
    expect(hotfix).toContain("garconsAtendimento");
    expect(hotfix).toContain("primeiroAtendimentoEm");
    expect(attribution).toContain("registrarAtendimentoNaMesa");
    expect(attribution).toContain("garconsAtendimento");
    expect(attribution).toContain("garcomLancamento");
    expect(attribution).toContain("garcomUltimoLancamento");
    expect(attribution).toContain("Mesa aberta por:");
    expect(attribution).toContain("Atendida por:");
    expect(attribution).not.toContain("Garçom responsável:");
  });

  it("diagnostico de sessao apenas exibe UID e perfil sem alterar acesso", () => {
    const pdv = read("client/public/pdv/access-diagnostics.js");
    const garcom = read("client/public/garcom/access-diagnostics.js");
    expect(pdv).toContain("UID:");
    expect(pdv).toContain("Perfil remoto (diagnóstico):");
    expect(pdv).toContain("window.PdvDiagnosticoSessao");
    expect(pdv).not.toContain("ativarControleEstrito");
    expect(pdv).not.toContain("definirPerfil(");
    expect(garcom).toContain("UID:");
    expect(garcom).toContain("Perfil remoto:");
    expect(garcom).toContain("window.GarcomDiagnosticoSessao");
    expect(garcom).not.toContain("ativarControleEstrito");
    expect(garcom).not.toContain("definirPerfil(");
  });

  it("Actions habilita login por email e senha sem conter senha operacional", () => {
    const workflow = read(".github/workflows/firebase-hosting-deploy.yml");
    expect(workflow).toContain("Enable Firebase email/password sign-in");
    expect(workflow).toContain('"enabled":true');
    expect(workflow).not.toContain("895623");
  });

  it("cadastro do administrador e feito pela credencial administrativa do Actions", () => {
    const workflow = read(".github/workflows/firebase-hosting-deploy.yml");
    expect(workflow).toContain("Seed administrator access profile");
    expect(workflow).toContain("database:set /perfisAcesso/woAmR3x91JcMZGLzykBUtLG97Hx1");
    expect(workflow).toContain("--data '{\"perfil\":\"administrador\"}'");
    expect(workflow).toContain("--instance joaocaicaratradicao-default-rtdb");
    expect(workflow).toContain("--force");
  });

  it("regras operacionais ainda nao exigem perfil nesta fase de compatibilidade", () => {
    const rulesText = read("database.rules.json");
    expect(rulesText).toContain("auth != null");
    expect(rulesText).not.toContain("auth.token.perfil");
    expect(rulesText).not.toContain("auth.token.role");
  });

  it("hotfix principal antigo do PDV foi removido", () => {
    expect(fs.existsSync("client/public/pdv/hotfix-sync.js")).toBe(false);
  });

  it("deploy inclui Hosting e regras do Realtime Database em etapas separadas", () => {
    const workflow = read(".github/workflows/firebase-hosting-deploy.yml");
    expect(workflow).toContain("Deploy to Firebase Hosting");
    expect(workflow).toContain("--only hosting");
    expect(workflow).toContain("Deploy Realtime Database rules");
    expect(workflow).toContain("--only database");
  });
});
