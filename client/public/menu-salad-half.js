/* Meio prato por categoria — saladas e aperitivos a 60%, sem alterar o cadastro no Firebase. */
(() => {
  if (window.MENU_SALAD_HALF_RUNTIME === 'v2') return;
  window.MENU_SALAD_HALF_RUNTIME = 'v2';

  const SALAD_CATEGORY = 'saladas';
  const APPETIZER_CATEGORY = 'aperitivos';
  const HALF_CATEGORIES = Object.freeze([SALAD_CATEGORY, APPETIZER_CATEGORY]);
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

  function categoriaPermiteMeio(produto) {
    return HALF_CATEGORIES.includes(String(produto?.categoria || ''));
  }

  function ehSalada(produto) {
    return produto?.categoria === SALAD_CATEGORY;
  }

  function ehAperitivo(produto) {
    return produto?.categoria === APPETIZER_CATEGORY;
  }

  function precoMeioCategoria(produto) {
    try {
      if (window.MenuOrderOptions?.precoMeio) return window.MenuOrderOptions.precoMeio(produto);
    } catch (_) {}
    return Math.round((Number(produto?.preco) || 0) * HALF_RATIO * 100) / 100;
  }

  // Compatibilidade com a API criada para saladas na versão anterior.
  const precoMeiaSalada = precoMeioCategoria;

  function rotulos(produto) {
    if (ehSalada(produto)) {
      return {
        botao: '½ Meia salada',
        titulo: 'Meia salada',
        detalhe: '60% da salada normal'
      };
    }
    return {
      botao: '½ Meio prato',
      titulo: 'Meio prato',
      detalhe: '60% do aperitivo normal'
    };
  }

  function idProdutoDoCard(card) {
    if (card?.dataset?.produtoId) return card.dataset.produtoId;
    const onclick = card?.getAttribute?.('onclick') || '';
    const match = onclick.match(/(?:adicionarProduto|adicionarItemG)\(([^)]+)\)/);
    return match ? String(match[1]).replace(/['"]/g, '').trim() : '';
  }

  function abrirMeioCategoria(produto) {
    if (!categoriaPermiteMeio(produto)) return;
    if (!window.MenuOrderOptions?.abrirOpcoes) {
      alert('As opções do cardápio ainda estão carregando. Tente novamente em instantes.');
      return;
    }

    // O fluxo compartilhado habilita meio prato por `servePara2`. Para saladas e
    // aperitivos que não usam essa flag, enviamos uma cópia apenas da interface.
    // O produto original no Firebase permanece intacto.
    const produtoCompat = {
      ...produto,
      servePara2: true,
      meioCategoriaPermitido: true,
      meiaSaladaPermitida: ehSalada(produto),
      meioAperitivoPermitido: ehAperitivo(produto),
      servePara2Original: produto.servePara2 === true
    };

    window.MenuOrderOptions.abrirOpcoes(produtoCompat, true);

    requestAnimationFrame(() => {
      const modal = document.getElementById('menu-order-options-modal');
      if (!modal?.classList.contains('open')) return;

      const texto = rotulos(produto);
      const titulo = modal.querySelector('#menu-order-title');
      const preco = modal.querySelector('#menu-order-price');
      const modos = modal.querySelector('#menu-order-modes');
      if (titulo) titulo.textContent = `${produto.nome} — ${texto.titulo}`;
      if (preco) preco.textContent = `${moeda(precoMeioCategoria(produto))} · ${texto.detalhe}`;
      if (modos) {
        modos.style.display = 'flex';
        modos.innerHTML = `<button type="button" class="active" disabled>${texto.botao} · 60%</button>`;
      }
    });
  }

  const abrirMeiaSalada = abrirMeioCategoria;

  function decorarCard(card) {
    if (!card || card.querySelector('[data-menu-category-half]')) return;
    const produto = produtoPorId(idProdutoDoCard(card));
    if (!categoriaPermiteMeio(produto)) return;

    // Produtos que já são "servePara2" recebem o botão de meio prato do módulo
    // compartilhado. Não criamos um segundo botão para o mesmo produto.
    if (produto.servePara2 === true && card.querySelector('[data-menu-action="half"]')) return;

    let acoes = card.querySelector('.menu-opt-actions');
    if (!acoes) {
      acoes = document.createElement('div');
      acoes.className = 'menu-opt-actions';
      card.appendChild(acoes);
    }

    const texto = rotulos(produto);
    const botao = document.createElement('span');
    botao.className = 'menu-opt-action menu-opt-half';
    botao.setAttribute('role', 'button');
    botao.setAttribute('tabindex', '0');
    botao.dataset.menuCategoryHalf = '1';
    // Mantém o atributo anterior para compatibilidade com instalações já abertas.
    if (ehSalada(produto)) botao.dataset.menuSaladHalf = '1';
    if (ehAperitivo(produto)) botao.dataset.menuAppetizerHalf = '1';
    botao.dataset.produtoId = String(produto.id);
    botao.textContent = `${texto.botao} · ${moeda(precoMeioCategoria(produto))}`;
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
    const alvo = event.target instanceof Element ? event.target.closest('[data-menu-category-half]') : null;
    if (!alvo) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    abrirMeioCategoria(produtoPorId(alvo.dataset.produtoId));
  }, true);

  document.addEventListener('keydown', event => {
    const alvo = event.target instanceof Element ? event.target.closest('[data-menu-category-half]') : null;
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
    APPETIZER_CATEGORY,
    HALF_CATEGORIES,
    HALF_RATIO,
    categoriaPermiteMeio,
    ehSalada,
    ehAperitivo,
    precoMeioCategoria,
    precoMeiaSalada,
    abrirMeioCategoria,
    abrirMeiaSalada,
    decorar: agendarDecoracao
  });
})();
