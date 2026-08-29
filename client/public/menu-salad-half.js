/* Meia salada — reutiliza o fluxo compartilhado de meio prato com preço de 60%. */
(() => {
  if (window.MENU_SALAD_HALF_RUNTIME === 'v1') return;
  window.MENU_SALAD_HALF_RUNTIME = 'v1';

  const SALAD_CATEGORY = 'saladas';
  const HALF_RATIO = 0.60;
  let decoracaoAgendada = false;

  const moeda = valor => {
    try {
      if (typeof formatarMoeda === 'function') return formatarMoeda(Number(valor) || 0);
    } catch (_) {}
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
  };

  function listaProdutos() {
    try {
      return Array.isArray(produtos) ? produtos.filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function produtoPorId(id) {
    return listaProdutos().find(item => String(item?.id) === String(id)) || null;
  }

  function ehSalada(produto) {
    return produto?.categoria === SALAD_CATEGORY;
  }

  function precoMeiaSalada(produto) {
    try {
      if (window.MenuOrderOptions?.precoMeio) return window.MenuOrderOptions.precoMeio(produto);
    } catch (_) {}
    return Math.round((Number(produto?.preco) || 0) * HALF_RATIO * 100) / 100;
  }

  function idProdutoDoCard(card) {
    if (card?.dataset?.produtoId) return card.dataset.produtoId;
    const onclick = card?.getAttribute?.('onclick') || '';
    const match = onclick.match(/(?:adicionarProduto|adicionarItemG)\(([^)]+)\)/);
    return match ? String(match[1]).replace(/['"]/g, '').trim() : '';
  }

  function abrirMeiaSalada(produto) {
    if (!ehSalada(produto)) return;
    if (!window.MenuOrderOptions?.abrirOpcoes) {
      alert('As opções do cardápio ainda estão carregando. Tente novamente em instantes.');
      return;
    }

    // O módulo original habilita meio prato por `servePara2`. Para a salada usamos
    // uma cópia somente da interface, sem alterar o produto cadastrado no Firebase.
    const produtoCompat = {
      ...produto,
      servePara2: true,
      meiaSaladaPermitida: true,
      servePara2Original: produto.servePara2 === true
    };

    window.MenuOrderOptions.abrirOpcoes(produtoCompat, true);

    requestAnimationFrame(() => {
      const modal = document.getElementById('menu-order-options-modal');
      if (!modal?.classList.contains('open')) return;

      const titulo = modal.querySelector('#menu-order-title');
      const preco = modal.querySelector('#menu-order-price');
      const modos = modal.querySelector('#menu-order-modes');
      if (titulo) titulo.textContent = `${produto.nome} — Meia salada`;
      if (preco) preco.textContent = `${moeda(precoMeiaSalada(produto))} · 60% da salada normal`;
      if (modos) {
        modos.style.display = 'flex';
        modos.innerHTML = '<button type="button" class="active" disabled>½ Meia salada · 60%</button>';
      }
    });
  }

  function decorarCard(card) {
    if (!card || card.querySelector('[data-menu-salad-half]')) return;
    const produto = produtoPorId(idProdutoDoCard(card));
    if (!ehSalada(produto)) return;

    let acoes = card.querySelector('.menu-opt-actions');
    if (!acoes) {
      acoes = document.createElement('div');
      acoes.className = 'menu-opt-actions';
      card.appendChild(acoes);
    }

    const botao = document.createElement('span');
    botao.className = 'menu-opt-action menu-opt-half';
    botao.setAttribute('role', 'button');
    botao.setAttribute('tabindex', '0');
    botao.dataset.menuSaladHalf = '1';
    botao.dataset.produtoId = String(produto.id);
    botao.textContent = `½ Meia salada · ${moeda(precoMeiaSalada(produto))}`;
    acoes.appendChild(botao);
  }

  function decorarTudo() {
    decoracaoAgendada = false;
    document.querySelectorAll('#products-grid .product-card, #grid-produtos-g .prod-card-g').forEach(decorarCard);
  }

  function agendarDecoracao() {
    if (decoracaoAgendada) return;
    decoracaoAgendada = true;
    requestAnimationFrame(decorarTudo);
  }

  document.addEventListener('click', event => {
    const alvo = event.target instanceof Element ? event.target.closest('[data-menu-salad-half]') : null;
    if (!alvo) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    abrirMeiaSalada(produtoPorId(alvo.dataset.produtoId));
  }, true);

  document.addEventListener('keydown', event => {
    const alvo = event.target instanceof Element ? event.target.closest('[data-menu-salad-half]') : null;
    if (!alvo || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    alvo.click();
  });

  const observer = new MutationObserver(agendarDecoracao);
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', decorarTudo, { once: true });
  else decorarTudo();

  window.MenuSaladHalf = Object.freeze({
    SALAD_CATEGORY,
    HALF_RATIO,
    ehSalada,
    precoMeiaSalada,
    abrirMeiaSalada,
    decorar: agendarDecoracao
  });
})();
