import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('fechamento de conta em duas etapas', () => {
  it('marca a mesa como aguardando pagamento sem criar venda nem esvaziar a mesa', () => {
    const src = read('client/public/staged-checkout-v1.js');
    expect(src).toContain("const STATUS = 'aguardando_pagamento'");
    expect(src).toContain('final.estadoConta = STATUS');
    expect(src).toContain('final.fechamentoPendente = {');
    expect(src).toContain('[`mesas/${numero}`]: final');
    expect(src).not.toContain('vendas/${');
    expect(src).not.toContain('mesaVazia()');
  });

  it('preserva itens e apenas remove os campos de fechamento ao reabrir', () => {
    const src = read('client/public/staged-checkout-v1.js');
    expect(src).toContain('const final = clone(dados)');
    expect(src).toContain('delete final.estadoConta');
    expect(src).toContain('delete final.contaFechadaEm');
    expect(src).toContain('delete final.fechamentoPendente');
    expect(src).not.toContain('final.itens = []');
  });

  it('só usa a finalização original quando a mesa está aguardando pagamento', () => {
    const src = read('client/public/staged-checkout-v1.js');
    expect(src).toContain("if (!numero || !pendente(mesaLocal(numero)))");
    expect(src).toContain('return originals.finalizar.apply(this, args)');
    expect(src).toContain('window.imprimirCaixa = finalizarProtegido');
    expect(src).toContain('window.confirmarFechamentoG = finalizarProtegido');
  });

  it('bloqueia alterações da comanda enquanto a conta aguarda pagamento', () => {
    const src = read('client/public/staged-checkout-v1.js');
    expect(src).toContain('Use “Reabrir conta” antes de alterar a comanda.');
    expect(src).toContain("['adicionarItemG','alterarQtdG','editarObsG','limparComandaG','enviarProducaoG','atualizarNomeClienteG']");
    expect(src).toContain("['adicionarProduto','alterarQtdItem','editarObsItem','editarPrecoItem','transferirMesa','enviarProducaoCompletaPdv','atualizarNomeCliente']");
  });

  it('mantém as mesas existentes compatíveis sem migração ou reescrita em massa', () => {
    const src = read('client/public/staged-checkout-v1.js');
    expect(src).not.toContain("database:set /mesas");
    expect(src).not.toContain("db.ref('mesas').set");
    expect(src).not.toContain("db.ref('mesas').update");
    expect(src).toContain('estadoConta === STATUS');
  });

  it('carrega o módulo nos dois PWAs depois das proteções de concorrência e cancelamento', () => {
    const pdv = read('client/public/pdv/service-worker.js');
    const garcom = read('client/public/garcom/service-worker.js');
    for (const sw of [pdv, garcom]) {
      expect(sw).toContain("STAGED_CHECKOUT_ASSET = '/staged-checkout-v1.js?v=1'");
      expect(sw).toContain('<script src="/staged-checkout-v1.js?v=1"></script>');
      expect(sw.indexOf('ITEM_CANCELLATION_ASSET')).toBeLessThan(sw.indexOf('STAGED_CHECKOUT_ASSET'));
    }
    expect(pdv).toContain('staged-v35');
    expect(garcom).toContain('staged-v22');
  });

  it('mostra ações explícitas de reabrir e finalizar sem liberar no primeiro fechamento', () => {
    const src = read('client/public/staged-checkout-v1.js');
    expect(src).toContain('CONTA FECHADA · AGUARDANDO PAGAMENTO');
    expect(src).toContain('↩ Reabrir conta');
    expect(src).toContain('✅ Finalizar pagamento');
    expect(src).toContain('A mesa NÃO foi liberada e a venda ainda NÃO foi registrada.');
  });
});
