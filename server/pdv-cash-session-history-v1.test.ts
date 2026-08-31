import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('client/public/pdv/cash-session-history-v1.js', 'utf8');

function apiHistorico() {
  const sandbox: any = {
    window: null,
    location: { pathname: '/pdv/' },
    document: { readyState: 'loading', addEventListener: () => {} },
    console,
    Date,
    Math,
    Number,
    Object,
    Array,
    String,
    JSON
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'cash-session-history-v1.js' });
  return sandbox.PdvCashSessionHistory;
}

describe('histórico de sessões de caixa do PDV', () => {
  it('mantém somente sessões fechadas e ordena pelo fechamento mais recente', () => {
    const api = apiHistorico();
    const lista = api.listaRegistros({
      antiga: { id: 'A', status: 'fechado', fechadoEm: 100, resumoFinal: { totalVendas: 10 } },
      aberta: { id: 'B', status: 'aberto', abertoEm: 200 },
      recente: { id: 'C', status: 'fechado', fechadoEm: 300, resumoFinal: { totalVendas: 30 } }
    });

    expect(lista.map((item: any) => item.id)).toEqual(['C', 'A']);
  });

  it('consolida apenas sessões com resumo final e preserva legadas sem inventar totais', () => {
    const api = apiHistorico();
    const consolidado = api.consolidar([
      {
        id: 'CX-1', status: 'fechado',
        resumoFinal: {
          quantidadeVendas: 2,
          totalVendas: 165,
          taxaServico: 15,
          dinheiroLiquido: 110,
          pix: 55,
          credito: 0,
          debito: 0
        }
      },
      { id: 'CX-LEGADO', status: 'fechado', fechadoEm: 1 },
      {
        id: 'CX-2', status: 'fechado',
        resumoFinal: {
          quantidadeVendas: 1,
          totalVendas: 99,
          taxaServico: 9,
          dinheiroLiquido: 0,
          pix: 0,
          credito: 49,
          debito: 50
        }
      }
    ]);

    expect(consolidado).toMatchObject({
      sessoes: 3,
      comResumo: 2,
      semResumo: 1,
      quantidadeVendas: 3,
      totalVendas: 264,
      taxaServico: 24,
      dinheiroLiquido: 110,
      pix: 55,
      credito: 49,
      debito: 50
    });
  });

  it('usa data local do encerramento como chave do filtro', () => {
    const api = apiHistorico();
    const valor = new Date(2026, 7, 30, 23, 55, 0).getTime();
    expect(api.chaveLocal(valor)).toBe('2026-08-30');
    expect(source).toContain('Data de encerramento');
    expect(source).toContain('chaveLocal(sessao.fechadoEm)');
  });

  it('consulta somente os registros recentes com índice de fechadoEm', () => {
    expect(source).toContain("database.ref('sessoesCaixa/registros')");
    expect(source).toContain(".orderByChild('fechadoEm')");
    expect(source).toContain('.limitToLast(LIMITE)');
    expect(source).toContain(".once('value')");
    expect(source).toContain('const LIMITE = 200');

    const regras = JSON.parse(fs.readFileSync('database.rules.json', 'utf8')).rules;
    expect(regras.sessoesCaixa.registros['.indexOn']).toEqual(['fechadoEm']);
    expect(regras.sessoesCaixa['.read']).toBe("auth != null && auth.token.email === 'adm@acesso.joaocaicara.app'");
    expect(regras.sessoesCaixa['.write']).toBe("auth != null && auth.token.email === 'adm@acesso.joaocaicara.app'");
  });

  it('é estritamente somente leitura sobre dados operacionais', () => {
    expect(source).not.toContain('.set(');
    expect(source).not.toContain('.update(');
    expect(source).not.toContain('.push(');
    expect(source).not.toContain('.remove(');
    expect(source).not.toContain('.transaction(');
    expect(source).not.toContain("ref('vendas')");
    expect(source).not.toContain("ref('mesas')");
  });

  it('identifica claramente sessões anteriores ao resumo final', () => {
    expect(source).toContain('Sem resumo final');
    expect(source).toContain('Histórico legado');
    expect(source).toContain('os totais não serão inventados nem reconstruídos automaticamente');
  });

  it('carrega pelo bootstrap compatível sem alterar o service worker', () => {
    const live = fs.readFileSync('client/public/pwa-live-update.js', 'utf8');
    const sw = fs.readFileSync('client/public/pdv/service-worker.js', 'utf8');

    expect(live).toContain('function garantirHistoricoSessaoCaixaPdv()');
    expect(live).toContain("window.PDV_CASH_SESSION_HISTORY_RUNTIME === 'v1'");
    expect(live).toContain("script.src = '/pdv/cash-session-history-v1.js?v=1&direct=1'");
    expect(live).toContain("script.dataset.pdvCashSessionHistory = 'v1'");
    expect(sw).not.toContain('cash-session-history-v1.js');
  });
});
