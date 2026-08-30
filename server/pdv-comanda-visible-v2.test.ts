import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('comanda sempre visível no PDV', () => {
  it('cria painel operacional independente da área antiga que estava colapsando', () => {
    const src = read('client/public/pdv/comanda-visible-v2.js');
    expect(src).toContain("PDV_COMANDA_VISIBLE_RUNTIME === 'v2'");
    expect(src).toContain("const PANEL_ID = 'pdv-comanda-visible-v2'");
    expect(src).toContain('.order-panel #order-items{display:none!important}');
    expect(src).toContain("orderPanel.insertBefore(painel, footer)");
    expect(src).toContain('Itens da Mesa ${numero}');
  });

  it('renderiza nome, quantidade, preço, subtotal, observação e estado de envio', () => {
    const src = read('client/public/pdv/comanda-visible-v2.js');
    expect(src).toContain("nome.textContent = `${qtd}x ${String(item.nome || 'Item')}`");
    expect(src).toContain('Unit.: ${formatar(preco)}');
    expect(src).toContain("item.enviado === true ? '✅ Enviado' : '🆕 Pendente'");
    expect(src).toContain('Obs.: ${item.obs}');
    expect(src).toContain('Subtotal: ${formatar(preco * qtd)}');
  });

  it('mantém os controles operacionais do caixa na nova lista', () => {
    const src = read('client/public/pdv/comanda-visible-v2.js');
    expect(src).toContain('alterarQtdItem(item.id, index, -1)');
    expect(src).toContain('alterarQtdItem(item.id, index, 1)');
    expect(src).toContain('editarObsItem(index)');
    expect(src).toContain('editarPrecoItem(index)');
  });

  it('acompanha renderizações e mudanças do Firebase', () => {
    const src = read('client/public/pdv/comanda-visible-v2.js');
    expect(src).toContain('renderizarComanda = envolvida');
    expect(src).toContain("db.ref('mesas').on('value'");
    expect(src).toContain('MutationObserver');
  });

  it('service worker publica e injeta a nova camada depois dos demais complementos', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain('visible-v40');
    expect(sw).toContain("const COMANDA_VISIBLE_ASSET = '/pdv/comanda-visible-v2.js?v=2'");
    expect(sw).toContain('COMANDA_VISIBLE_ASSET');
    expect(sw).toContain('<script src="/pdv/comanda-visible-v2.js?v=2"></script>');
    expect(sw.lastIndexOf('/pwa-live-update.js?v=1')).toBeLessThan(sw.lastIndexOf('/pdv/comanda-visible-v2.js?v=2'));
  });
});
