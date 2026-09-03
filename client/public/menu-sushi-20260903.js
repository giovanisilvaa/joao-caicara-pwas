/* Sushi João Caiçara — categoria isolada, subfiltros e detalhes, sem alterar regras operacionais. */
(() => {
  if (window.JOAO_CAICARA_SUSHI_RUNTIME === 'v1') return;
  window.JOAO_CAICARA_SUSHI_RUNTIME = 'v1';

  const CATALOGO_URL = '/sushi-menu-20260903.json?v=1';
  const CATEGORIA = 'sushi';
  const ehPdv = location.pathname.startsWith('/pdv/');
  const ehGarcom = location.pathname.startsWith('/garcom/');
  let catalogo = null;
  let grupoAtual = 'todos';
  let agendado = false;

  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caractere]));

  function listaProdutos() {
    try { return Array.isArray(produtos) ? produtos.filter(Boolean) : []; } catch (_) { return []; }
  }

  function produtoPorId(id) {
    return listaProdutos().find(item => String(item?.id) === String(id)) ||
      catalogo?.items?.find(item => String(item?.id) === String(id)) || null;
  }

  function categoriaSelecionada() {
    try { return String(categoriaAtual || ''); } catch (_) { return ''; }
  }

  function idProdutoDoCard(card) {
    if (card?.dataset?.produtoId) return card.dataset.produtoId;
    const onclick = card?.getAttribute?.('onclick') || '';
    const match = onclick.match(/(?:adicionarProduto|adicionarItemG)\(([^)]+)\)/);
    return match ? String(match[1]).replace(/['"]/g, '').trim() : '';
  }

  function garantirEstilo() {
    if (document.getElementById('sushi-menu-style-20260903')) return;
    const style = document.createElement('style');
    style.id = 'sushi-menu-style-20260903';
    style.textContent = `
      .sushi-main-tab{font-weight:900!important}
      #sushi-subfilters{display:none;flex:0 0 auto;gap:7px;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;padding:8px 10px;background:#fff8f0;border-bottom:1px solid #ead7c3;scrollbar-width:thin;white-space:nowrap}
      #sushi-subfilters.open{display:flex}
      .sushi-subfilter{flex:0 0 auto;border:1px solid #dcc8b5;background:#fff;color:#123e48;border-radius:999px;min-height:34px;padding:6px 11px;font:800 .72rem/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;cursor:pointer}
      .sushi-subfilter.active{background:#0b5963;color:#fff;border-color:#0b5963;box-shadow:0 3px 9px rgba(11,89,99,.16)}
      .sushi-card-meta{display:block;margin-top:5px;color:#66787c;font-size:.7rem;font-weight:800;line-height:1.25}
      .sushi-info-actions{display:flex;justify-content:flex-start;margin-top:7px}
      .sushi-detail-link{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:6px 9px;border:1px solid #e4b091;border-radius:9px;background:#fff2e9;color:#9b482e;font-size:.7rem;font-weight:900;cursor:pointer;user-select:none}
      #sushi-detail-modal{display:none;position:fixed;inset:0;z-index:7000;background:rgba(8,45,51,.78);align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(4px)}
      #sushi-detail-modal.open{display:flex}
      .sushi-detail-box{width:min(520px,100%);max-height:88vh;overflow:auto;background:#fffdf8;border-radius:20px;padding:18px;box-shadow:0 24px 60px rgba(0,0,0,.28);color:#18383f}
      .sushi-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
      .sushi-detail-head h3{margin:0;color:#123e48;font-family:Georgia,'Times New Roman',serif;font-size:1.15rem;line-height:1.2}
      .sushi-detail-price{margin-top:4px;color:#d95d39;font-weight:900;font-size:1.05rem}
      .sushi-detail-close{flex:0 0 40px;width:40px;height:40px;border:0;border-radius:50%;background:#eef3f1;color:#123e48;font-size:1.35rem;cursor:pointer}
      .sushi-detail-section{padding:10px 0;border-top:1px solid #eee1d4}
      .sushi-detail-section:first-of-type{border-top:0}
      .sushi-detail-section strong{display:block;color:#0b5963;margin-bottom:6px}
      .sushi-detail-section ul{margin:0;padding-left:20px}
      .sushi-detail-section li{margin:4px 0;line-height:1.3}
      @media(max-width:600px){#sushi-subfilters{padding:7px 9px}.sushi-subfilter{min-height:36px;padding:7px 11px}.sushi-detail-box{max-height:92vh;border-radius:18px}.sushi-card-meta{font-size:.72rem}}
    `;
    document.head.appendChild(style);
  }

  function registrarCategoria() {
    try {
      if (!Array.isArray(categoriasCardapio)) return;
      if (!categoriasCardapio.some(item => item.key === CATEGORIA)) {
        categoriasCardapio.push({ key:CATEGORIA, label:catalogo.category.label });
      }
    } catch (_) {}
  }

  function aplicarFallback(lista) {
    if (!Array.isArray(lista) || !catalogo?.items?.length) return;
    const ids = new Set(lista.map(item => Number(item?.id)).filter(Number.isFinite));
    for (const item of catalogo.items) {
      if (!ids.has(Number(item.id))) {
        lista.push(JSON.parse(JSON.stringify(item)));
        ids.add(Number(item.id));
      }
    }
  }

  function garantirFallbacks() {
    try { if (typeof produtosPadrao !== 'undefined' && Array.isArray(produtosPadrao)) aplicarFallback(produtosPadrao); } catch (_) {}
    try { if (typeof produtos !== 'undefined' && Array.isArray(produtos)) aplicarFallback(produtos); } catch (_) {}
  }

  function encontrarTabPrincipal() {
    const raiz = ehPdv ? document.querySelector('.menu-panel .tabs') : document.getElementById('tabs-g');
    if (!raiz) return { raiz:null, tab:null };
    const existente = raiz.querySelector('[data-sushi-main-tab]') || [...raiz.querySelectorAll('button')].find(botao => {
      const onclick = botao.getAttribute('onclick') || '';
      return onclick.includes("'sushi'") || onclick.includes('"sushi"') || String(botao.textContent || '').trim() === catalogo?.category?.label;
    });
    return { raiz, tab:existente || null };
  }

  function selecionarSushi(tab) {
    grupoAtual = 'todos';
    try {
      if (ehPdv && typeof filtrarCardapio === 'function') filtrarCardapio(CATEGORIA);
      else if (ehGarcom && typeof filtrarCardapioG === 'function') filtrarCardapioG(CATEGORIA, tab);
      else {
        categoriaAtual = CATEGORIA;
        if (ehPdv && typeof renderizarCardapio === 'function') renderizarCardapio(CATEGORIA);
        if (ehGarcom && typeof renderizarProdutosG === 'function') renderizarProdutosG();
      }
    } catch (erro) { console.warn('Falha ao abrir categoria Sushi:', erro); }
    setTimeout(agendarSincronizacao, 0);
  }

  function garantirTabPrincipal() {
    if (!catalogo) return;
    let { raiz, tab } = encontrarTabPrincipal();
    if (!raiz) return;
    if (!tab) {
      tab = document.createElement('button');
      tab.type = 'button';
      tab.className = ehPdv ? 'tab sushi-main-tab' : 'tab-g sushi-main-tab';
      tab.textContent = catalogo.category.label;
      raiz.appendChild(tab);
    }
    tab.dataset.sushiMainTab = '1';
    tab.classList.add('sushi-main-tab');
    if (tab.dataset.sushiBound !== '1') {
      tab.dataset.sushiBound = '1';
      tab.addEventListener('click', event => {
        event.preventDefault();
        selecionarSushi(tab);
      });
    }
  }

  function garantirSubfiltros() {
    if (!catalogo) return null;
    const { raiz } = encontrarTabPrincipal();
    if (!raiz) return null;
    let barra = document.getElementById('sushi-subfilters');
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'sushi-subfilters';
      barra.setAttribute('aria-label', 'Filtros do cardápio Sushi');
      raiz.insertAdjacentElement('afterend', barra);
    }
    if (barra.dataset.ready !== catalogo.version) {
      barra.innerHTML = catalogo.groups.map(grupo => `<button type="button" class="sushi-subfilter${grupo.key === grupoAtual ? ' active' : ''}" data-sushi-group="${escapar(grupo.key)}">${escapar(grupo.label)}</button>`).join('');
      barra.dataset.ready = catalogo.version;
    }
    return barra;
  }

  function aplicarFiltroGrupo() {
    if (categoriaSelecionada() !== CATEGORIA) return;
    const seletor = ehPdv ? '#products-grid .product-card' : '#grid-produtos-g .prod-card-g';
    document.querySelectorAll(seletor).forEach(card => {
      const produto = produtoPorId(idProdutoDoCard(card));
      if (!produto || produto.categoria !== CATEGORIA) return;
      const mostrar = grupoAtual === 'todos' || produto.sushiGrupo === grupoAtual;
      card.style.display = mostrar ? '' : 'none';
    });
  }

  function garantirModal() {
    let modal = document.getElementById('sushi-detail-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'sushi-detail-modal';
    modal.innerHTML = '<div class="sushi-detail-box" role="dialog" aria-modal="true"><div class="sushi-detail-head"><div><h3 id="sushi-detail-title">Detalhes</h3><div class="sushi-detail-price" id="sushi-detail-price"></div></div><button type="button" class="sushi-detail-close" aria-label="Fechar">×</button></div><div id="sushi-detail-content"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.sushi-detail-close')) modal.classList.remove('open');
    });
    return modal;
  }

  function abrirDetalhes(id) {
    const produto = produtoPorId(id);
    if (!produto?.sushiDetalhes?.length) return;
    const modal = garantirModal();
    modal.querySelector('#sushi-detail-title').textContent = produto.nome;
    modal.querySelector('#sushi-detail-price').textContent = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(produto.preco) || 0);
    modal.querySelector('#sushi-detail-content').innerHTML = produto.sushiDetalhes.map(secao => `
      <section class="sushi-detail-section">
        <strong>${escapar(secao.titulo)}</strong>
        <ul>${(secao.linhas || []).map(linha => `<li>${escapar(linha)}</li>`).join('')}</ul>
      </section>`).join('');
    modal.classList.add('open');
  }

  function decorarCards() {
    const seletor = ehPdv ? '#products-grid .product-card' : '#grid-produtos-g .prod-card-g';
    document.querySelectorAll(seletor).forEach(card => {
      const produto = produtoPorId(idProdutoDoCard(card));
      if (!produto || produto.categoria !== CATEGORIA) return;
      if (produto.sushiResumo && !card.querySelector('.sushi-card-meta')) {
        const meta = document.createElement('small');
        meta.className = 'sushi-card-meta';
        meta.textContent = produto.sushiResumo;
        card.appendChild(meta);
      }
      if (produto.sushiDetalhes?.length && !card.querySelector('[data-sushi-detail]')) {
        const acoes = document.createElement('span');
        acoes.className = 'sushi-info-actions';
        acoes.innerHTML = `<span class="sushi-detail-link" role="button" tabindex="0" data-sushi-detail="${escapar(produto.id)}">🍣 Ver detalhes</span>`;
        card.appendChild(acoes);
      }
    });
  }

  function sincronizarEstado() {
    agendado = false;
    if (!catalogo) return;
    garantirEstilo();
    registrarCategoria();
    garantirFallbacks();
    garantirTabPrincipal();
    const barra = garantirSubfiltros();
    const sushiAtivo = categoriaSelecionada() === CATEGORIA;
    barra?.classList.toggle('open', sushiAtivo);
    const { tab } = encontrarTabPrincipal();
    tab?.classList.toggle('active', sushiAtivo);
    if (!sushiAtivo) return;
    barra?.querySelectorAll('[data-sushi-group]').forEach(botao => botao.classList.toggle('active', botao.dataset.sushiGroup === grupoAtual));
    decorarCards();
    aplicarFiltroGrupo();
  }

  function agendarSincronizacao() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(sincronizarEstado);
  }

  document.addEventListener('click', event => {
    const grupo = event.target.closest('[data-sushi-group]');
    if (grupo) {
      event.preventDefault();
      grupoAtual = grupo.dataset.sushiGroup || 'todos';
      agendarSincronizacao();
      return;
    }
    const detalhe = event.target.closest('[data-sushi-detail]');
    if (detalhe) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      abrirDetalhes(detalhe.dataset.sushiDetail);
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') document.getElementById('sushi-detail-modal')?.classList.remove('open');
    if ((event.key === 'Enter' || event.key === ' ') && event.target?.matches?.('[data-sushi-detail]')) {
      event.preventDefault();
      abrirDetalhes(event.target.dataset.sushiDetail);
    }
  });

  const observer = new MutationObserver(agendarSincronizacao);
  if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true });

  async function iniciar() {
    try {
      const resposta = await fetch(CATALOGO_URL, { cache:'no-store' });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const recebido = await resposta.json();
      if (!recebido || recebido.version !== '2026-09-03-v1' || recebido.category?.key !== CATEGORIA || !Array.isArray(recebido.items) || recebido.items.length !== 61) {
        throw new Error('Catálogo Sushi inválido ou incompleto.');
      }
      catalogo = recebido;
      sincronizarEstado();
    } catch (erro) {
      console.error('Falha ao carregar categoria Sushi:', erro);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else iniciar();

  window.JoaoCaicaraSushi = Object.freeze({
    categoria:CATEGORIA,
    catalogo:() => catalogo,
    selecionar:() => selecionarSushi(encontrarTabPrincipal().tab),
    filtrar:grupo => { grupoAtual = grupo || 'todos'; agendarSincronizacao(); },
    detalhes:abrirDetalhes
  });
})();
