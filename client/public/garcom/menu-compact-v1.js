/* Cardápio compacto do Garçom — camada somente visual.
   Reutiliza os controles existentes e não altera mesas, pedidos, Firebase ou fechamento. */
(() => {
  if (!location.pathname.startsWith('/garcom/')) return;
  if (window.GARCOM_MENU_COMPACT_RUNTIME === 'v1') return;
  window.GARCOM_MENU_COMPACT_RUNTIME = 'v1';

  const tela = document.getElementById('tela-pedido');
  const busca = document.getElementById('busca-produto-g');
  const tabs = document.getElementById('tabs-g');
  const inputCliente = document.getElementById('nome-cliente-g');
  const tituloOriginal = document.getElementById('header-titulo');
  const statusOriginal = document.getElementById('status-conexao');
  const voltarOriginal = document.getElementById('btn-voltar');
  if (!tela || !busca || !tabs) return;

  let observer = null;
  let agendado = false;

  function criarEstrutura() {
    if (!document.getElementById('garcom-menu-compact-bar')) {
      const barra = document.createElement('div');
      barra.id = 'garcom-menu-compact-bar';
      barra.innerHTML = `
        <button type="button" id="garcom-menu-back" aria-label="Voltar para mesas">←</button>
        <strong id="garcom-menu-title">Mesa</strong>
        <button type="button" id="garcom-menu-status" aria-label="Status da conexão">🟠 Sincronizando</button>
        <button type="button" id="garcom-menu-client" aria-label="Editar nome do cliente">👤 Cliente</button>`;
      tela.insertBefore(barra, tela.firstChild);
    }

    if (!document.getElementById('garcom-menu-category-row')) {
      const linha = document.createElement('div');
      linha.id = 'garcom-menu-category-row';
      linha.innerHTML = `
        <button type="button" id="garcom-menu-favorites">⭐ Favoritos</button>
        <button type="button" id="garcom-menu-categories" aria-haspopup="dialog" aria-expanded="false">
          <span id="garcom-menu-category-label">Categorias</span><span aria-hidden="true">▾</span>
        </button>`;
      busca.insertAdjacentElement('afterend', linha);
    }

    if (!document.getElementById('garcom-category-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'garcom-category-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = `
        <div id="garcom-category-sheet" role="dialog" aria-modal="true" aria-labelledby="garcom-category-title">
          <div class="garcom-category-head">
            <strong id="garcom-category-title">Categorias</strong>
            <button type="button" id="garcom-category-close">Fechar</button>
          </div>
          <div id="garcom-category-list"></div>
        </div>`;
      document.body.appendChild(overlay);
    }
  }

  function pedidoVisivel() {
    return tela.style.display !== 'none' && getComputedStyle(tela).display !== 'none';
  }

  function textoStatusCompacto() {
    if (statusOriginal?.classList.contains('sync-error')) return '🔴 Falha';
    if (statusOriginal?.classList.contains('sync-pending')) return '🟠 Sincronizando';
    if (statusOriginal?.classList.contains('sync-ok')) return '🟢 Online';
    return '🟠 Conectando';
  }

  function atualizarBarra() {
    const ativo = pedidoVisivel();
    document.body.classList.toggle('garcom-menu-compact-active', ativo);
    if (!ativo) {
      tela.classList.remove('garcom-client-edit-open');
      fecharCategorias();
      return;
    }

    const titulo = document.getElementById('garcom-menu-title');
    if (titulo) titulo.textContent = tituloOriginal?.textContent?.trim() || 'Mesa';

    const status = document.getElementById('garcom-menu-status');
    if (status) {
      status.textContent = textoStatusCompacto();
      const detalhe = statusOriginal?.getAttribute('aria-label') || statusOriginal?.textContent || '';
      status.title = detalhe.trim();
      status.setAttribute('aria-label', detalhe.trim() || 'Status da conexão');
    }

    const cliente = document.getElementById('garcom-menu-client');
    if (cliente) {
      const nome = String(inputCliente?.value || '').trim();
      cliente.textContent = nome ? `👤 ${nome.length > 14 ? `${nome.slice(0, 14)}…` : nome}` : '👤 Cliente';
      cliente.title = nome ? `Cliente: ${nome}` : 'Adicionar nome do cliente';
    }
    atualizarCategoriaAtiva();
  }

  function atualizarCategoriaAtiva() {
    const ativo = tabs.querySelector('.tab-g.active');
    const label = document.getElementById('garcom-menu-category-label');
    if (!label) return;
    const texto = ativo?.textContent?.trim() || 'Categorias';
    label.textContent = /favoritos/i.test(texto) ? 'Categorias' : texto.replace(/^⭐\s*/, '');
    document.getElementById('garcom-menu-favorites')?.classList.toggle('active', /favoritos/i.test(texto));
  }

  function clicarTabOriginal(predicado) {
    const lista = Array.from(tabs.querySelectorAll('.tab-g'));
    const original = lista.find(predicado);
    if (!original) return false;
    original.click();
    requestAnimationFrame(() => {
      atualizarCategoriaAtiva();
      const grid = document.getElementById('grid-produtos-g');
      if (grid) grid.scrollTop = 0;
    });
    return true;
  }

  function renderizarCategorias() {
    const lista = document.getElementById('garcom-category-list');
    if (!lista) return;
    const originais = Array.from(tabs.querySelectorAll('.tab-g'));
    const opcoes = originais.filter(botao => !/favoritos/i.test(botao.textContent || ''));
    lista.innerHTML = '';
    opcoes.forEach((original, indice) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = `garcom-category-option${original.classList.contains('active') ? ' active' : ''}`;
      botao.dataset.originalIndex = String(originais.indexOf(original));
      botao.textContent = original.textContent?.trim() || `Categoria ${indice + 1}`;
      botao.addEventListener('click', () => {
        original.click();
        fecharCategorias();
        requestAnimationFrame(() => {
          atualizarCategoriaAtiva();
          const grid = document.getElementById('grid-produtos-g');
          if (grid) grid.scrollTop = 0;
        });
      });
      lista.appendChild(botao);
    });
  }

  function abrirCategorias() {
    renderizarCategorias();
    const overlay = document.getElementById('garcom-category-overlay');
    const botao = document.getElementById('garcom-menu-categories');
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    botao?.setAttribute('aria-expanded', 'true');
    overlay.querySelector('.garcom-category-option.active, .garcom-category-option')?.focus();
  }

  function fecharCategorias() {
    const overlay = document.getElementById('garcom-category-overlay');
    const botao = document.getElementById('garcom-menu-categories');
    overlay?.classList.remove('open');
    overlay?.setAttribute('aria-hidden', 'true');
    botao?.setAttribute('aria-expanded', 'false');
  }

  function toggleCliente() {
    const abrir = !tela.classList.contains('garcom-client-edit-open');
    tela.classList.toggle('garcom-client-edit-open', abrir);
    if (abrir) requestAnimationFrame(() => inputCliente?.focus());
  }

  function bind() {
    document.getElementById('garcom-menu-back')?.addEventListener('click', () => voltarOriginal?.click());
    document.getElementById('garcom-menu-status')?.addEventListener('click', () => statusOriginal?.click());
    document.getElementById('garcom-menu-client')?.addEventListener('click', toggleCliente);
    document.getElementById('garcom-menu-favorites')?.addEventListener('click', () => {
      clicarTabOriginal(botao => /favoritos/i.test(botao.textContent || ''));
    });
    document.getElementById('garcom-menu-categories')?.addEventListener('click', abrirCategorias);
    document.getElementById('garcom-category-close')?.addEventListener('click', fecharCategorias);
    document.getElementById('garcom-category-overlay')?.addEventListener('click', event => {
      if (event.target?.id === 'garcom-category-overlay') fecharCategorias();
    });
    inputCliente?.addEventListener('input', atualizarBarra);
    inputCliente?.addEventListener('change', atualizarBarra);
    busca.addEventListener('focus', () => tela.classList.remove('garcom-client-edit-open'));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.getElementById('garcom-category-overlay')?.classList.contains('open')) fecharCategorias();
    });
  }

  function agendarAtualizacao() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => {
      agendado = false;
      atualizarBarra();
    });
  }

  function iniciar() {
    criarEstrutura();
    bind();
    atualizarBarra();
    observer = new MutationObserver(agendarAtualizacao);
    observer.observe(tela, { attributes: true, attributeFilter: ['style', 'class'] });
    if (tituloOriginal) observer.observe(tituloOriginal, { childList: true, characterData: true, subtree: true });
    if (statusOriginal) observer.observe(statusOriginal, { attributes: true, attributeFilter: ['class', 'aria-label'], childList: true, characterData: true, subtree: true });
    observer.observe(tabs, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  iniciar();
  window.GarcomMenuCompacto = Object.freeze({ runtime: 'v1', atualizar: atualizarBarra, abrirCategorias, fecharCategorias });
})();
