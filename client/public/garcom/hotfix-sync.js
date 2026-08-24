/* Hotfix de sincronização do Garçom — preserva a interface original. */
(() => {
  const normalizarHotfixG = (valor) => {
    const mesa = valor && typeof valor === 'object' ? valor : {};
    let itens = Array.isArray(mesa.itens) ? mesa.itens : (mesa.itens && typeof mesa.itens === 'object' ? Object.values(mesa.itens) : []);
    return { ...mesa, itens: itens.filter(Boolean), cliente: typeof mesa.cliente === 'string' ? mesa.cliente : '', abertura: mesa.abertura || null };
  };
  const vaziaHotfixG = () => ({ itens: [], cliente: '', abertura: null });
  const estaAbertaG = mesa => Boolean(mesa && (mesa.abertura || (Array.isArray(mesa.itens) && mesa.itens.length)));
  const identidadeGarcomG = () => {
    try {
      const sessao = typeof window.sessaoGarcomAtual === 'function' ? window.sessaoGarcomAtual() : null;
      const nome = String(sessao?.nome || '').trim();
      if (!nome || nome === 'Acesso temporário') return null;
      return { nome, login: sessao.login || 'garcom', uid: sessao.uid || sessao.funcionarioId || null, compartilhado: sessao.compartilhado === true };
    } catch (_) { return null; }
  };

  window.renderizarMesasG = function renderizarMesasGSeguro() {
    const gridSalao = document.getElementById('grid-salao-g');
    const gridDeck = document.getElementById('grid-deck-g');
    if (!gridSalao || !gridDeck) return;
    gridSalao.innerHTML = '';
    gridDeck.innerHTML = '';
    const render = (numero, grid) => {
      if (!mesas[numero]) mesas[numero] = vaziaHotfixG();
      mesas[numero] = normalizarHotfixG(mesas[numero]);
      const aberta = estaAbertaG(mesas[numero]);
      const novo = mesas[numero].itens.some(it => it && it.enviado === false && it.rascunho !== true);
      const total = mesas[numero].itens.reduce((soma, item) => soma + ((Number(item.preco) || 0) * (Number(item.qtd) || 0)), 0);
      const estado = novo ? 'Pedido novo' : aberta ? 'Ocupada' : 'Livre';
      const garcom = mesas[numero]?.garcomResponsavel?.nome ? ` · ${mesas[numero].garcomResponsavel.nome}` : '';
      const resumo = mesas[numero].itens.length ? `${mesas[numero].itens.length} item(ns) · ${formatarMoeda(total)}${garcom}` : aberta ? `Comanda aberta${garcom}` : 'Toque para abrir';
      grid.insertAdjacentHTML('beforeend', `<button id="mesa-btn-g-${numero}" class="mesa-btn ${aberta ? 'occupied' : ''} ${novo ? 'novo-pedido' : ''}" aria-label="Mesa ${numero}: ${estado}" title="Mesa ${numero}: ${estado}" onclick="selecionarMesaG(${numero})"><span class="mesa-btn__state">${estado}</span><strong class="mesa-btn__number">${numero}</strong><span class="mesa-btn__meta">${resumo}</span></button>`);
    };
    for (let i = 1; i <= 25; i++) render(i, gridSalao);
    for (let i = 50; i <= 65; i++) render(i, gridDeck);
  };

  window.selecionarMesaG = async function selecionarMesaGSeguro(numero) {
    mesaSelecionada = numero;
    const atual = normalizarHotfixG(mesas[numero] || vaziaHotfixG());
    const precisaAbrir = !atual.abertura;
    if (precisaAbrir) {
      atual.abertura = Date.now();
      atual.origemAbertura = 'garcom';
      const identidade = identidadeGarcomG();
      if (identidade) {
        atual.garcomResponsavel = { ...identidade, atribuidoEm: Date.now() };
        atual.garconsAtendimento = [{ ...identidade, primeiroAtendimentoEm: Date.now() }];
      }
      mesas[numero] = atual;
      try {
        await db.ref(`mesas/${numero}`).set(atual);
        registrarAuditoriaGarcom('abrir_mesa', { mesa: numero, garcom: identidade?.nome || '' });
      } catch (erro) {
        console.error('Falha ao abrir mesa:', erro);
        atualizarStatusConexaoG('🔴 falha ao abrir mesa', 'sync-error');
        mesaSelecionada = null;
        alert('Não foi possível abrir a mesa no servidor. Verifique a conexão e tente novamente.');
        return;
      }
    } else {
      mesas[numero] = atual;
    }
    document.getElementById('tela-mesas').style.display = 'none';
    document.getElementById('tela-pedido').style.display = 'flex';
    document.getElementById('btn-voltar').style.display = 'inline-block';
    document.getElementById('header-titulo').innerText = `Mesa ${numero}`;
    document.getElementById('nome-cliente-g').value = mesas[numero].cliente || '';
    renderizarTabsG();
    filtrarCardapioG('favoritos');
    renderizarComandaG();
  };

  renderizarMesasG();
})();
