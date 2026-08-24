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

  it("PDV usa modulos consolidados e diagnostico de sessao", () => {
    const sw = read("client/public/pdv/service-worker.js");
    const access = sw.indexOf("/pdv/access-control.js");
    const diagnostics = sw.indexOf("/pdv/access-diagnostics.js");
    const sync = sw.indexOf("/pdv/pdv-sync.js");
    const safety = sw.indexOf("/pdv/pdv-safety.js");
    const operations = sw.indexOf("/pdv/pdv-operations.js");
    const checkout = sw.indexOf("/pdv/pdv-checkout-core.js");
    const production = sw.indexOf("/pdv/pdv-production.js");
    const fastCheckout = sw.indexOf("/pdv/fast-checkout.js");
    expect(access).toBeGreaterThanOrEqual(0);
    expect(diagnostics).toBeGreaterThan(access);
    expect(sync).toBeGreaterThan(diagnostics);
    expect(safety).toBeGreaterThan(sync);
    expect(operations).toBeGreaterThan(sync);
    expect(checkout).toBeGreaterThan(sync);
    expect(production).toBeGreaterThan(sync);
    expect(fastCheckout).toBeGreaterThan(checkout);
    expect(sw).toContain("joao-caicara-pdv-v24");
    expect(sw).not.toContain("/pdv/hotfix-sync.js");
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

  it("Garcom consulta perfil remoto e carrega login compartilhado", () => {
    const access = read("client/public/garcom/access-control.js");
    const sw = read("client/public/garcom/service-worker.js");
    const shared = sw.indexOf("/garcom/shared-login.js");
    const diagnostics = sw.indexOf("/garcom/access-diagnostics.js");
    expect(access).toContain("perfilAtual: 'garcom'");
    expect(access).toContain("modoCompatibilidade: true");
    expect(access).toContain("consultarPerfilRemoto");
    expect(access).toContain("perfisAcesso/${uid}");
    expect(access).toContain("aplicado: false");
    expect(sw).toContain("/garcom/access-control.js");
    expect(shared).toBeGreaterThanOrEqual(0);
    expect(diagnostics).toBeGreaterThan(shared);
    expect(sw).toContain("joao-caicara-garcom-v13");
  });

  it("login compartilhado do garcom nao armazena senha e preserva fallback", () => {
    const login = read("client/public/garcom/shared-login.js");
    expect(login).toContain("LOGIN_COMPARTILHADO = 'garcom'");
    expect(login).toContain("type=\"password\"");
    expect(login).toContain("signInWithEmailAndPassword");
    expect(login).toContain("createUserWithEmailAndPassword");
    expect(login).toContain("Acesso temporário");
    expect(login).toContain("funcionarioId: user.uid");
    expect(login).toContain("window.sessaoGarcomAtual = sessaoAtual");
    expect(login).not.toMatch(/const\s+SENHA/i);
    expect(login).not.toMatch(/senha\s*=\s*['\"]\d{6,}['\"]/i);
  });

  it("diagnostico de sessao apenas exibe UID e perfil sem alterar acesso", () => {
    const pdv = read("client/public/pdv/access-diagnostics.js");
    const garcom = read("client/public/garcom/access-diagnostics.js");
    expect(pdv).toContain("UID:");
    expect(pdv).toContain("Perfil remoto:");
    expect(pdv).toContain("window.PdvDiagnosticoSessao");
    expect(pdv).not.toContain("ativarControleEstrito");
    expect(pdv).not.toContain("definirPerfil(");
    expect(garcom).toContain("UID:");
    expect(garcom).toContain("Perfil remoto:");
    expect(garcom).toContain("window.GarcomDiagnosticoSessao");
    expect(garcom).not.toContain("ativarControleEstrito");
    expect(garcom).not.toContain("definirPerfil(");
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

  it("hotfix principal antigo foi removido", () => {
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
