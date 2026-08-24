/* Núcleo de impressão de produção do PDV — separado da sincronização das mesas. */
(() => {
  window.imprimirProducao = function imprimirProducaoSeguro(setor, reimprimirTudo) {
    if (!mesaAtualSelecionada) return alert('Selecione uma mesa!');
    const dadosMesa = mesas[mesaAtualSelecionada];
    if (!dadosMesa || !dadosMesa.itens.length) return alert('Comanda vazia!');

    const itensFiltrados = dadosMesa.itens.filter(item => {
      const setorOk = setor === 'bar' ? item.setor === 'bar' : item.setor !== 'bar';
      const estadoOk = reimprimirTudo
        ? item.enviado === true
        : (item.enviado === false && item.rascunho !== true);
      return setorOk && estadoOk;
    });

    document.getElementById('prod-titulo').innerText = `${setor === 'bar' ? 'PEDIDO BAR' : 'PEDIDO COZINHA'}${reimprimirTudo ? ' (REIMPRESSÃO)' : ''}`;

    if (!itensFiltrados.length) {
      return alert(
        reimprimirTudo
          ? `Não há itens enviados de ${setor.toUpperCase()} nesta mesa.`
          : `Não há itens confirmados para ${setor.toUpperCase()}. Itens ainda em rascunho do garçom não são impressos.`
      );
    }

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

    itensFiltrados.forEach(item => {
      item.enviado = true;
      item.rascunho = false;
    });

    Promise.all([
      db.ref(`mesas/${numeroMesa}`).set(dadosMesa),
      db.ref('pedidosProducao').push({
        mesa: numeroMesa,
        cliente: dadosMesa.cliente || '',
        setor,
        itens: JSON.parse(JSON.stringify(itensFiltrados)),
        status: 'recebido',
        origem: 'pdv',
        criadoEm: Date.now(),
        atualizadoEm: Date.now()
      })
    ])
      .then(() => gerarMesas())
      .catch(erro => {
        console.error(erro);
        alert('Pedido impresso, mas houve falha ao confirmar a sincronização. Confira o status da conexão.');
      });
  };
})();
