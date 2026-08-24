/* Sincronização e renderização principal do PDV. */
(() => {
  const mesaVaziaSync = () => ({ itens: [], cliente: '', abertura: null });

  const normalizarMesaSync = (valor) => {
    const mesa = valor && typeof valor === 'object' ? valor : {};
    const itens = Array.isArray(mesa.itens)
      ? mesa.itens
      : (mesa.itens && typeof mesa.itens === 'object' ? Object.values(mesa.itens) : []);

    return {
      ...mesa,
      itens: itens.filter(Boolean),
      cliente: typeof mesa.cliente === 'string' ? mesa.cliente : '',
      abertura: mesa.abertura || null
    };
  };

  const mesaEstaAberta = mesa => Boolean(
    mesa && (mesa.abertura || (Array.isArray(mesa.itens) && mesa.itens.length))
  );

  // Persiste somente a mesa selecionada; nunca sobrescreve o nó /mesas inteiro.
  window.salvarMesas = function salvarMesasSeguro() {
    localStorage.setItem('mesas_abertas_caicara_cache', JSON.stringify(mesas));
    if (mesaAtualSelecionada === null || !mesas[mesaAtualSelecionada]) return Promise.resolve();
    return db.ref(`mesas/${mesaAtualSelecionada}`).set(mesas[mesaAtualSelecionada]);
  };

  window.atualizarPainelDiario = function atualizarPainelDiarioSeguro() {
    const vendasHoje = vendasCacheDiario.filter(vendaEhDeHoje);
    const totalVendas = vendasHoje.reduce((total, venda) => total + (Number(venda.total) || 0), 0);
    const mesasAbertas = Object.values(mesas).filter(mesaEstaAberta).length;

    const dataEl = document.getElementById('painel-diario-data');
    const vendasEl = document.getElementById('indicador-vendas');
    const mesasEl = document.getElementById('indicador-mesas');

    if (dataEl) dataEl.innerText = formatarDataPainel(new Date());
    if (vendasEl) vendasEl.innerText = formatarMoeda(totalVendas);
    if (mesasEl) mesasEl.innerText = String(mesasAbertas);
  };

  window.gerarMesas = function gerarMesasSeguro() {
    const agora = Date.now();

    const renderFaixa = (gridId, inicio, fim) => {
      const grid = document.getElementById(gridId);
      if (!grid) return;

      grid.innerHTML = '';

      for (let i = inicio; i <= fim; i++) {
        if (!mesas[i]) mesas[i] = mesaVaziaSync();
        mesas[i] = normalizarMesaSync(mesas[i]);

        const aberta = mesaEstaAberta(mesas[i]);
        const temPedido = mesas[i].itens.length > 0;
        const ativa = mesaAtualSelecionada === i ? 'active' : '';
        const ocupada = aberta ? 'occupied' : '';
        const temNovo = temPedido && mesas[i].itens.some(
          item => item.enviado === false && item.rascunho !== true
        );
        const nova = temNovo ? 'novo-pedido' : '';
        const tempo = aberta && mesas[i].abertura && (agora - mesas[i].abertura > 60 * 60 * 1000)
          ? 'time-warning'
          : '';
        const titulo = temNovo
          ? 'Pedido novo aguardando envio!'
          : aberta && !temPedido
            ? 'Comanda aberta sem itens'
            : '';

        grid.insertAdjacentHTML(
          'beforeend',
          `<button class="table-btn ${ativa} ${ocupada} ${tempo} ${nova}" onclick="selecionarMesa(${i})" title="${titulo}">${i}${temNovo ? ' 🔔' : ''}</button>`
        );
      }
    };

    renderFaixa('grid-salao', 1, 25);
    renderFaixa('grid-deck', 50, 65);
  };

  gerarMesas();
  atualizarPainelDiario();
})();
