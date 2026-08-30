import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('kids, observacao e meio prato nos dois sistemas', () => {
  it('usa 60% para pratos que servem duas pessoas e para a categoria Festival', () => {
    const modulo = read('client/public/menu-order-options.js');
    expect(modulo).toContain('const HALF_RATIO = 0.60');
    expect(modulo).toContain('Math.round((Number(produto?.preco) || 0) * HALF_RATIO * 100) / 100');
    expect(modulo).toContain('function permiteMeioPrato(produto)');
    expect(modulo).toContain("return Boolean(produto?.servePara2) || String(produto?.categoria || '').trim().toLowerCase() === 'festival'");
    expect(modulo).toContain("if (!permiteMeioPrato(produto)) throw new Error('Este produto não permite meio prato.')");
    expect(modulo).toContain('personalizado.meioPrato = true');
    expect(modulo).toContain('personalizado.percentualPreco = 60');
    expect(modulo).toContain("personalizado.nome = `${produto.nome} (Meio prato)`");
  });

  it('oferece observacao para qualquer item e preserva observacoes diferentes em linhas separadas', () => {
    const modulo = read('client/public/menu-order-options.js');
    expect(modulo).toContain('Observação do item');
    expect(modulo).toContain('Copo com gelo e limão');
    expect(modulo).toContain('data-menu-action="obs"');
    expect(modulo).toContain('__obs_${Date.now()}_');
    expect(modulo).toContain('window.MesaAtomic.atualizarItem');
  });

  it('semeia exemplos kids editaveis no cardapio compartilhado', () => {
    const modulo = read('client/public/menu-order-options.js');
    expect(modulo).toContain("const KIDS_CATEGORY = 'kids'");
    expect(modulo).toContain('Kids Frango Grelhado com Fritas');
    expect(modulo).toContain('Kids Peixe Grelhado com Arroz');
    expect(modulo).toContain('Kids Isca de Peixe com Fritas');
    expect(modulo).toContain('Kids Macarrão ao Molho');
    expect(modulo).toContain('categoria: KIDS_CATEGORY');
    expect(modulo).toContain("db.ref('cardapio')");
  });

  it('inclui categoria Kids no cardapio e no gerenciador do PDV', () => {
    const modulo = read('client/public/menu-order-options.js');
    expect(modulo).toContain("tab.textContent = '🧒 Kids'");
    expect(modulo).toContain('novo-prod-categoria');
    expect(modulo).toContain('option[value="kids"]');
    expect(modulo).toContain('lista-admin-cardapio');
  });

  it('carrega a mesma regra depois da concorrencia no PDV e no Garcom', () => {
    const pdv = read('client/public/pdv/service-worker.js');
    const garcom = read('client/public/garcom/service-worker.js');

    expect(pdv).toContain("MENU_ORDER_OPTIONS_ASSET = '/menu-order-options.js?v=1'");
    expect(garcom).toContain("MENU_ORDER_OPTIONS_ASSET = '/menu-order-options.js?v=1'");
    expect(pdv.indexOf('menu-order-options.js?v=1')).toBeGreaterThan(pdv.indexOf('mesa-concurrency.js?v=40'));
    expect(garcom.indexOf('menu-order-options.js?v=1')).toBeGreaterThan(garcom.indexOf('mesa-concurrency.js?v=36'));
    expect(pdv).toContain('<script src="/menu-order-options.js?v=1"></script>');
    expect(garcom).toContain('<script src="/menu-order-options.js?v=1"></script>');
  });

  it('mantem observacao impressa na producao', () => {
    const pdvProd = read('client/public/pdv/pdv-production.js');
    const garcom = read('client/public/garcom/mesa-concurrency.js');
    expect(pdvProd).toContain('item.obs');
    expect(garcom).toContain('itens: lista');
  });
});
