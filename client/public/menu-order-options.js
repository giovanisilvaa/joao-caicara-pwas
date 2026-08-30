/* Opções compartilhadas de cardápio: Kids, observação e meio prato (60%). */
(() => {
  if (window.MENU_ORDER_OPTIONS_RUNTIME === 'v1') return;
  window.MENU_ORDER_OPTIONS_RUNTIME = 'v1';

  const HALF_RATIO = 0.60;
  const KIDS_CATEGORY = 'kids';
  const ehPdv = location.pathname.includes('/pdv/');
  const ehGarcom = location.pathname.includes('/garcom/');
  let modalEstado = null;
  let decoracaoAgendada = false;

  const moeda = valor => {
    try {
      if (typeof formatarMoeda === 'function') return formatarMoeda(Number(valor) || 0);
    } catch (_) {}
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
  };

  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caractere]));

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

  function precoMeio(produto) {
    return Math.round((Number(produto?.preco) || 0) * HALF_RATIO * 100) / 100;
  }

  function permiteMeioPrato(produto) {
    return Boolean(produto?.servePara2) || String(produto?.categoria || '').trim().toLowerCase() === 'festival';
  }

  function identidadeGarcom() {
    try {
      if (window.GarcomAtribuicao?.identidadeAtual) return window.GarcomAtribuicao.identidadeAtual();
    } catch (_) {}
    try {
      const sessao = typeof window.sessaoGarcomAtual === 'function' ? window.sessaoGarcomAtual() : null;
      const nome = String(sessao?.nome || '').trim();
      if (!nome) return null;
      return {
        nome,
        login: sessao.login || 'garcom',
        uid: sessao.uid || sessao.funcionarioId || null,
        compartilhado: sessao.compartilhado === true
      };
    } catch (_) {
      return null;
    }
  }

  function numeroMesaAtual() {
    try {
      if (ehPdv) return mesaAtualSelecionada || null;
      if (ehGarcom) return mesaSelecionada || null;
    } catch (_) {}
    return null;
  }

  function atualizarTela(numero, mesa) {
    try { if (typeof mesas !== 'undefined' && mesas) mesas[numero] = mesa; } catch (_) {}
    if (ehPdv) {
      try { renderizarComanda(); } catch (_) {}
      try { gerarMesas(); } catch (_) {}
      try { atualizarPainelDiario(); } catch (_) {}
    } else {
      try { renderizarComandaG(); } catch (_) {}
      try { renderizarMesasG(); } catch (_) {}
    }
  }

  function garantirEstilo() {
    if (document.getElementById('menu-order-options-style')) return;
    const style = document.createElement('style');
    style.id = 'menu-order-options-style';
    style.textContent = `
      .menu-opt-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;justify-content:center}
      .menu-opt-action{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:5px 8px;border-radius:8px;border:1px solid rgba(15,76,92,.22);background:#f4f7f5;color:#0f4c5c;font-size:.69rem;font-weight:800;line-height:1.1;cursor:pointer;user-select:none}
      .menu-opt-action.menu-opt-half{background:#fff1e9;color:#a04429;border-color:#e8b39f}
      .menu-opt-kids-badge{display:block;margin-top:4px;font-size:.68rem;font-weight:800;color:#8b5a2b}
      #menu-order-options-modal{display:none;position:fixed;inset:0;z-index:2600;background:rgba(15,76,92,.82);align-items:center;justify-content:center;padding:16px}
      #menu-order-options-modal.open{display:flex}
      .menu-order-box{width:min(440px,100%);background:#fff;border-radius:16px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.28)}
      .menu-order-box h3{margin:0 0 4px;color:#0f4c5c;font-family:Georgia,serif}
      .menu-order-box .menu-order-price{font-weight:900;color:#2a9d8f;margin-bottom:12px}
      .menu-order-modes{display:flex;gap:8px;margin-bottom:10px}
      .menu-order-modes button{flex:1;border:1px solid #d8e2df;background:#f5f7f4;color:#123e48;border-radius:9px;padding:9px;font-weight:800;cursor:pointer}
      .menu-order-modes button.active{background:#0f4c5c;color:#fff;border-color:#0f4c5c}
      #menu-order-obs{width:100%;min-height:92px;resize:vertical;padding:10px;border:1px solid #d8e2df;border-radius:9px;font-size:1rem}
      .menu-order-quick{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
      .menu-order-quick button{border:1px solid #d8e2df;background:#fff;border-radius:999px;padding:6px 8px;font-size:.72rem;cursor:pointer}
      .menu-order-footer{display:flex;gap:8px;margin-top:12px}
      .menu-order-footer button{flex:1;border:0;border-radius:9px;padding:11px;font-weight:900;cursor:pointer}
      #menu-order-cancel{background:#e7ecea;color:#234d56}
      #menu-order-add{background:#2a9d8f;color:#fff}
      .menu-opt-kids-tab{font-weight:900!important}
    `;
    document.head.appendChild(style);
  }

  function garantirModal() {
    garantirEstilo();
    let modal = document.getElementById('menu-order-options-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'menu-order-options-modal';
    modal.innerHTML = `
      <div class="menu-order-box" role="dialog" aria-modal="true" aria-labelledby="menu-order-title">
        <h3 id="menu-order-title">Item</h3>
        <div class="menu-order-price" id="menu-order-price"></div>
        <div class="menu-order-modes" id="menu-order-modes"></div>
        <label for="menu-order-obs" style="display:block;font-weight:800;color:#123e48;margin-bottom:5px;">Observação do item</label>
        <textarea id="menu-order-obs" placeholder="Ex.: sem cebola, retirar salada, adicionar molho, copo com gelo e limão..."></textarea>
        <div class="menu-order-quick">
          <button type="button" data-menu-quick="Sem cebola">Sem cebola</button>
          <button type="button" data-menu-quick="Sem tomate">Sem tomate</button>
          <button type="button" data-menu-quick="Sem salada">Sem salada</button>
          <button type="button" data-menu-quick="Molho separado">Molho separado</button>
          <button type="button" data-menu-quick="Copo com gelo e limão">Gelo + limão</button>
        </div>
        <div class="menu-order-footer">
          <button type="button" id="menu-order-cancel">Cancelar</button>
          <button type="button" id="menu-order-add">Adicionar ao pedido</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.id === 'menu-order-cancel') return fecharModal();
      const rapido = event.target.closest('[data-menu-quick]');
      if (rapido) {
        const area = modal.querySelector('#menu-order-obs');
        const valor = rapido.dataset.menuQuick;
        const partes = area.value.split(',').map(item => item.trim()).filter(Boolean);
        if (!partes.includes(valor)) partes.push(valor);
        area.value = partes.join(', ');
        return;
      }
      const modo = event.target.closest('[data-menu-mode]');
      if (modo && modalEstado) {
        modalEstado.meio = modo.dataset.menuMode === 'half';
        atualizarModal();
        return;
      }
      if (event.target.id === 'menu-order-add') adicionarDoModal();
    });

    return modal;
  }

  function atualizarModal() {
    const modal = garantirModal();
    const produto = modalEstado?.produto;
    if (!produto) return;
    const meio = Boolean(modalEstado.meio);
    modal.querySelector('#menu-order-title').textContent = meio ? `${produto.nome} — Meio prato` : produto.nome;
    modal.querySelector('#menu-order-price').textContent = meio
      ? `${moeda(precoMeio(produto))} · 60% do prato normal`
      : moeda(produto.preco);

    const modos = modal.querySelector('#menu-order-modes');
    if (permiteMeioPrato(produto)) {
      modos.style.display = 'flex';
      modos.innerHTML = `
        <button type="button" data-menu-mode="full" class="${meio ? '' : 'active'}">Prato normal</button>
        <button type="button" data-menu-mode="half" class="${meio ? 'active' : ''}">½ Meio prato · 60%</button>`;
    } else {
      modos.style.display = 'none';
      modos.innerHTML = '';
      modalEstado.meio = false;
    }
  }

  function abrirOpcoes(produto, meio = false) {
    if (!produto) return;
    if (!numeroMesaAtual()) return alert('Selecione uma mesa antes de adicionar o item.');
    modalEstado = { produto, meio: Boolean(meio && permiteMeioPrato(produto)), enviando: false };
    const modal = garantirModal();
    modal.querySelector('#menu-order-obs').value = '';
    atualizarModal();
    modal.classList.add('open');
    setTimeout(() => modal.querySelector('#menu-order-obs')?.focus(), 40);
  }

  function fecharModal() {
    document.getElementById('menu-order-options-modal')?.classList.remove('open');
    modalEstado = null;
  }

  async function adicionarPersonalizado(produto, { meio = false, obs = '' } = {}) {
    const numero = numeroMesaAtual();
    if (!numero || !window.MesaAtomic) throw new Error('Mesa ou núcleo atômico indisponível.');

    const observacao = String(obs || '').trim();
    const personalizado = { ...produto };
    personalizado.produtoOriginalId = produto.id;
    personalizado.nomeOriginal = produto.nome;

    if (meio) {
      if (!permiteMeioPrato(produto)) throw new Error('Este produto não permite meio prato.');
      personalizado.id = `${produto.id}__meio`;
      personalizado.nome = `${produto.nome} (Meio prato)`;
      personalizado.precoOriginal = Number(produto.preco) || 0;
      personalizado.preco = precoMeio(produto);
      personalizado.meioPrato = true;
      personalizado.percentualPreco = 60;
      personalizado.servePara2 = true;
    }

    if (observacao) {
      personalizado.id = `${personalizado.id}__obs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    const resultado = await window.MesaAtomic.adicionarItem(numero, personalizado, {
      origem: ehPdv ? 'pdv' : 'garcom',
      rascunho: !ehPdv,
      identidade: ehGarcom ? identidadeGarcom() : null
    });
    if (!resultado.committed) throw new Error(resultado.motivo || 'Não foi possível adicionar o item.');

    let mesaFinal = resultado.mesa;
    if (observacao) {
      const itemId = resultado.meta?.itemOperacaoId;
      const indice = mesaFinal.itens.findIndex(item => item.itemOperacaoId === itemId);
      const atualizado = await window.MesaAtomic.atualizarItem(numero, itemId, { obs: observacao }, indice);
      if (!atualizado.committed) throw new Error(atualizado.motivo || 'Item adicionado, mas a observação não pôde ser salva.');
      mesaFinal = atualizado.mesa;
    }

    atualizarTela(numero, mesaFinal);
    return mesaFinal;
  }

  async function adicionarDoModal() {
    if (!modalEstado || modalEstado.enviando) return;
    const botao = document.getElementById('menu-order-add');
    const obs = document.getElementById('menu-order-obs')?.value || '';
    modalEstado.enviando = true;
    if (botao) {
      botao.disabled = true;
      botao.textContent = 'Adicionando...';
    }
    try {
      await adicionarPersonalizado(modalEstado.produto, { meio: modalEstado.meio, obs });
      fecharModal();
    } catch (erro) {
      console.error('Falha ao adicionar item com opções:', erro);
      alert(erro?.message || 'Não foi possível adicionar o item.');
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = 'Adicionar ao pedido';
      }
      if (modalEstado) modalEstado.enviando = false;
    }
  }

  function idProdutoDoCard(card) {
    if (card.dataset.produtoId) return card.dataset.produtoId;
    const onclick = card.getAttribute('onclick') || '';
    const match = onclick.match(/adicionarProduto\(([^)]+)\)/);
    return match ? String(match[1]).replace(/['"]/g, '').trim() : '';
  }

  function decorarCard(card) {
    if (!card || card.dataset.menuOptionsReady === '1') return;
    const id = idProdutoDoCard(card);
    const produto = produtoPorId(id);
    if (!produto) return;

    card.dataset.menuOptionsReady = '1';
    if (produto.categoria === KIDS_CATEGORY && !card.querySelector('.menu-opt-kids-badge')) {
      const badge = document.createElement('span');
      badge.className = 'menu-opt-kids-badge';
      badge.textContent = '🧒 Prato Kids';
      card.appendChild(badge);
    }

    const acoes = document.createElement('div');
    acoes.className = 'menu-opt-actions';
    acoes.innerHTML = `<span class="menu-opt-action" role="button" tabindex="0" data-menu-action="obs" data-produto-id="${escapar(produto.id)}">📝 Observação</span>`;
    if (permiteMeioPrato(produto)) {
      acoes.innerHTML += `<span class="menu-opt-action menu-opt-half" role="button" tabindex="0" data-menu-action="half" data-produto-id="${escapar(produto.id)}">½ Meio · ${escapar(moeda(precoMeio(produto)))}</span>`;
    }
    card.appendChild(acoes);
  }

  function garantirKidsTab() {
    if (ehPdv) {
      const tabs = document.querySelector('.tabs');
      if (!tabs || tabs.querySelector('[data-menu-kids-tab]')) return;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab menu-opt-kids-tab';
      tab.dataset.menuKidsTab = '1';
      tab.textContent = '🧒 Kids';
      tab.addEventListener('click', () => {
        try { categoriaAtual = KIDS_CATEGORY; } catch (_) {}
        tabs.querySelectorAll('.tab').forEach(item => item.classList.remove('active'));
        tab.classList.add('active');
        try { renderizarCardapio(KIDS_CATEGORY); } catch (_) {}
      });
      tabs.appendChild(tab);
      return;
    }

    if (ehGarcom) {
      const tabs = document.getElementById('tabs-g');
      if (!tabs || tabs.querySelector('[data-menu-kids-tab]')) return;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab-g menu-opt-kids-tab';
      tab.dataset.menuKidsTab = '1';
      tab.textContent = '🧒 Kids';
      tab.addEventListener('click', () => {
        try {
          if (typeof filtrarCardapioG === 'function') filtrarCardapioG(KIDS_CATEGORY);
          else {
            categoriaAtual = KIDS_CATEGORY;
            renderizarProdutosG();
          }
        } catch (_) {}
        setTimeout(agendarDecoracao, 0);
      });
      tabs.appendChild(tab);
    }
  }

  function corrigirCategoriasAdmin() {
    if (!ehPdv) return;
    const novo = document.getElementById('novo-prod-categoria');
    if (novo && !novo.querySelector('option[value="kids"]')) {
      novo.insertAdjacentHTML('beforeend', '<option value="kids">Kids</option>');
    }

    document.querySelectorAll('#lista-admin-cardapio select[onchange*="categoria"]').forEach(select => {
      if (!select.querySelector('option[value="kids"]')) {
        select.insertAdjacentHTML('beforeend', '<option value="kids">Kids</option>');
      }
      const attr = select.getAttribute('onchange') || '';
      const match = attr.match(/editarProdutoAdmin\(([^,]+),/);
      const produto = match ? produtoPorId(String(match[1]).replace(/['"]/g, '').trim()) : null;
      if (produto?.categoria === KIDS_CATEGORY) select.value = KIDS_CATEGORY;
    });
  }

  function decorarTudo() {
    decoracaoAgendada = false;
    garantirEstilo();
    garantirKidsTab();
    corrigirCategoriasAdmin();
    const seletor = ehPdv ? '#products-grid .product-card' : '#grid-produtos-g .prod-card-g';
    document.querySelectorAll(seletor).forEach(decorarCard);
  }

  function agendarDecoracao() {
    if (decoracaoAgendada) return;
    decoracaoAgendada = true;
    requestAnimationFrame(decorarTudo);
  }

  async function semearKids() {
    if (!ehPdv || !window.firebase) return;
    const user = firebase.auth().currentUser;
    if (!user || String(user.email || '').toLowerCase() !== 'adm@acesso.joaocaicara.app') return;
    if (localStorage.getItem('joao_caicara_kids_seed_v1') === 'ok') return;

    const ref = db.ref('cardapio');
    await new Promise((resolve, reject) => {
      ref.transaction(atual => {
        const lista = Array.isArray(atual)
          ? atual.filter(Boolean)
          : (atual && typeof atual === 'object' ? Object.values(atual).filter(item => item && item.nome) : []);
        if (lista.some(item => item.categoria === KIDS_CATEGORY)) return atual;

        const idsNumericos = lista.map(item => Number(item.id)).filter(Number.isFinite);
        let proximoId = (idsNumericos.length ? Math.max(...idsNumericos) : 0) + 1;
        const exemplos = [
          { nome: 'Kids Frango Grelhado com Fritas', preco: 32.00 },
          { nome: 'Kids Peixe Grelhado com Arroz', preco: 35.00 },
          { nome: 'Kids Isca de Peixe com Fritas', preco: 34.00 },
          { nome: 'Kids Macarrão ao Molho', preco: 28.00 }
        ].map(item => ({
          id: proximoId++,
          nome: item.nome,
          preco: item.preco,
          categoria: KIDS_CATEGORY,
          setor: 'cozinha',
          favorito: false,
          ativo: true,
          servePara2: false,
          exemploKids: true
        }));
        return lista.concat(exemplos);
      }, (erro, committed) => erro ? reject(erro) : resolve(committed), false);
    });
    localStorage.setItem('joao_caicara_kids_seed_v1', 'ok');
  }

  document.addEventListener('click', event => {
    const acao = event.target.closest('[data-menu-action]');
    if (!acao) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const produto = produtoPorId(acao.dataset.produtoId);
    abrirOpcoes(produto, acao.dataset.menuAction === 'half');
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') fecharModal();
    if ((event.key === 'Enter' || event.key === ' ') && event.target?.matches?.('[data-menu-action]')) {
      event.preventDefault();
      event.target.click();
    }
  });

  const observer = new MutationObserver(agendarDecoracao);
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });

  function iniciar() {
    decorarTudo();
    if (ehPdv && window.firebase) {
      firebase.auth().onAuthStateChanged(user => {
        if (String(user?.email || '').toLowerCase() === 'adm@acesso.joaocaicara.app') {
          semearKids().then(() => setTimeout(agendarDecoracao, 250)).catch(erro => console.warn('Não foi possível semear Kids:', erro));
        }
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.MenuOrderOptions = Object.freeze({
    HALF_RATIO,
    precoMeio,
    abrirOpcoes,
    adicionarPersonalizado,
    semearKids,
    decorar: agendarDecoracao
  });
})();