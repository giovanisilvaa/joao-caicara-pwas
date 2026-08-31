import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('client/public/pdv/cash-session-sales-link-v1.js', 'utf8');

function runtime(sessao: any) {
  const storage = new Map<string, string>();
  const pushes: Array<{ path: string; value: any }> = [];
  const chamadasOriginais: any[][] = [];

  const sandbox: any = {
    location: { pathname: '/pdv/' },
    console,
    Date,
    Math,
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value))
    },
    db: {
      ref: (path: string) => ({
        push: (value: any) => {
          pushes.push({ path, value: JSON.parse(JSON.stringify(value)) });
          return { key: 'venda-teste' };
        }
      })
    }
  };
  sandbox.window = sandbox;
  sandbox.PdvSessaoCaixa = { atual: () => sessao };
  sandbox.salvarVendaNoHistorico = (...args: any[]) => chamadasOriginais.push(args);

  vm.runInNewContext(source, sandbox, { filename: 'cash-session-sales-link-v1.js' });
  return { sandbox, storage, pushes, chamadasOriginais };
}

const argsVenda = [
  12,
  'Cliente teste',
  [{ nome: 'Peixe', qtd: 1, preco: 100 }],
  110,
  { dinheiro: 110, pix: 0, credito: 0, debito: 0 },
  0,
  '31/08/2026, 00:30:00',
  100,
  10
];

describe('vínculo de vendas com a sessão de caixa', () => {
  it('acrescenta a sessão ativa sem perder os campos atuais da venda', () => {
    const sessao = {
      id: 'CX-20260831-001500-abcde',
      codigo: 'CX-20260831-001500',
      status: 'aberto',
      abertoEm: 1788146100000,
      versao: 1
    };
    const { sandbox, storage, pushes, chamadasOriginais } = runtime(sessao);

    sandbox.salvarVendaNoHistorico(...argsVenda);

    expect(chamadasOriginais).toHaveLength(0);
    expect(pushes).toHaveLength(1);
    expect(pushes[0].path).toBe('vendas');
    expect(pushes[0].value).toMatchObject({
      mesa: 12,
      cliente: 'Cliente teste',
      subtotal: 100,
      taxa: 10,
      total: 110,
      troco: 0,
      origem: 'pdv',
      sessaoCaixaId: sessao.id,
      sessaoCaixaCodigo: sessao.codigo,
      sessaoCaixaAbertoEm: sessao.abertoEm,
      sessaoCaixaVersao: 1
    });
    expect(pushes[0].value.pagamentos).toEqual(argsVenda[4]);
    expect(pushes[0].value.itens).toEqual(argsVenda[2]);

    const local = JSON.parse(storage.get('historico_vendas_caicara') || '[]');
    expect(local).toHaveLength(1);
    expect(local[0].id).toBe(pushes[0].value.id);
    expect(local[0].sessaoCaixaId).toBe(sessao.id);
  });

  it('preserva integralmente o fluxo legado quando não há sessão aberta', () => {
    const { sandbox, pushes, chamadasOriginais } = runtime(null);

    sandbox.salvarVendaNoHistorico(...argsVenda);

    expect(chamadasOriginais).toHaveLength(1);
    expect(chamadasOriginais[0]).toEqual(argsVenda);
    expect(pushes).toHaveLength(0);
  });

  it('não aceita uma sessão fechada como vínculo de nova venda', () => {
    const { sandbox, pushes, chamadasOriginais } = runtime({
      id: 'CX-fechado', codigo: 'CX-fechado', status: 'fechado', abertoEm: 1, versao: 1
    });

    sandbox.salvarVendaNoHistorico(...argsVenda);

    expect(chamadasOriginais).toHaveLength(1);
    expect(pushes).toHaveLength(0);
  });

  it('é carregado pelo bootstrap compatível sem alterar o service worker', () => {
    const live = fs.readFileSync('client/public/pwa-live-update.js', 'utf8');
    const sw = fs.readFileSync('client/public/pdv/service-worker.js', 'utf8');

    expect(live).toContain('function garantirVinculoVendasCaixaPdv()');
    expect(live).toContain("window.PDV_CASH_SESSION_SALES_LINK_RUNTIME === 'v1'");
    expect(live).toContain("script.src = '/pdv/cash-session-sales-link-v1.js?v=1&direct=1'");
    expect(live).toContain("script.dataset.pdvCashSessionSalesLink = 'v1'");
    expect(sw).not.toContain('cash-session-sales-link-v1.js');
  });

  it('mantém a nova camada restrita à escrita de vendas', () => {
    expect(source).toContain("database.ref('vendas').push(registro)");
    expect(source).not.toContain("ref('mesas')");
    expect(source).not.toContain("ref('pedidosProducao')");
    expect(source).not.toContain("ref('fechamentosCaixa')");
    expect(source).not.toContain("ref('sessoesCaixa')");
    expect(source).not.toContain('.remove(');
  });
});
