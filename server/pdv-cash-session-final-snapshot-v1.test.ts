import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const sessaoSource = fs.readFileSync('client/public/pdv/cash-session-v1.js', 'utf8');
const totaisSource = fs.readFileSync('client/public/pdv/cash-session-totals-v1.js', 'utf8');

function carregarResumoSessao() {
  const sandbox: any = {
    window: null,
    document: { readyState: 'loading', addEventListener: () => {} },
    console,
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Math,
    Number,
    Object,
    Array,
    String,
    JSON
  };
  sandbox.window = sandbox;
  vm.runInNewContext(sessaoSource, sandbox, { filename: 'cash-session-v1.js' });
  return sandbox.PdvSessaoCaixa;
}

function carregarTotaisPainel() {
  const sandbox: any = {
    window: null,
    location: { pathname: '/pdv/' },
    document: { readyState: 'loading', addEventListener: () => {} },
    console,
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Math,
    Number,
    Object,
    Array,
    String,
    JSON
  };
  sandbox.window = sandbox;
  vm.runInNewContext(totaisSource, sandbox, { filename: 'cash-session-totals-v1.js' });
  return sandbox.PdvCashSessionTotals;
}

const vendas = [
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
  },
  {
    subtotal: 90,
    taxa: 9,
    total: 99,
    pagamentos: { dinheiro: 0, pix: 0, credito: 49, debito: 50 },
    troco: 0
  }
];

const sessao = {
  id: 'CX-TESTE',
  codigo: 'CX-TESTE',
  status: 'aberto',
  abertoEm: 1788146100000,
  fundoInicial: 200,
  versao: 1
};

describe('retrato financeiro final da sessão', () => {
  it('salva os mesmos totais exibidos no painel Movimento da sessão', () => {
    const apiSessao = carregarResumoSessao();
    const apiPainel = carregarTotaisPainel();

    const final = apiSessao.resumirVendas(vendas, sessao, 1788149700000);
    const painel = apiPainel.calcular(vendas, sessao);

    const campos = [
      'quantidadeVendas', 'subtotal', 'taxaServico', 'totalVendas',
      'dinheiroBruto', 'troco', 'dinheiroLiquido', 'pix', 'credito',
      'debito', 'fundoInicial', 'especieEsperada'
    ];
    for (const campo of campos) expect(final[campo]).toBe(painel[campo]);
  });

  it('preserva metadados que identificam a versão, origem e instante do retrato', () => {
    const apiSessao = carregarResumoSessao();
    const final = apiSessao.resumirVendas(vendas, sessao, 1788149700000);

    expect(final.versao).toBe(1);
    expect(final.calculadoEm).toBe(1788149700000);
    expect(final.fonte).toBe('vendas_por_sessao');
    expect(final.quantidadeVendas).toBe(3);
    expect(final.totalVendas).toBe(264);
    expect(final.dinheiroLiquido).toBe(110);
    expect(final.especieEsperada).toBe(310);
  });

  it('não adiciona mutação de vendas ao encerramento da sessão', () => {
    expect(sessaoSource).toContain("database.ref('vendas')");
    expect(sessaoSource).toContain(".orderByChild('sessaoCaixaId')");
    expect(sessaoSource).toContain(".once('value')");
    expect(sessaoSource).not.toContain("ref('vendas').push(");
    expect(sessaoSource).not.toContain("ref('vendas').set(");
    expect(sessaoSource).not.toContain("ref('vendas').update(");
    expect(sessaoSource).not.toContain("ref('vendas').transaction(");
  });

  it('anexa o retrato à sessão fechada dentro da mesma transação que remove a sessão ativa', () => {
    expect(sessaoSource).toContain('resumoFinal: clone(resumoFinal)');
    expect(sessaoSource).toContain("fase: 'resumo_final_v1'");
    expect(sessaoSource).toContain('registros: { ...registros, [esperada]: fechada }');
    expect(sessaoSource).toContain('delete proxima.atual');
  });
});
