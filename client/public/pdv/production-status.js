/* Status operacional de produção do PDV. Carregado após hotfix-sync.js. */
(() => {
  const STATUS = {
    recebido: { label: 'Aguardando', icon: '⏳', cls: 'stage-waiting' },
    impresso: { label: 'Na produção', icon: '🧾', cls: 'stage-waiting' },
    em_preparo: { label: 'Em preparo', icon: '🔥', cls: 'stage-preparing' },
    pronto: { label: 'Pronto', icon: '✅', cls: 'stage-ready' },
    entregue: { label: 'Entregue', icon: '🍽️', cls: 'stage-delivered' },
    cancelado: { label: 'Cancelado', icon: '✕', cls: 'stage-cancelled' }
  };

  const mesaAbertaStatus = mesa => Boolean(mesa && (mesa.abertura || (Array.isArray(mesa.itens) && mesa.itens.length)));
  const agora = () => Date.now();
  const minutosDesde = ts => Math.max(0, Math.floor((agora() - (Number(ts) || agora())) / 60000));
  const textoTempo = ts => {
    const min = minutosDesde(ts);
    if (min < 1) return 'agora';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), r = min % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  };

  function pedidosAtivosDaMesa(numero) {
    return Object.entries(producaoCache || {})
      .filter(([, pedido]) => String(pedido?.mesa) === String(numero) && !['entregue', 'cancelado'].includes(pedido?.status))
      .sort((a, b) => (a[1].criadoEm || 0) - (b[1].criadoEm || 0));
  }

  function resumoMesa(numero, mesa) {
    const ativos = pedidosAtivosDaMesa(numero);
    const porStatus = status => ativos.filter(([, p]) => p.status === status);
    const primeiroTs = ativos[0]?.[1]?.criadoEm || mesa?.abertura || null;
    if (porStatus('pronto').length) return { ...STATUS.pronto, tempo: primeiroTs, detalhe: `${porStatus('pronto').length} pedido(s)` };
    if (porStatus('em_preparo').length) return { ...STATUS.em_preparo, tempo: primeiroTs, detalhe: `${porStatus('em_preparo').length} pedido(s)` };
    if (porStatus('recebido').length || porStatus('impresso').length) return { ...STATUS.recebido, tempo: primeiroTs, detalhe: `${ativos.length} pedido(s)` };
    const temNovo = Array.isArray(mesa?.itens) && mesa.itens.some(item => item.enviado === false && item.rascunho !== true);
    if (temNovo) return { label: 'Novo pedido', icon: '🔔', cls: 'stage-new', tempo: mesa.abertura, detalhe: 'aguarda envio' };
    if (mesaAbertaStatus(mesa) && (!mesa.itens || mesa.itens.length === 0)) return { label: 'Comanda aberta', icon: '○', cls: 'stage-open', tempo: mesa.abertura, detalhe: 'sem itens' };
    if (mesaAbertaStatus(mesa)) return { label: 'Ocupada', icon: '•', cls: 'stage-occupied', tempo: mesa.abertura, detalhe: `${mesa.itens.length} item(ns)` };
    return { label: 'Livre', icon: '', cls: 'stage-free', tempo: null, detalhe: 'disponível' };
  }

  window.gerarMesas = function gerarMesasComStatus() {
    const renderFaixa = (gridId, inicio, fim) => {
      const grid = document.getElementById(gridId);
      if (!grid) return;
      grid.innerHTML = '';
      for (let i = inicio; i <= fim; i++) {
        if (!mesas[i]) mesas[i] = { itens: [], cliente: '', abertura: null };
        if (!Array.isArray(mesas[i].itens)) mesas[i].itens = mesas[i].itens && typeof mesas[i].itens === 'object' ? Object.values(mesas[i].itens).filter(Boolean) : [];
        const status = resumoMesa(i, mesas[i]);
        const ativa = mesaAtualSelecionada === i ? 'active' : '';
        const aberta = mesaAbertaStatus(mesas[i]);
        const ocupada = aberta ? 'occupied' : '';
        const alertaTempo = aberta && mesas[i].abertura && (agora() - mesas[i].abertura > 60 * 60 * 1000) ? 'time-warning' : '';
        const badgeTempo = status.tempo ? `<span class="mesa-stage-time">${textoTempo(status.tempo)}</span>` : '';
        grid.insertAdjacentHTML('beforeend', `
          <button class="table-btn ${ativa} ${ocupada} ${alertaTempo} ${status.cls}" onclick="selecionarMesa(${i})" title="Mesa ${i}: ${status.label} — ${status.detalhe}">
            <span class="mesa-number">${i}</span>
            <span class="mesa-stage">${status.icon} ${status.label}</span>
            ${badgeTempo}
          </button>`);
      }
    };
    renderFaixa('grid-salao', 1, 25);
    renderFaixa('grid-deck', 50, 65);
  };

  const atualizarStatusBase = window.atualizarStatusProducao;
  window.atualizarStatusProducao = function atualizarStatusComTempo(chave, status) {
    const timestamp = agora();
    const campos = { status, atualizadoEm: timestamp };
    if (status === 'em_preparo') campos.emPreparoEm = timestamp;
    if (status === 'pronto') campos.prontoEm = timestamp;
    if (status === 'entregue') campos.entregueEm = timestamp;
    if (status === 'cancelado') campos.canceladoEm = timestamp;
    if (status !== 'recebido' && typeof pedidosNovosPdv !== 'undefined') {
      pedidosNovosPdv.delete(chave);
      if (typeof atualizarAlertaProducaoPdv === 'function') atualizarAlertaProducaoPdv();
    }
    return db.ref(`pedidosProducao/${chave}`).update(campos).then(() => {
      gerarMesas();
      if (typeof renderizarPainelProducao === 'function') renderizarPainelProducao();
    }).catch(erro => {
      console.error('Falha ao atualizar status de produção:', erro);
      if (atualizarStatusBase) return Promise.reject(erro);
    });
  };

  window.renderizarPainelProducao = function renderizarPainelProducaoComTempo() {
    const todos = Object.entries(producaoCache || {}).sort((a,b) => (b[1].criadoEm || 0) - (a[1].criadoEm || 0));
    const pendentes = todos.filter(([, p]) => !['entregue', 'cancelado'].includes(p.status)).length;
    const filtrados = todos.filter(([, pedido]) => {
      const setorOk = producaoFiltroSetor === 'todos' || pedido.setor === producaoFiltroSetor;
      const statusOk = producaoFiltroStatus === 'todos' || (producaoFiltroStatus === 'pendentes' ? !['entregue', 'cancelado'].includes(pedido.status) : pedido.status === producaoFiltroStatus);
      return setorOk && statusOk;
    });
    const count = document.getElementById('producao-pendente-count');
    if (count) count.innerText = pendentes;
    const resumo = document.getElementById('producao-resumo');
    if (resumo) resumo.innerText = `${filtrados.length} pedido(s) no filtro · ${pendentes} pendente(s)`;
    const lista = document.getElementById('producao-lista');
    if (!lista) return;
    lista.innerHTML = filtrados.slice(0, 18).map(([chave, pedido]) => {
      const info = STATUS[pedido.status] || STATUS.recebido;
      const idade = textoTempo(pedido.criadoEm);
      const novo = typeof pedidosNovosPdv !== 'undefined' && pedidosNovosPdv.has(chave) ? 'is-new' : '';
      const itens = (pedido.itens || []).map(item => `${item.qtd}x ${item.nome}`).join(', ');
      const proximo = pedido.status === 'recebido' || pedido.status === 'impresso'
        ? `<button onclick="atualizarStatusProducao('${chave}','em_preparo')">🔥 Iniciar</button>`
        : pedido.status === 'em_preparo'
          ? `<button onclick="atualizarStatusProducao('${chave}','pronto')">✅ Pronto</button>`
          : pedido.status === 'pronto'
            ? `<button onclick="atualizarStatusProducao('${chave}','entregue')">🍽️ Entregue</button>` : '';
      return `
        <div class="producao-card production-stage-card ${info.cls} ${novo}">
          <div class="production-card-head">
            <strong>Mesa ${pedido.mesa} · ${String(pedido.setor || '').toUpperCase()}</strong>
            <span class="production-status-pill">${info.icon} ${info.label}</span>
          </div>
          <div class="production-time">⏱ ${idade}${pedido.prontoEm ? ` · pronto há ${textoTempo(pedido.prontoEm)}` : ''}</div>
          <small>${itens || 'Sem itens'}</small>
          <select onchange="atualizarStatusProducao('${chave}', this.value)">
            ${['recebido','impresso','em_preparo','pronto','entregue','cancelado'].map(status => `<option value="${status}" ${pedido.status === status ? 'selected' : ''}>${(STATUS[status]?.label || status)}</option>`).join('')}
          </select>
          <div class="producao-card-actions production-quick-actions">
            ${proximo}
            <button class="secondary" onclick="imprimirPedidoProducao('${chave}', true)">🖨️ Imprimir</button>
          </div>
        </div>`;
    }).join('') || '<div class="production-empty">Nenhum pedido neste filtro.</div>';
    if (typeof atualizarPainelDiario === 'function') atualizarPainelDiario();
    gerarMesas();
  };

  // Atualiza cronômetros sem gerar tráfego extra no Firebase.
  setInterval(() => {
    try {
      gerarMesas();
      const painel = document.getElementById('producao-painel');
      if (painel && painel.style.display === 'block') renderizarPainelProducao();
    } catch (erro) {
      console.debug('Atualização visual de produção ignorada:', erro);
    }
  }, 30000);

  // Re-renderiza quando o cache de produção já estiver disponível.
  setTimeout(() => {
    try { gerarMesas(); renderizarPainelProducao(); } catch (_) {}
  }, 250);
})();
