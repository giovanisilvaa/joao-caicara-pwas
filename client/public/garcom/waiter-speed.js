/* Garçom Rápido — melhorias de velocidade sem alterar o fluxo de produção. */
(() => {
  const normalizarBuscaRapida = (texto) => String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const produtoAtivo = p => p && p.ativo !== false;

  function criarCardRapido(p, destaque = false) {
    const serve2 = p.servePara2 ? '<small>🍽️ Serve 2 pessoas</small>' : '';
    return `
      <button type="button" class="prod-card-g speed-product ${destaque ? 'speed-favorite' : ''}" data-produto-id="${p.id}" aria-label="Adicionar ${p.nome}, ${formatarMoeda(p.preco)}" onclick="adicionarItemG(${p.id})">
        ${destaque ? '<span class="speed-star">★</span>' : ''}
        <h4>${p.nome}</h4>
        <p>${formatarMoeda(p.preco)}</p>
        ${serve2}
        <span class="speed-add">+ adicionar</span>
      </button>`;
  }

  function produtosDaCategoriaAtual() {
    let lista = produtos.filter(produtoAtivo);
    if (categoriaAtual === 'favoritos') lista = lista.filter(p => p.favorito);
    else if (categoriaAtual !== 'todos') lista = lista.filter(p => p.categoria === categoriaAtual);
    return lista;
  }

  window.renderizarProdutosG = function renderizarProdutosRapidos() {
    const grid = document.getElementById('grid-produtos-g');
    if (!grid) return;
    const lista = produtosDaCategoriaAtual();
    if (!lista.length) {
      grid.innerHTML = '<p class="msg-vazio">Nenhum item aqui.</p>';
      return;
    }
    grid.innerHTML = lista.map(p => criarCardRapido(p, categoriaAtual === 'favoritos')).join('');
  };

  function renderizarBuscaRapida(termo) {
    const grid = document.getElementById('grid-produtos-g');
    if (!grid) return;
    const busca = normalizarBuscaRapida(termo);
    if (!busca) return renderizarProdutosG();
    const resultado = produtos.filter(produtoAtivo).filter(p => {
      const nome = normalizarBuscaRapida(p.nome);
      const categoria = normalizarBuscaRapida(p.categoria);
      return nome.includes(busca) || categoria.includes(busca);
    });
    grid.innerHTML = resultado.length
      ? resultado.map(p => criarCardRapido(p, Boolean(p.favorito))).join('')
      : `<div class="speed-empty-search"><strong>Nenhum produto encontrado</strong><span>Tente outro nome.</span></div>`;
  }

  const busca = document.getElementById('busca-produto-g');
  const painelPedidoBusca = document.getElementById('tela-pedido');
  let buscaComFoco = false;
  let modoBuscaAtivo = false;

  function recolherComandaAoPesquisar() {
    const toggle = document.getElementById('comanda-toggle');
    if (toggle?.getAttribute('aria-expanded') !== 'true') return;
    try {
      if (typeof toggleComanda === 'function') toggleComanda();
    } catch (_) {}
  }

  function atualizarModoBusca() {
    if (!busca || !painelPedidoBusca) return;
    const ativo = buscaComFoco || Boolean(normalizarBuscaRapida(busca.value));
    if (ativo && !modoBuscaAtivo) recolherComandaAoPesquisar();
    modoBuscaAtivo = ativo;
    painelPedidoBusca.classList.toggle('speed-search-mode', ativo);
  }

  if (busca) {
    busca.setAttribute('type', 'search');
    busca.setAttribute('autocomplete', 'off');
    busca.setAttribute('enterkeyhint', 'search');
    busca.setAttribute('aria-label', 'Buscar produto no cardápio');
    busca.placeholder = 'Buscar produto rápido...';
    busca.addEventListener('focus', () => {
      buscaComFoco = true;
      atualizarModoBusca();
    });
    busca.addEventListener('blur', () => {
      buscaComFoco = false;
      requestAnimationFrame(atualizarModoBusca);
    });
    busca.addEventListener('input', () => {
      renderizarBuscaRapida(busca.value);
      atualizarModoBusca();
    });
    busca.addEventListener('search', () => {
      renderizarBuscaRapida(busca.value);
      atualizarModoBusca();
    });
    busca.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      busca.value = '';
      renderizarBuscaRapida('');
      busca.blur();
      atualizarModoBusca();
    });
  }

  const filtrarCardapioOriginal = window.filtrarCardapioG;
  if (typeof filtrarCardapioOriginal === 'function') {
    window.filtrarCardapioG = function filtrarCardapioComSaidaBusca() {
      const retorno = filtrarCardapioOriginal.apply(this, arguments);
      buscaComFoco = false;
      atualizarModoBusca();
      return retorno;
    };
  }

  const adicionarOriginal = window.adicionarItemG;
  if (typeof adicionarOriginal === 'function') {
    window.adicionarItemG = function adicionarItemRapido(produtoId) {
      const retorno = adicionarOriginal.apply(this, arguments);
      const card = document.querySelector(`[data-produto-id="${produtoId}"]`);
      if (card) {
        card.classList.remove('speed-added');
        void card.offsetWidth;
        card.classList.add('speed-added');
        setTimeout(() => card.classList.remove('speed-added'), 450);
      }
      try { if (navigator.vibrate) navigator.vibrate(30); } catch (_) {}
      return retorno;
    };
  }

  const OBS_RAPIDAS = [
    'Sem cebola',
    'Sem tomate',
    'Sem salada',
    'Sem gelo',
    'Pouco gelo',
    'Bem passado',
    'Ao ponto',
    'Mal passado',
    'Molho separado',
    'Levar depois'
  ];

  function garantirModalObs() {
    let modal = document.getElementById('speed-obs-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'speed-obs-modal';
    modal.className = 'speed-obs-modal';
    modal.innerHTML = `
      <div class="speed-obs-box" role="dialog" aria-modal="true" aria-labelledby="speed-obs-title">
        <div class="speed-obs-head">
          <div><small>Observação</small><strong id="speed-obs-title">Item</strong></div>
          <button type="button" id="speed-obs-close" aria-label="Fechar">×</button>
        </div>
        <div class="speed-obs-chips">${OBS_RAPIDAS.map(obs => `<button type="button" data-speed-obs="${obs}">${obs}</button>`).join('')}</div>
        <textarea id="speed-obs-text" rows="3" placeholder="Digite uma observação..."></textarea>
        <div class="speed-obs-actions">
          <button type="button" class="speed-obs-clear" id="speed-obs-clear">Limpar</button>
          <button type="button" class="speed-obs-save" id="speed-obs-save">Salvar observação</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  }

  let indiceObsAtual = null;

  function fecharObsRapida() {
    const modal = document.getElementById('speed-obs-modal');
    if (modal) modal.classList.remove('open');
    indiceObsAtual = null;
  }

  async function salvarObsRapida() {
    if (indiceObsAtual === null || !mesaSelecionada || !mesas[mesaSelecionada]) return fecharObsRapida();
    const item = mesas[mesaSelecionada].itens[indiceObsAtual];
    if (!item) return fecharObsRapida();
    const texto = document.getElementById('speed-obs-text').value.trim();

    if (window.GarcomConcorrencia?.salvarObservacao) {
      const salvo = await window.GarcomConcorrencia.salvarObservacao(indiceObsAtual, texto);
      if (salvo) fecharObsRapida();
      return;
    }

    item.obs = texto;
    if (typeof registrarAuditoriaGarcom === 'function') registrarAuditoriaGarcom('editar_observacao', { mesa: mesaSelecionada, item: item.nome });
    salvarMesas();
    renderizarComandaG();
    fecharObsRapida();
  }

  window.editarObsG = function editarObsRapida(index) {
    if (!mesaSelecionada || !mesas[mesaSelecionada]) return;
    const item = mesas[mesaSelecionada].itens[index];
    if (!item) return;
    indiceObsAtual = index;
    const modal = garantirModalObs();
    modal.querySelector('#speed-obs-title').textContent = item.nome;
    const area = modal.querySelector('#speed-obs-text');
    area.value = item.obs || '';
    modal.classList.add('open');
    setTimeout(() => area.focus(), 50);
  };

  document.addEventListener('click', event => {
    const modal = document.getElementById('speed-obs-modal');
    if (!modal) return;
    const chip = event.target.closest('[data-speed-obs]');
    if (chip) {
      const area = modal.querySelector('#speed-obs-text');
      const texto = chip.dataset.speedObs;
      const partes = area.value.split(',').map(v => v.trim()).filter(Boolean);
      if (!partes.includes(texto)) partes.push(texto);
      area.value = partes.join(', ');
      return;
    }
    if (event.target.id === 'speed-obs-close' || event.target === modal) fecharObsRapida();
    if (event.target.id === 'speed-obs-clear') modal.querySelector('#speed-obs-text').value = '';
    if (event.target.id === 'speed-obs-save') salvarObsRapida();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') fecharObsRapida();
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && document.getElementById('speed-obs-modal')?.classList.contains('open')) salvarObsRapida();
  });

  // Pequena faixa de orientação apenas no cardápio, sem interferir na cozinha.
  const telaPedido = document.getElementById('tela-pedido');
  const tabs = document.getElementById('tabs-g');
  if (telaPedido && tabs && !document.getElementById('speed-hint')) {
    const hint = document.createElement('div');
    hint.id = 'speed-hint';
    hint.className = 'speed-hint';
    hint.innerHTML = '<span>⚡ Toque no produto para adicionar</span><span>📝 Toque na observação para editar</span>';
    tabs.insertAdjacentElement('afterend', hint);
  }

  try { renderizarProdutosG(); } catch (_) {}
})();
