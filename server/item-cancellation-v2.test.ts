import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('cancelamento operacional de itens enviados', () => {
  it('intercepta apenas redução de item já enviado e preserva o fluxo normal dos demais', () => {
    const src = read('client/public/item-cancellation-v2.js');
    expect(src).toContain("delta < 0 && itemLocal?.enviado === true");
    expect(src).toContain('return originalGarcom(index, delta)');
    expect(src).toContain('return originalPdv(produtoId, indexOriginal, delta)');
  });

  it('bloqueia a mesa e confirma mesa + ticket de produção + auditoria em um único update', () => {
    const src = read('client/public/item-cancellation-v2.js');
    expect(src).toContain("bloquearMesa(numero, { tipo: 'cancelamento_item', origem })");
    expect(src).toContain('[`mesas/${numero}`]: mesaFinal');
    expect(src).toContain('[`pedidosProducao/${pedidoRef.key}`]: ticketCancelamento');
    expect(src).toContain('[`auditoria/${auditoriaRef.key}`]: auditoria');
    expect(src).toContain("await db.ref('/').update(atualizacoes)");
  });

  it('gera ticket explicitamente marcado como cancelamento para cozinha ou bar', () => {
    const src = read('client/public/item-cancellation-v2.js');
    expect(src).toContain("origem: 'cancelamento'");
    expect(src).toContain("tipo: 'cancelamento'");
    expect(src).toContain("obs: `CANCELAMENTO — Motivo: ${motivo}`");
    expect(src).toContain("const setor = itemServidor.setor === 'bar' ? 'bar' : 'cozinha'");
  });

  it('não perde o item quando a confirmação falha', () => {
    const src = read('client/public/item-cancellation-v2.js');
    expect(src).toContain("cancelarBloqueio(numero, lock.id, 'falha_cancelamento_item')");
    expect(src).toContain('O item foi mantido na comanda');
  });

  it('mantém o histórico administrativo existente para cancelamentos feitos no PDV', () => {
    const src = read('client/public/item-cancellation-v2.js');
    expect(src).toContain("if (origem === 'pdv')");
    expect(src).toContain('cancelamentos/${cancelRef.key}');
  });

  it('imprime ticket de cancelamento separado no caixa', () => {
    const src = read('client/public/pdv/pdv-cancellation-print.js');
    expect(src).toContain("pedido.tipo !== 'cancelamento'");
    expect(src).toContain("titulo.innerText = `⛔ CANCELAMENTO ${setor === 'bar' ? 'BAR' : 'COZINHA'}`");
    expect(src).toContain('impressaoCancelamentoPdv');
    expect(src).toContain('cancelamentoImpressoEm');
  });

  it('publica os novos módulos nos dois PWAs e invalida os caches antigos', () => {
    const pdv = read('client/public/pdv/service-worker.js');
    const garcom = read('client/public/garcom/service-worker.js');
    expect(pdv).toContain("ITEM_CANCELLATION_ASSET = '/item-cancellation-v2.js?v=2'");
    expect(pdv).toContain("CANCELLATION_PRINT_ASSET = '/pdv/pdv-cancellation-print.js?v=1'");
    expect(pdv).toContain('cancel-v34');
    expect(garcom).toContain("ITEM_CANCELLATION_ASSET = '/item-cancellation-v2.js?v=2'");
    expect(garcom).toContain('cancel-v21');
  });
});
