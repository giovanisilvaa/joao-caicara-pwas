import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('meio prato por categoria a 60%', () => {
  it('autoriza somente saladas e aperitivos e mantém 60% do preço normal', () => {
    const modulo = read('client/public/menu-salad-half.js');
    expect(modulo).toContain("const SALAD_CATEGORY = 'saladas'");
    expect(modulo).toContain("const APPETIZER_CATEGORY = 'aperitivos'");
    expect(modulo).toContain('const HALF_CATEGORIES = Object.freeze([SALAD_CATEGORY, APPETIZER_CATEGORY])');
    expect(modulo).toContain('const HALF_RATIO = 0.60');
    expect(modulo).toContain("HALF_CATEGORIES.includes(String(produto?.categoria || ''))");
    expect(modulo).toContain('Math.round((Number(produto?.preco) || 0) * HALF_RATIO * 100) / 100');
  });

  it('mantém rótulo de meia salada e usa meio prato nos aperitivos', () => {
    const modulo = read('client/public/menu-salad-half.js');
    expect(modulo).toContain("botao: '½ Meia salada'");
    expect(modulo).toContain("detalhe: '60% da salada normal'");
    expect(modulo).toContain("botao: '½ Meio prato'");
    expect(modulo).toContain("detalhe: '60% do aperitivo normal'");
    expect(modulo).toContain("botao.dataset.menuAppetizerHalf = '1'");
  });

  it('reutiliza o fluxo já testado de meio prato sem alterar o cadastro no Firebase', () => {
    const modulo = read('client/public/menu-salad-half.js');
    expect(modulo).toContain('window.MenuOrderOptions.abrirOpcoes(produtoCompat, true)');
    expect(modulo).toContain('servePara2: true');
    expect(modulo).toContain('meioCategoriaPermitido: true');
    expect(modulo).toContain('meiaSaladaPermitida: ehSalada(produto)');
    expect(modulo).toContain('meioAperitivoPermitido: ehAperitivo(produto)');
    expect(modulo).not.toContain("db.ref('cardapio')");
    expect(modulo).not.toContain('.set(');
    expect(modulo).not.toContain('.update(');
    expect(modulo).not.toContain('.transaction(');
  });

  it('evita duplicar botão quando o produto já recebe meio prato por servePara2', () => {
    const modulo = read('client/public/menu-salad-half.js');
    expect(modulo).toContain("produto.servePara2 === true && card.querySelector('[data-menu-action=\"half\"]')");
  });

  it('é carregado na versão 2 depois das opções compartilhadas no PDV e no Garçom', () => {
    const pdv = read('client/public/pdv/service-worker.js');
    const garcom = read('client/public/garcom/service-worker.js');
    for (const sw of [pdv, garcom]) {
      expect(sw).toContain("const SALAD_HALF_ASSET = '/menu-salad-half.js?v=2'");
      expect(sw).toContain('SALAD_HALF_ASSET');
      expect(sw).toContain('<script src="/menu-salad-half.js?v=2"></script>');
      expect(sw.indexOf('MENU_ORDER_OPTIONS_ASSET')).toBeLessThan(sw.indexOf('SALAD_HALF_ASSET'));
    }
  });

  it('não estende a regra para veganos/vegetarianos individuais nem outras categorias', () => {
    const modulo = read('client/public/menu-salad-half.js');
    expect(modulo).not.toContain("veganos_vegetarianos");
    expect(modulo).not.toContain('KIDS_CATEGORY');
  });
});
