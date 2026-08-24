/* Hotfix de sincronização do PDV — carregado após o index.html original. */
(() => {
  const mesaVaziaHotfix = () => ({ itens: [], cliente: '', abertura: null });
  const normalizarHotfix = (valor) => {
    const mesa = valor && typeof valor === 'object' ? valor : {};
    let itens = Array.isArray(mesa.itens) ? mesa.itens : (mesa.itens && typeof mesa.itens === 'object' ? Object.values(mesa.itens) : []);
    return { ...mesa, itens: itens.filter(Boolean), cliente: typeof mesa.cliente === 'string' ? mesa.cliente : '', abertura: mesa.abertura || null };
  };
  const mesaEstaAberta = (mesa) => Boolean(mesa && (mesa.abertura || (Array.isArray(mesa.itens) && mesa.itens.length)));

  // Nunca substitui o nó /mesas inteiro a partir de uma cópia local.
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
    if (dataEl) dataEl.innerText = formatarDataPainel(new Date());
    const vendasEl = document.getElementById('indicador-vendas');
    const mesasEl = document.getElementById('indicador-mesas');
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
        if (!mesas[i]) mesas[i] = mesaVaziaHotfix();
        mesas[i] = normalizarHotfix(mesas[i]);
        const aberta = mesaEstaAberta(mesas[i]);
        const temPedido = mesas[i].itens.length > 0;
        const ativa = mesaAtualSelecionada === i ? 'active' : '';
        const ocupada = aberta ? 'occupied' : '';
        const temNovo = temPedido && mesas[i].itens.some(item => item.enviado === false && item.rascunho !== true);
        const nova = temNovo ? 'novo-pedido' : '';
        const tempo = aberta && mesas[i].abertura && (agora - mesas[i].abertura > 60 * 60 * 1000) ? 'time-warning' : '';
        const titulo = temNovo ? 'Pedido novo aguardando envio!' : aberta && !temPedido ? 'Comanda aberta sem itens' : '';
        grid.insertAdjacentHTML('beforeend', `<button class="table-btn ${ativa} ${ocupada} ${tempo} ${nova}" onclick="selecionarMesa(${i})" title="${titulo}">${i}${temNovo ? ' 🔔' : ''}</button>`);
      }
    };
    renderFaixa('grid-salao', 1, 25);
    renderFaixa('grid-deck', 50, 65);
  };

  window.imprimirProducao = function imprimirProducaoSeguro(setor, reimprimirTudo) {
    if (!mesaAtualSelecionada) return alert('Selecione uma mesa!');
    const dadosMesa = mesas[mesaAtualSelecionada];
    if (!dadosMesa || !dadosMesa.itens.length) return alert('Comanda vazia!');
    let itensFiltrados = dadosMesa.itens.filter(item => {
      const setorOk = setor === 'bar' ? item.setor === 'bar' : item.setor !== 'bar';
      const estadoOk = reimprimirTudo ? item.enviado === true : (item.enviado === false && item.rascunho !== true);
      return setorOk && estadoOk;
    });
    document.getElementById('prod-titulo').innerText = `${setor === 'bar' ? 'PEDIDO BAR' : 'PEDIDO COZINHA'}${reimprimirTudo ? ' (REIMPRESSÃO)' : ''}`;
    if (!itensFiltrados.length) return alert(reimprimirTudo ? `Não há itens enviados de ${setor.toUpperCase()} nesta mesa.` : `Não há itens confirmados para ${setor.toUpperCase()}. Itens ainda em rascunho do garçom não são impressos.`);
    const numeroMesa = mesaAtualSelecionada;
    document.getElementById('prod-mesa').innerText = numeroMesa;
    document.getElementById('prod-cliente').innerText = dadosMesa.cliente || 'Balcão/Geral';
    document.getElementById('prod-data').innerText = new Date().toLocaleString('pt-BR');
    document.getElementById('prod-itens').innerHTML = itensFiltrados.map(item => {
      const obs = item.obs ? `<div style="font-size:13px;font-weight:normal;margin:2px 0 0 0;">↳ Obs: ${item.obs}</div>` : '';
      const serve2 = item.servePara2 ? `<div style="font-size:11px;font-weight:normal;margin:2px 0 0 0;">(serve bem 2 pessoas)</div>` : '';
      return `<div class="cozinha-item">[ ] ${item.qtd}x ${item.nome}${obs}${serve2}</div>`;
    }).join('');
    document.body.classList.add('print-mode-producao');
    window.print();
    document.body.classList.remove('print-mode-producao');
    if (reimprimirTudo) return;
    itensFiltrados.forEach(item => { item.enviado = true; item.rascunho = false; });
    Promise.all([
      db.ref(`mesas/${numeroMesa}`).set(dadosMesa),
      db.ref('pedidosProducao').push({ mesa: numeroMesa, cliente: dadosMesa.cliente || '', setor, itens: JSON.parse(JSON.stringify(itensFiltrados)), status: 'recebido', origem: 'pdv', criadoEm: Date.now(), atualizadoEm: Date.now() })
    ]).then(() => gerarMesas()).catch(erro => { console.error(erro); alert('Pedido impresso, mas houve falha ao confirmar a sincronização. Confira o status da conexão.'); });
  };

  window.transferirMesa = async function transferirMesaSeguro() {
    if (!mesaAtualSelecionada) return alert('Selecione uma mesa!');
    const origem = mesaAtualSelecionada;
    const destinoStr = prompt(`Transferir Mesa ${origem} para qual mesa? (número de 1 a 25 ou 50 a 65)`);
    if (destinoStr === null) return;
    const destino = parseInt(destinoStr, 10);
    if (Number.isNaN(destino) || destino === origem || !((destino >= 1 && destino <= 25) || (destino >= 50 && destino <= 65))) return alert('Número de mesa inválido.');
    try {
      const [snapOrigem, snapDestino] = await Promise.all([db.ref(`mesas/${origem}`).once('value'), db.ref(`mesas/${destino}`).once('value')]);
      const dadosOrigem = normalizarHotfix(snapOrigem.val() || mesas[origem]);
      const dadosDestino = normalizarHotfix(snapDestino.val() || mesas[destino] || mesaVaziaHotfix());
      if (!dadosOrigem.itens.length) return alert('A comanda está vazia, não há nada para transferir!');
      if (dadosDestino.itens.length && !confirm(`A Mesa ${destino} já está ocupada. Deseja JUNTAR a conta da Mesa ${origem} com a Mesa ${destino}?`)) return;
      const destinoFinal = normalizarHotfix(dadosDestino);
      if (destinoFinal.itens.length) {
        dadosOrigem.itens.forEach(item => {
          const igual = destinoFinal.itens.find(i => i.id === item.id && i.preco === item.preco && (i.obs || '') === (item.obs || '') && i.enviado === item.enviado && i.rascunho === item.rascunho);
          if (igual) igual.qtd = (Number(igual.qtd) || 0) + (Number(item.qtd) || 0); else destinoFinal.itens.push(item);
        });
        if (!destinoFinal.cliente && dadosOrigem.cliente) destinoFinal.cliente = dadosOrigem.cliente;
        destinoFinal.abertura = destinoFinal.abertura || dadosOrigem.abertura || Date.now();
      } else {
        destinoFinal.itens = dadosOrigem.itens;
        destinoFinal.cliente = dadosOrigem.cliente;
        destinoFinal.abertura = dadosOrigem.abertura || Date.now();
      }
      const origemFechada = mesaVaziaHotfix();
      await db.ref('/').update({ [`mesas/${origem}`]: origemFechada, [`mesas/${destino}`]: destinoFinal });
      mesas[origem] = origemFechada;
      mesas[destino] = destinoFinal;
      mesaAtualSelecionada = destino;
      document.getElementById('mesa-titulo').innerText = `Comanda - Mesa ${destino}`;
      document.getElementById('nome-cliente').value = destinoFinal.cliente || '';
      renderizarComanda(); gerarMesas(); atualizarPainelDiario();
      await registrarAuditoriaPdv('transferir_mesa', { origem, destino });
      alert(`Mesa ${origem} transferida para a Mesa ${destino} com sucesso!`);
    } catch (erro) {
      console.error('Falha ao transferir mesa:', erro);
      alert('Não foi possível transferir a mesa. Nenhuma alteração parcial foi confirmada.');
    }
  };

  window.imprimirCaixa = async function imprimirCaixaSeguro() {
    const mesaId = mesaAtualSelecionada;
    if (!mesaId || !mesas[mesaId]) return alert('Selecione uma mesa!');
    const dadosMesa = normalizarHotfix(mesas[mesaId]);
    const { subtotal, taxa, total } = calcularTotalComTaxa('chk-taxa-servico');
    const dinheiro = parseFloat(document.getElementById('pag-dinheiro').value) || 0;
    const pix = parseFloat(document.getElementById('pag-pix').value) || 0;
    const credito = parseFloat(document.getElementById('pag-credito').value) || 0;
    const debito = parseFloat(document.getElementById('pag-debito').value) || 0;
    const informado = dinheiro + pix + credito + debito;
    if (informado < total - 0.01) return alert('O pagamento informado ainda é insuficiente.');
    const troco = informado - total;
    const dataAtualStr = new Date().toLocaleString('pt-BR');
    const registro = { id: `pdv-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, mesa: mesaId, cliente: dadosMesa.cliente || 'Não informado', dataHora: dataAtualStr, criadoEm: Date.now(), itens: JSON.parse(JSON.stringify(dadosMesa.itens)), subtotal, taxa, total, pagamentos: { dinheiro, pix, credito, debito }, troco, origem: 'pdv' };
    const vendaRef = db.ref('vendas').push();
    try {
      await db.ref('/').update({ [`vendas/${vendaRef.key}`]: registro, [`mesas/${mesaId}`]: mesaVaziaHotfix() });
      const historico = JSON.parse(localStorage.getItem('historico_vendas_caicara')) || [];
      historico.unshift(registro); localStorage.setItem('historico_vendas_caicara', JSON.stringify(historico));
      let detalhe = '';
      if (dinheiro > 0) detalhe += `Dinheiro: ${formatarMoeda(dinheiro)}<br>`;
      if (pix > 0) detalhe += `PIX: ${formatarMoeda(pix)}<br>`;
      if (credito > 0) detalhe += `Crédito: ${formatarMoeda(credito)}<br>`;
      if (debito > 0) detalhe += `Débito: ${formatarMoeda(debito)}<br>`;
      if (troco > 0.01) detalhe += `Troco dado: ${formatarMoeda(troco)}`;
      document.getElementById('caixa-mesa').innerText = mesaId;
      document.getElementById('caixa-cliente').innerText = dadosMesa.cliente || 'Não informado';
      document.getElementById('caixa-data').innerText = dataAtualStr;
      document.getElementById('caixa-detalhe-pgto').innerHTML = detalhe;
      document.getElementById('caixa-subtotal-valor').innerText = formatarMoeda(subtotal);
      document.getElementById('caixa-linha-taxa').style.display = taxa > 0 ? 'flex' : 'none';
      document.getElementById('caixa-taxa-valor').innerText = formatarMoeda(taxa);
      document.getElementById('caixa-total-valor').innerText = formatarMoeda(total);
      document.getElementById('caixa-itens').innerHTML = dadosMesa.itens.map(item => `<div class="t-item"><span class="t-item-name">${item.qtd}x ${item.nome}</span><span>R$ ${((Number(item.preco)||0)*(Number(item.qtd)||0)).toFixed(2)}</span></div>`).join('');
      mesas[mesaId] = mesaVaziaHotfix();
      fecharModais();
      document.body.classList.add('print-mode-caixa'); window.print(); document.body.classList.remove('print-mode-caixa');
      mesaAtualSelecionada = null;
      document.getElementById('mesa-titulo').innerText = 'Selecione uma Mesa';
      document.getElementById('nome-cliente').value = '';
      document.getElementById('menu-panel').classList.remove('active');
      document.getElementById('order-items').innerHTML = '<p style="text-align:center; color:#999; margin-top:20px;">Nenhuma mesa selecionada.</p>';
      document.getElementById('total-valor').innerText = formatarMoeda(0);
      gerarMesas(); atualizarPainelDiario();
      registrarAuditoriaPdv('fechar_conta', { mesa: mesaId, total, venda: registro.id });
    } catch (erro) {
      console.error('Falha no fechamento atômico:', erro);
      alert('Não foi possível registrar o fechamento. A mesa foi mantida aberta.');
    }
  };

  gerarMesas();
  atualizarPainelDiario();
})();
