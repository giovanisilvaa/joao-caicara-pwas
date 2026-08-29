import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('meia salada a 60%', () => {
  it('limita a regra à categoria saladas e mantém 60% do preço normal', () => {
    const modulo = read('client/public/menu-salad-half.js');
    expect(modulo).toContain("const SALAD_CATEGORY = 'saladas'");
    expect(modulo).toContain('const HALF_RATIO = 0.60');
    expect(modulo).toContain('produto?.categoria === SALAD_CATEGORY');
    expect(modulo).toContain('Math.round((Number(produto?.preco) || 0) * HALF_RATIO * 100) / 100');
    expect(modulo).toContain('60% da salada normal');
  });

  it('reutiliza o fluxo já testado de meio prato sem alterar o cadastro no Firebase', () => {
    const modulo = read('client/public/menu-salad-half.js');
    expect(modulo).toContain('window.MenuOrderOptions.abrirOpcoes(produtoCompat, true)');
    expect(modulo).toContain('servePara2: true');
    expect(modulo).toContain('meiaSaladaPermitida: true');
    expect(modulo).not.toContain("db.ref('cardapio')");
    expect(modulo).not.toContain('.set(');
    expect(modulo).not.toContain('.update(');
    expect(modulo).not.toContain('.transaction(');
  });

  it('mostra botão específico apenas nas saladas e mantém observação pelo modal compartilhado', () => {
    const modulo = read('client/public/menu-salad-half.js');
    expect(modulo).toContain("botao.dataset.menuSaladHalf = '1'");
    expect(modulo).toContain('½ Meia salada');
    expect(modulo).toContain("document.getElementById('menu-order-options-modal')");
    expect(modulo).toContain('½ Meia salada · 60%');
  });

  it('é carregado depois das opções compartilhadas no PDV e no Garçom', () => {
    const pdv = read('client/public/pdv/service-worker.js');
    const garcom = read('client/public/garcom/service-worker.js');
    for (const sw of [pdv, garcom]) {
      expect(sw).toContain("const SALAD_HALF_ASSET = '/menu-salad-half.js?v=1'");
      expect(sw).toContain('SALAD_HALF_ASSET');
      expect(sw).toContain('<script src="/menu-salad-half.js?v=1"></script>');
      expect(sw.indexOf('MENU_ORDER_OPTIONS_ASSET')).toBeLessThan(sw.indexOf('SALAD_HALF_ASSET'));
    }
  });

  it('não estende a regra para veganos/vegetarianos individuais', () => {
    const modulo = read('client/public/menu-salad-half.js');
    expect(modulo).not.toContain("veganos_vegetarianos");
    expect(modulo).not.toContain('individual');
  });
});
