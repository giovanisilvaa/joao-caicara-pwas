import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('painel externo de gestao somente leitura', () => {
  it('publica uma rota administrativa separada do PDV', () => {
    const html = read('client/public/gestao/index.html');
    expect(html).toContain('<title>João Caiçara — Gestão</title>');
    expect(html).toContain('/gestao/gestao.css?v=1');
    expect(html).toContain('/gestao/gestao.js?v=1');
    expect(html).toContain('/auth-session-isolation.js?v=20');
    expect(html).toContain('🔒 Somente leitura');
  });

  it('usa a mesma conta administrativa real sem armazenar senha no codigo', () => {
    const runtime = read('client/public/gestao/gestao.js');
    expect(runtime).toContain("const EMAIL_ADMIN = 'adm@acesso.joaocaicara.app'");
    expect(runtime).toContain("const senha = String(senhaEl?.value || '')");
    expect(runtime).toContain('signInWithEmailAndPassword(EMAIL_ADMIN, senha)');
    expect(runtime).toContain('usuarioEhAdmin');
    expect(runtime).not.toMatch(/const\s+(?:SENHA_ADMIN|ADMIN_PASSWORD|PASSWORD_ADMIN)\s*=\s*['"][^'"]+['"]/i);
  });

  it('isola a autenticacao por aba e bloqueia por inatividade', () => {
    const runtime = read('client/public/gestao/gestao.js');
    const isolamento = read('client/public/auth-session-isolation.js');
    expect(runtime).toContain('window.FirebaseAuthSessionIsolationReady');
    expect(runtime).toContain('const AUTO_LOCK_MS = 10 * 60 * 1000');
    expect(runtime).toContain("sair('Sessão bloqueada após 10 minutos sem uso.')");
    expect(isolamento).toContain('Persistence?.SESSION');
    expect(isolamento).toContain('.setPersistence(sessionMode)');
  });

  it('faz somente leituras no Realtime Database', () => {
    const runtime = read('client/public/gestao/gestao.js');
    expect(runtime).toContain("database.ref('vendas')");
    expect(runtime).toContain("database.ref('sessoesCaixa/atual')");
    expect(runtime).toContain("vendasRef.on('value'");
    expect(runtime).toContain("sessaoRef.on('value'");
    expect(runtime).not.toMatch(/database\.ref\([^)]*\)\s*\.\s*(?:set|update|push|remove|transaction)\s*\(/);
    expect(runtime).not.toMatch(/(?:vendasRef|sessaoRef)\s*\.\s*(?:set|update|push|remove|transaction)\s*\(/);
    expect(runtime).not.toContain(".ref('mesas')");
    expect(runtime).not.toContain(".ref('pedidosProducao')");
    expect(runtime).not.toContain(".ref('cardapio')");
  });

  it('repete a formula oficial do relatorio financeiro do PDV', () => {
    const gestao = read('client/public/gestao/gestao.js');
    const oficial = read('client/public/pdv/daily-sales-report.js');
    const trechos = [
      'acc.dinheiroRecebido += numero(pagamentos.dinheiro)',
      'acc.pix += numero(pagamentos.pix)',
      'acc.credito += numero(pagamentos.credito)',
      'acc.debito += numero(pagamentos.debito)',
      'acc.troco += numero(venda?.troco)',
      'acc.taxa += taxa',
      'acc.subtotal += subtotal',
      'acc.total += total',
      'resumo.dinheiroLiquido = resumo.dinheiroRecebido - resumo.troco',
      'resumo.ticketMedio = resumo.quantidadeVendas ? resumo.total / resumo.quantidadeVendas : 0',
      'resumo.diferencaPagamentos = pagamentosLiquidos - resumo.total'
    ];
    trechos.forEach(trecho => {
      expect(oficial).toContain(trecho);
      expect(gestao).toContain(trecho);
    });
  });

  it('preserva o rateio oficial de vendas e servico por garcom', () => {
    const runtime = read('client/public/gestao/gestao.js');
    expect(runtime).toContain('item?.garcomLancamento?.nome');
    expect(runtime).toContain('linha.servico += taxa * (Math.max(0, contribuicao.valor) / baseRateio)');
    expect(runtime).toContain("'Não identificado'");
    expect(runtime).toContain('.sort((a, b) => b.vendido - a.vendido');
  });

  it('mantem dados gerenciais protegidos pelas regras administrativas atuais', () => {
    const rules = JSON.parse(read('database.rules.json'));
    expect(String(rules.rules.vendas?.['.read'])).toContain("auth.token.email === 'adm@acesso.joaocaicara.app'");
    expect(String(rules.rules.sessoesCaixa?.['.read'])).toContain("auth.token.email === 'adm@acesso.joaocaicara.app'");
    expect(String(rules.rules.auditoria?.['.read'])).toContain("auth.token.email === 'adm@acesso.joaocaicara.app'");
  });

  it('forca no-store e verifica a propagacao da nova pagina no deploy', () => {
    const firebase = read('firebase.json');
    const workflow = read('.github/workflows/firebase-hosting-deploy.yml');
    expect(firebase).toContain('"source": "/gestao/"');
    expect(firebase).toContain('"source": "/gestao/**"');
    expect(firebase).toContain('no-store, no-cache, must-revalidate, max-age=0');
    expect(workflow).toContain("verificar_arquivo '/gestao/' 'client/public/gestao/index.html'");
    expect(workflow).toContain("verificar_arquivo '/gestao/gestao.js' 'client/public/gestao/gestao.js'");
    expect(workflow).toContain("verificar_arquivo '/gestao/gestao.css' 'client/public/gestao/gestao.css'");
    expect(workflow).toContain("verificar_no_cache '/gestao/'");
  });
});
