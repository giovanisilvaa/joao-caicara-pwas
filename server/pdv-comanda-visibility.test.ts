import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('visibilidade da comanda no PDV', () => {
  it('mantém uma área mínima rolável para a lista de itens', () => {
    const css = read('client/public/pdv/modern-hybrid.css');
    expect(css).toContain('flex:1 1 220px!important');
    expect(css).toContain('min-height:180px!important');
    expect(css).toContain('overflow-y:auto!important');
    expect(css).toContain('max-height:52vh');
  });

  it('continua renderizando nome, quantidade e subtotal de cada item da mesa', () => {
    const html = read('client/public/pdv/index.html');
    expect(html).toContain('dadosMesa.itens.forEach((item, index) =>');
    expect(html).toContain('<div class="item-name">${item.nome}</div>');
    expect(html).toContain('<span>${item.qtd}</span>');
    expect(html).toContain('${formatarMoeda(sub)}');
  });
});
