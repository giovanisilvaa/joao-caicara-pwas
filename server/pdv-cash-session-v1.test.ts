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

  it('registra abertura e encerramento sem apagar dados financeiros existentes', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain('fundoInicial');
    expect(src).toContain('operadorAbertura');
    expect(src).toContain('operadorFechamento');
    expect(src).toContain("status: STATUS_FECHADO");
    expect(src).toContain("fase: 'estrutura_v1'");
    expect(src).not.toContain("ref('vendas')");
    expect(src).not.toContain("ref('mesas')");
    expect(src).not.toContain("ref('pedidosProducao')");
    expect(src).not.toContain("ref('fechamentosCaixa')");
    expect(src).not.toContain('.remove(');
  });

  it('deixa a sessão exclusiva do administrador nas regras do Firebase', () => {
    const regras = JSON.parse(read('database.rules.json')).rules;
    const caixa = regras.sessoesCaixa;
    expect(caixa).toBeTruthy();
    expect(caixa['.read']).toContain("auth.token.email === 'adm@acesso.joaocaicara.app'");
    expect(caixa['.write']).toContain("auth.token.email === 'adm@acesso.joaocaicara.app'");
    expect(caixa['.read']).not.toContain('garcom@acesso.joaocaicara.app');
    expect(caixa['.write']).not.toContain('garcom@acesso.joaocaicara.app');
    expect(caixa.atual['.validate']).toContain("newData.child('status').val() === 'aberto'");
    expect(caixa.registros['$sessaoId']['.validate']).toContain("newData.child('id').val() === $sessaoId");
  });

  it('publica a nova camada sem remover a zeragem e os relatórios legados', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain('cashsession-v44');
    expect(sw).toContain("const CASH_SESSION_ASSET = '/pdv/' + 'cash-session-v1.js?v=1'");
    expect(sw).toContain('CASH_SESSION_ASSET');
    expect(sw).toContain('<script src="/pdv/cash-session-v1.js?v=1"></script>');
    expect(sw).toContain('/pdv/cash-reset.js?v=35');
    expect(sw).toContain("DAILY_SALES_REPORT_ASSET = '/pdv/' + 'daily-sales-report.js?v=29'");
    expect(sw).toContain("REPORT_DASHBOARD_ASSET = '/pdv/report-dashboard-v1.js?v=1'");
  });

  it('expõe apenas a API necessária para a próxima etapa de vincular vendas', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain('window.PdvSessaoCaixa = Object.freeze');
    expect(src).toContain('idAtual: () =>');
    expect(src).toContain('codigoAtual: () =>');
    expect(src).toContain("runtime: 'v1'");
  });
});
