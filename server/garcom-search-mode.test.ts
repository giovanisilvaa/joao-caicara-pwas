import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const js = fs.readFileSync('client/public/garcom/waiter-speed.js', 'utf8');
const css = fs.readFileSync('client/public/garcom/waiter-speed.css', 'utf8');

describe('modo de busca focado do Garçom', () => {
  it('entra no modo busca ao focar ou digitar e sai ao limpar', () => {
    expect(js).toContain("painelPedidoBusca.classList.toggle('speed-search-mode', ativo)");
    expect(js).toContain("busca.addEventListener('focus'");
    expect(js).toContain("busca.addEventListener('blur'");
    expect(js).toContain("busca.addEventListener('input'");
    expect(js).toContain("busca.setAttribute('type', 'search')");
  });

  it('mantém a busca existente em todos os produtos ativos', () => {
    expect(js).toContain('produtos.filter(produtoAtivo).filter');
    expect(js).toContain('nome.includes(busca) || categoria.includes(busca)');
    expect(js).toContain('renderizarBuscaRapida(busca.value)');
    expect(js).toContain('<h4>${p.nome}</h4>');
  });

  it('sai do modo busca ao trocar categoria ou selecionar outra mesa', () => {
    expect(js).toContain('const filtrarCardapioOriginal = window.filtrarCardapioG');
    expect(js).toContain('window.filtrarCardapioG = function filtrarCardapioComSaidaBusca()');
    expect(js).toContain('buscaComFoco = false');
    expect(js).toContain('atualizarModoBusca()');
  });

  it('recolhe a comanda aberta somente ao entrar na pesquisa', () => {
    expect(js).toContain("toggle?.getAttribute('aria-expanded') !== 'true'");
    expect(js).toContain("if (typeof toggleComanda === 'function') toggleComanda()");
    expect(js).toContain('if (ativo && !modoBuscaAtivo) recolherComandaAoPesquisar()');
  });

  it('oculta apenas informações secundárias durante a busca', () => {
    expect(css).toContain('#tela-pedido.speed-search-mode>.cliente-row');
    expect(css).toContain('#tela-pedido.speed-search-mode #tabs-g');
    expect(css).toContain('#tela-pedido.speed-search-mode #speed-hint');
    expect(css).toContain('#tela-pedido.speed-search-mode #sushi-subfilters');
    expect(css).toContain('display:none!important');
    expect(css).not.toContain('#tela-pedido.speed-search-mode .comanda-fixa-container{display:none');
  });

  it('compacta apenas os resultados da pesquisa sem voltar a duas colunas', () => {
    expect(css).toContain('#tela-pedido.speed-search-mode #grid-produtos-g .speed-product');
    expect(css).toContain('min-height:84px!important');
    expect(css).toContain('#tela-pedido.speed-search-mode #grid-produtos-g .speed-add');
    expect(css).toContain('grid-template-columns:1fr!important');
    expect(css).not.toContain('grid-template-columns:repeat(2,minmax(0,1fr))!important');
  });

  it('mantém o nome do produto visível no Safari/iPhone durante a busca', () => {
    const inicio = css.indexOf('#tela-pedido.speed-search-mode #grid-produtos-g .prod-card-g h4');
    const fim = css.indexOf('#tela-pedido.speed-search-mode #grid-produtos-g .prod-card-g p', inicio);
    const regraNome = css.slice(inicio, fim);
    expect(regraNome).toContain('display:block!important');
    expect(regraNome).toContain('white-space:normal!important');
    expect(regraNome).toContain('overflow:visible!important');
    expect(regraNome).toContain('color:#133C4A!important');
    expect(regraNome).not.toContain('-webkit-line-clamp');
    expect(regraNome).not.toContain('-webkit-box-orient');
  });

  it('preserva as proteções de viewport e a comanda fixa', () => {
    expect(css).toContain('height:100dvh!important');
    expect(css).toContain('overflow:hidden!important');
    expect(css).toContain('-webkit-overflow-scrolling:touch');
    expect(css).toContain('.comanda-fixa-container{position:absolute!important;left:0;right:0;bottom:0;z-index:30}');
  });

  it('não adiciona acesso ao Firebase ou nova lógica operacional na busca', () => {
    const trechoModoBusca = js.slice(js.indexOf('const busca = document.getElementById'), js.indexOf('const adicionarOriginal'));
    expect(trechoModoBusca).not.toContain('firebase');
    expect(trechoModoBusca).not.toContain('database.ref');
    expect(trechoModoBusca).not.toContain('salvarMesas');
    expect(trechoModoBusca).not.toContain('adicionarItemG(');
  });
});
