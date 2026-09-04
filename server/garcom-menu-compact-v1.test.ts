import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const js = fs.readFileSync('client/public/garcom/menu-compact-v1.js', 'utf8');
const css = fs.readFileSync('client/public/garcom/menu-compact-v1.css', 'utf8');
const sw = fs.readFileSync('client/public/garcom/service-worker.js', 'utf8');

describe('cardápio compacto do Garçom', () => {
  it('cria barra móvel curta reutilizando voltar e status originais', () => {
    expect(js).toContain("barra.id = 'garcom-menu-compact-bar'");
    expect(js).toContain("voltarOriginal?.click()");
    expect(js).toContain("statusOriginal?.click()");
    expect(js).toContain("'🟢 Online'");
    expect(css).toContain('body.garcom-menu-compact-active .header{display:none!important}');
  });

  it('mantém cliente disponível, mas recolhido por padrão', () => {
    expect(js).toContain("tela.classList.toggle('garcom-client-edit-open', abrir)");
    expect(js).toContain("inputCliente?.focus()");
    expect(css).toContain('#tela-pedido>.cliente-row');
    expect(css).toContain('#tela-pedido.garcom-client-edit-open>.cliente-row');
  });

  it('substitui a faixa extensa de tabs por Favoritos e seletor de categorias', () => {
    expect(js).toContain("linha.id = 'garcom-menu-category-row'");
    expect(js).toContain('⭐ Favoritos');
    expect(js).toContain("tabs.querySelectorAll('.tab-g')");
    expect(js).toContain('original.click()');
    expect(css).toContain('body.garcom-menu-compact-active #tabs-g');
  });

  it('prioriza busca e esconde controles secundários durante pesquisa', () => {
    expect(css).toContain('body.garcom-menu-compact-active #busca-produto-g');
    expect(css).toContain('#tela-pedido.speed-search-mode #garcom-menu-category-row');
    expect(css).toContain('body.garcom-menu-compact-active #speed-hint');
    expect(css).toContain('body.garcom-menu-compact-active #garcom-responsavel-comanda');
  });

  it('compacta cards sem ocultar o nome no Safari', () => {
    expect(css).toContain('min-height:78px!important');
    expect(css).toContain('display:block!important');
    expect(css).toContain('overflow:visible!important');
    expect(css).toContain('-webkit-line-clamp:unset!important');
    expect(css).toContain('-webkit-box-orient:unset!important');
    expect(css).toContain('.menu-opt-actions');
  });

  it('mantém comanda fixa e reduz apenas a altura dos controles', () => {
    expect(css).toContain('.comanda-fixa-container');
    expect(css).toContain('#comanda-toggle');
    expect(css).toContain('.acoes-comanda-g');
    expect(css).not.toContain('.comanda-fixa-container{display:none');
  });

  it('é somente uma camada visual sem acesso aos dados operacionais', () => {
    expect(js).not.toContain('firebase');
    expect(js).not.toContain('db.ref');
    expect(js).not.toContain('pedidosProducao');
    expect(js).not.toContain('vendas/');
    expect(js).not.toContain('mesas/');
    expect(js).not.toContain('window.print');
    expect(js).not.toContain('salvarMesas');
    expect(js).not.toContain('enviarProducaoG');
  });

  it('é distribuído pelo PWA em cache próprio', () => {
    expect(sw).toContain('search-focus-v35-menu-clean-v36');
    expect(sw).toContain('MENU_COMPACT_CSS_ASSET');
    expect(sw).toContain('MENU_COMPACT_JS_ASSET');
    expect(sw).toContain("if (!html.includes('/garcom/menu-compact-v1.css'))");
    expect(sw).toContain("if (!html.includes('/garcom/menu-compact-v1.js'))");
  });
});
