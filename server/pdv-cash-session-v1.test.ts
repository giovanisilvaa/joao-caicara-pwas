import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('sessão estrutural de caixa do PDV', () => {
  it('mantém uma única sessão ativa e preserva histórico por transação', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain("const PATH = 'sessoesCaixa'");
    expect(src).toContain('database.ref(PATH).transaction');
    expect(src).toContain("raiz.atual?.status === STATUS_ABERTO");
    expect(src).toContain('atual: sessao');
    expect(src).toContain('registros: { ...registros, [id]: sessao }');
    expect(src).toContain('delete proxima.atual');
    expect(src).toContain('registros: { ...registros, [esperada]: fechada }');
  });

  it('registra abertura e encerramento com resumo final sem alterar vendas', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain('fundoInicial');
    expect(src).toContain('operadorAbertura');
    expect(src).toContain('operadorFechamento');
    expect(src).toContain("status: STATUS_FECHADO");
    expect(src).toContain('resumoFinal: clone(resumoFinal)');
    expect(src).toContain("fase: 'resumo_final_v1'");
    expect(src).toContain("database.ref('vendas')");
    expect(src).toContain(".orderByChild('sessaoCaixaId')");
    expect(src).toContain(".equalTo(String(sessaoId))");
    expect(src).not.toContain("ref('vendas').push(");
    expect(src).not.toContain("ref('vendas').set(");
    expect(src).not.toContain("ref('vendas').update(");
    expect(src).not.toContain("ref('pedidosProducao')");
    expect(src).not.toContain("ref('fechamentosCaixa')");
    expect(src).not.toContain('.remove(');
  });

  it('consulta mesas somente leitura e falha fechado antes de encerrar', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain("const refMesas = database.ref('mesas')");
    expect(src).toContain("await refMesas.once('value')");
    expect(src).not.toContain('refMesas.set(');
    expect(src).not.toContain('refMesas.update(');
    expect(src).not.toContain('refMesas.remove(');
    expect(src).not.toContain('refMesas.transaction(');
    expect(src).toContain("mesa.estadoConta === 'aguardando_pagamento'");
    expect(src).toContain('await confirmarMesasLivresAntesDoFechamento()');
    expect(src).toContain('Por segurança, a sessão de caixa permanece aberta.');
    expect(src).toContain('Não é possível encerrar o caixa com mesas/comandas abertas ou aguardando pagamento.');
  });

  it('estabiliza as vendas antes de preservar o retrato financeiro', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain('const ESTABILIZACAO_MS = 600');
    expect(src).toContain('const MAX_LEITURAS_ESTABILIZACAO = 4');
    expect(src).toContain('async function resumoFinanceiroEstavelServidor(sessao)');
    expect(src).toContain('await esperar(ESTABILIZACAO_MS)');
    expect(src).toContain('atual.assinatura === anterior.assinatura');
    expect(src).toContain("throw new Error('As vendas da sessão ainda estão sincronizando.')");
    expect(src).toContain('As vendas da sessão ainda não puderam ser confirmadas no servidor.');
  });

  it('aceita fundo inicial com vírgula, ponto decimal ou milhar comum', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain("texto.includes(',') && texto.includes('.')");
    expect(src).toContain("else if (texto.includes(',')) texto = texto.replace(',', '.')");
    expect(src).toContain("/^\\d{1,3}(\\.\\d{3})+$/.test(texto)");
    expect(src).toContain('Number.isFinite(fundoInicial)');
    expect(src).toContain('fundoInicial < 0');
  });

  it('deixa a sessão exclusiva do administrador e mantém o índice financeiro de vendas', () => {
    const regras = JSON.parse(read('database.rules.json')).rules;
    const caixa = regras.sessoesCaixa;
    expect(caixa).toBeTruthy();
    expect(caixa['.read']).toContain("auth.token.email === 'adm@acesso.joaocaicara.app'");
    expect(caixa['.write']).toContain("auth.token.email === 'adm@acesso.joaocaicara.app'");
    expect(caixa['.read']).not.toContain('garcom@acesso.joaocaicara.app');
    expect(caixa['.write']).not.toContain('garcom@acesso.joaocaicara.app');
    expect(caixa.atual['.validate']).toContain("newData.child('status').val() === 'aberto'");
    const validarRegistro = caixa.registros['$sessaoId']['.validate'];
    expect(validarRegistro).toContain("newData.child('id').val() === $sessaoId");
    expect(validarRegistro).toContain("newData.child('status').val() === 'fechado'");
    expect(validarRegistro).toContain("newData.hasChildren(['fechadoEm', 'duracaoMs'])");
    expect(validarRegistro).toContain("newData.child('fechadoEm').isNumber()");
    expect(validarRegistro).toContain("newData.child('duracaoMs').val() >= 0");
    expect(regras.vendas['.indexOn']).toEqual(['sessaoCaixaId']);
  });

  it('publica a camada sem remover a zeragem e os relatórios legados', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain('cashsession-v44');
    expect(sw).toContain("const CASH_SESSION_ASSET = '/pdv/' + 'cash-session-v1.js?v=1'");
    expect(sw).toContain('CASH_SESSION_ASSET');
    expect(sw).toContain('<script src="/pdv/cash-session-v1.js?v=1"></script>');
    expect(sw).toContain('/pdv/cash-reset.js?v=35');
    expect(sw).toContain("DAILY_SALES_REPORT_ASSET = '/pdv/' + 'daily-sales-report.js?v=29'");
    expect(sw).toContain("REPORT_DASHBOARD_ASSET = '/pdv/report-dashboard-v1.js?v=1'");
  });

  it('faz bootstrap da sessão mesmo quando o PDV ainda está sob service worker anterior', () => {
    const live = read('client/public/pwa-live-update.js');
    expect(live).toContain('function garantirSessaoCaixaPdv()');
    expect(live).toContain("window.PDV_CASH_SESSION_RUNTIME === 'v1'");
    expect(live).toContain("script.src = '/pdv/cash-session-v1.js?v=1&direct=1'");
    expect(live).toContain('script.dataset.pdvCashSession = \'v1\'');
    expect(live).toContain('garantirSessaoCaixaPdv();');
  });

  it('reativa a ação após relogar com uma sessão já aberta', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain("botao.textContent = 'Encerrar sessão'");
    expect(src).toContain('botao.disabled = false');
  });

  it('expõe cálculo puro do resumo para validação e relatórios futuros', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain('window.PdvSessaoCaixa = Object.freeze');
    expect(src).toContain('resumirVendas: (vendas, sessao, calculadoEm) =>');
    expect(src).toContain('idAtual: () =>');
    expect(src).toContain('codigoAtual: () =>');
    expect(src).toContain("runtime: 'v1'");
  });
});
