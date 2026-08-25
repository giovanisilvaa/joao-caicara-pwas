/* Núcleo de impressão de produção do PDV — concorrência segura por item. */
(() => {
  window.PDV_PRODUCTION_RUNTIME = 'v40';
  const clone = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));

  function prepararImpressao(setor, numeroMesa, cliente, itens, reimprimirTudo) {
    document.getElementById('prod-titulo').innerText = `${setor === 'bar' ? 'PEDIDO BAR' : 'PEDIDO COZINHA'}${reimprimirTudo ? ' (REIMPRESSÃO)' : ''}`;
    document.getElementById('prod-mesa').innerText = numeroMesa;
    document.getElementById('prod-cliente').innerText = cliente || 'Balcão/Geral';
    document.getElementById('prod-data').innerText = new Date().toLocaleString('pt-BR');
    document.getElementById('prod-itens').innerHTML = itens.map(item => {
      const obs = item.obs ? `<div style="font-size:13px;font-weight:normal;margin:2px 0 0 0;">↳ Obs: ${item.obs}</div>` : '';
      const serve2 = item.servePara2 ? `<div style="font-size:11px;font-weight:normal;margin:2px 0 0 0;">(serve bem 2 pessoas)</div>` : '';
      return `<div class="cozinha-item">[ ] ${item.qtd}x ${item.nome}${obs}${serve2}</div>`;
    }).join('');
  }

  function imprimirAgora() {
    document.body.classList.add('print-mode-producao');
    window.print();
    document.body.classList.remove('print-mode-producao');
  }

  async function lerMesaServidor(numeroMesa) {
    const snap = await db.ref(`mesas/${numeroMesa}`).once('value');
    const mesa = window.MesaAtomic
      ? window.MesaAtomic.normalizarMesa(snap.val())
      : (snap.val() || { itens: [], cliente: '', abertura: null });
    mesas[numeroMesa] = mesa;
    return mesa;
  }

  function bloquearBotao(setor, bloqueado) {
    const seletor = setor === 'bar' ? '.btn-bar' : '.btn-kitchen';
    document.querySelectorAll(seletor).forEach(botao => {
      botao.disabled = Boolean(bloqueado);
      botao.style.opacity = bloqueado ? '.65' : '';
    });
  }

  window.imprimirProducao = async function imprimirProducaoSeguro(setor, reimprimirTudo) {
    if (!mesaAtualSelecionada) return alert('Selecione uma mesa!');
    const numeroMesa = mesaAtualSelecionada;

    if (reimprimirTudo) {
      try {
        const dadosMesa = await lerMesaServidor(numeroMesa);
        const itensReimpressao = (dadosMesa.itens || []).filter(item => {
          const setorOk = setor === 'bar' ? item.setor === 'bar' : item.setor !== 'bar';
          return setorOk && item.enviado === true;
        });
        if (!itensReimpressao.length) return alert(`Não há itens enviados de ${setor.toUpperCase()} nesta mesa.`);
        prepararImpressao(setor, numeroMesa, dadosMesa.cliente || '', itensReimpressao, true);
        imprimirAgora();
      } catch (erro) {
        console.error('Falha ao consultar a mesa para reimpressão:', erro);
        alert('Não foi possível consultar a comanda no servidor. Tente novamente.');
      }
      return;
    }

    if (!window.MesaAtomic) return alert('A proteção de concorrência ainda está carregando. Tente novamente em um instante.');
    bloquearBotao(setor, true);
    let reserva = null;
    try {
      reserva = await window.MesaAtomic.reservarEnvio(numeroMesa, {
        setor,
        incluirRascunho: false,
        origem: 'pdv'
      });
      if (!reserva.committed) {
        if (reserva.motivo === 'sem_itens') {
          await lerMesaServidor(numeroMesa).catch(() => null);
          if (typeof gerarMesas === 'function') gerarMesas();
          if (typeof renderizarComanda === 'function') renderizarComanda();
          return alert(`Não há itens novos para ${setor.toUpperCase()} nesta mesa.`);
        }
        return alert('A mesa está concluindo outra operação. Aguarde um instante e tente novamente.');
      }

      const itens = clone(reserva.meta.itens || []);
      const indices = reserva.meta.indices || [];
      const cliente = reserva.meta.cliente || '';
      const itensPedido = itens.map(item => {
        const copia = { ...item, envioId: reserva.envioId };
        delete copia.envioPendenteId;
        delete copia.envioReservadoEm;
        return copia;
      });
      const pedidoRef = db.ref('pedidosProducao').push();
      const criadoEm = Date.now();
      const atualizacoes = {
        [`pedidosProducao/${pedidoRef.key}`]: {
          chave: pedidoRef.key,
          mesa: numeroMesa,
          cliente,
          setor,
          itens: itensPedido,
          status: 'recebido',
          origem: 'pdv',
          criadoEm,
          atualizadoEm: criadoEm
        },
        [`mesas/${numeroMesa}/bloqueioOperacional/ativo`]: false,
        [`mesas/${numeroMesa}/bloqueioOperacional/liberadoEm`]: Date.now(),
        [`mesas/${numeroMesa}/bloqueioOperacional/motivoLiberacao`]: 'envio_confirmado'
      };

      indices.forEach(index => {
        atualizacoes[`mesas/${numeroMesa}/itens/${index}/enviado`] = true;
        atualizacoes[`mesas/${numeroMesa}/itens/${index}/rascunho`] = false;
        atualizacoes[`mesas/${numeroMesa}/itens/${index}/envioId`] = reserva.envioId;
        atualizacoes[`mesas/${numeroMesa}/itens/${index}/envioPendenteId`] = null;
        atualizacoes[`mesas/${numeroMesa}/itens/${index}/envioReservadoEm`] = null;
      });

      await db.ref('/').update(atualizacoes);
      await lerMesaServidor(numeroMesa);
      if (typeof gerarMesas === 'function') gerarMesas();
      if (typeof renderizarComanda === 'function') renderizarComanda();

      prepararImpressao(setor, numeroMesa, cliente, itensPedido, false);
      imprimirAgora();
    } catch (erro) {
      console.error('Falha ao confirmar produção de forma atômica:', erro);
      if (reserva?.envioId) {
        try { await window.MesaAtomic.cancelarBloqueio(numeroMesa, reserva.envioId, 'falha_producao_pdv'); } catch (_) {}
      }
      alert(`Não foi possível enviar para ${setor.toUpperCase()}. A comanda foi mantida para nova tentativa.`);
    } finally {
      bloquearBotao(setor, false);
    }
  };
})();
