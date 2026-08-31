import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('client/public/pdv/cash-session-totals-v1.js', 'utf8');

function apiTotais() {
  const sandbox: any = {
    location: { pathname: '/pdv/' },
    window: null,
    document: {
      readyState: 'loading',
      addEventListener: () => {}
    },
    console,
    Number,
    Math,
    Object,
    Array,
    String
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'cash-session-totals-v1.js' });
  return sandbox.PdvCashSessionTotals;
}

describe('totais financeiros da sessão de caixa', () => {
  it('soma vendas da sessão e desconta o troco somente do dinheiro', () => {
    const api = apiTotais();
    const totais = api.calcular([
      {
        subtotal: 100,
        taxa: 10,
        total: 110,
        pagamentos: { dinheiro: 150, pix: 0, credito: 0, debito: 0 },
        troco: 40
      },
      {
        subtotal: 50,
        taxa: 5,
        total: 55,
        pagamentos: { dinheiro: 0, pix: 55, credito: 0, debito: 0 },
        troco: 0
      }
    ], { fundoInicial: 200 });

    expect(totais).toMatchObject({
      quantidadeVendas: 2,
      subtotal: 150,
      taxaServico: 15,
      totalVendas: 165,
      dinheiroBruto: 150,
      troco: 40,
      dinheiroLiquido: 110,
      pix: 55,
      credito: 0,
      debito: 0,
      fundoInicial: 200,
      especieEsperada: 310
    });
  });

  it('preserva corretamente pagamentos mistos por forma', () => {
    const api = apiTotais();
    const totais = api.calcular([
      {
        subtotal: 100,
        taxa: 10,
        total: 110,
        pagamentos: { dinheiro: 20, pix: 30, credito: 40, debito: 20 },
        troco: 0
      }
    ], { fundoInicial: 50 });

    expect(totais.quantidadeVendas).toBe(1);
    expect(totais.totalVendas).toBe(110);
    expect(totais.dinheiroLiquido).toBe(20);
    expect(totais.pix).toBe(30);
    expect(totais.credito).toBe(40);
    expect(totais.debito).toBe(20);
    expect(totais.especieEsperada).toBe(70);
  });

  it('usa total menos taxa como fallback de subtotal e não aceita valores negativos', () => {
    const api = apiTotais();
    const totais = api.calcular([
      {
        total: 55,
        taxa: 5,
        pagamentos: { dinheiro: -10, pix: 55 },
        troco: -1
      }
    ], { fundoInicial: -100 });

    expect(totais.subtotal).toBe(50);
    expect(totais.taxaServico).toBe(5);
    expect(totais.totalVendas).toBe(55);
    expect(totais.dinheiroLiquido).toBe(0);
    expect(totais.pix).toBe(55);
    expect(totais.fundoInicial).toBe(0);
    expect(totais.especieEsperada).toBe(0);
  });

  it('consulta somente vendas da sessão ativa usando índice dedicado', () => {
    expect(source).toContain("database.ref('vendas').orderByChild('sessaoCaixaId').equalTo(String(sessao.id))");
    const regras = JSON.parse(fs.readFileSync('database.rules.json', 'utf8')).rules;
    expect(regras.vendas['.indexOn']).toEqual(['sessaoCaixaId']);
    expect(regras.vendas['.read']).toBe("auth != null && auth.token.email === 'adm@acesso.joaocaicara.app'");
  });

  it('é estritamente somente leitura sobre vendas e sessão', () => {
    expect(source).not.toContain("ref('vendas').push(");
    expect(source).not.toContain("ref('vendas').set(");
    expect(source).not.toContain("ref('vendas').update(");
    expect(source).not.toContain("ref('mesas')");
    expect(source).not.toContain('.transaction(');
    expect(source).not.toContain('.remove(');
    expect(source).toContain("db().ref('sessoesCaixa/atual')");
  });

  it('carrega pelo bootstrap compatível sem alterar o service worker', () => {
    const live = fs.readFileSync('client/public/pwa-live-update.js', 'utf8');
    const sw = fs.readFileSync('client/public/pdv/service-worker.js', 'utf8');
    expect(live).toContain('function garantirTotaisSessaoCaixaPdv()');
    expect(live).toContain("window.PDV_CASH_SESSION_TOTALS_RUNTIME === 'v1'");
    expect(live).toContain("script.src = '/pdv/cash-session-totals-v1.js?v=1&direct=1'");
    expect(live).toContain("script.dataset.pdvCashSessionTotals = 'v1'");
    expect(sw).not.toContain('cash-session-totals-v1.js');
  });

  it('expõe no painel os indicadores financeiros definidos para esta etapa', () => {
    expect(source).toContain('Movimento da sessão');
    expect(source).toContain('Taxa de serviço');
    expect(source).toContain('Dinheiro líquido');
    expect(source).toContain('Fundo inicial');
    expect(source).toContain('Espécie esperada');
  });
});
