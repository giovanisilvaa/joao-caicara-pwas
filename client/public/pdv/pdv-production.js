/* Núcleo de produção do PDV — envio único, separação cozinha/bar e impressão pela mesma impressora. */
(() => {
  window.PDV_PRODUCTION_RUNTIME = 'v40';
  const clone = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));

  function prepararImpressao(setor, numeroMesa, cliente, itens, reimprimirTudo = false) {
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
    const mesa = window.MesaAtomic ? window.MesaAtomic.normalizarMesa(snap.val()) : (snap.val() || { itens: [], cliente: '', abertura: null });
    mesas[numeroMesa] = mesa;
    return mesa;
  }

  function bloquearEnvio(bloqueado) {
    document.querySelectorAll('#btn-enviar-producao-pdv,.btn-kitchen,.btn-bar').forEach(botao => {
      botao.disabled = Boolean(bloqueado);
      botao.style.opacity = bloqueado ? '.65' : '';
    });
  }

  async function reservarConfirmar(numeroMesa, setor = null) {
    const reserva = await window.MesaAtomic.reservarEnvio(numeroMesa, { setor, incluirRascunho: false, origem: 'pdv' });
    if (!reserva.committed) return { reserva };

    const itens = clone(reserva.meta.itens || []);
    const indices = reserva.meta.indices || [];
    const cliente = reserva.meta.cliente || '';
    const porSetor = { cozinha: [], bar: [] };
    itens.forEach(item => {
      const destino = item.setor === 'bar' ? 'bar' : 'cozinha';
      const copia = { ...item, envioId: reserva.envioId };
      delete copia.envioPendenteId;
      delete copia.envioReservadoEm;
      porSetor[destino].push(copia);
    });

    const criadoEm = Date.now();
    const atualizacoes = {
      [`mesas/${numeroMesa}/bloqueioOperacional/ativo`]: false,
      [`mesas/${numeroMesa}/bloqueioOperacional/liberadoEm`]: criadoEm,
      [`mesas/${numeroMesa}/bloqueioOperacional/motivoLiberacao`]: 'envio_confirmado'
    };
    Object.entries(porSetor).forEach(([destino, lista]) => {
      if (!lista.length) return;
      const pedidoRef = db.ref('pedidosProducao').push();
      atualizacoes[`pedidosProducao/${pedidoRef.key}`] = {
        chave: pedidoRef.key, mesa: numeroMesa, cliente, setor: destino, itens: lista,
        status: 'recebido', origem: 'pdv', criadoEm, atualizadoEm: criadoEm
      };
    });
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
    return { reserva, porSetor, cliente };
  }

  async function imprimirSetores(numeroMesa, cliente, porSetor) {
    if (porSetor.cozinha?.length) {
      prepararImpressao('cozinha', numeroMesa, cliente, porSetor.cozinha, false);
      imprimirAgora();
    }
    if (porSetor.bar?.length) {
      prepararImpressao('bar', numeroMesa, cliente, porSetor.bar, false);
      imprimirAgora();
    }
  }

  window.enviarProducaoCompletaPdv = async function enviarProducaoCompletaPdv() {
    if (!mesaAtualSelecionada) return alert('Selecione uma mesa!');
    if (!window.MesaAtomic) return alert('A proteção de concorrência ainda está carregando. Tente novamente em um instante.');
    const numeroMesa = mesaAtualSelecionada;
    bloquearEnvio(true);
    let resultado = null;
    try {
      resultado = await reservarConfirmar(numeroMesa, null);
      if (!resultado.reserva.committed) {
        if (resultado.reserva.motivo === 'sem_itens') return alert('Não há itens novos para enviar à produção.');
        return alert('A mesa está concluindo outra operação. Aguarde um instante e tente novamente.');
      }
      await imprimirSetores(numeroMesa, resultado.cliente, resultado.porSetor);
    } catch (erro) {
      console.error('Falha no envio completo da produção:', erro);
      if (resultado?.reserva?.envioId) {
        try { await window.MesaAtomic.cancelarBloqueio(numeroMesa, resultado.reserva.envioId, 'falha_producao_pdv'); } catch (_) {}
      }
      alert('Não foi possível enviar o pedido para produção. A comanda foi mantida para nova tentativa.');
    } finally {
      bloquearEnvio(false);
    }
  };

  window.imprimirProducao = async function imprimirProducaoSeguro(setor, reimprimirTudo) {
    if (!mesaAtualSelecionada) return alert('Selecione uma mesa!');
    const numeroMesa = mesaAtualSelecionada;
    if (reimprimirTudo) {
      const dadosMesa = await lerMesaServidor(numeroMesa);
      const itens = (dadosMesa.itens || []).filter(item => (setor === 'bar' ? item.setor === 'bar' : item.setor !== 'bar') && item.enviado === true);
      if (!itens.length) return alert(`Não há itens enviados de ${setor.toUpperCase()} nesta mesa.`);
      prepararImpressao(setor, numeroMesa, dadosMesa.cliente || '', itens, true);
      return imprimirAgora();
    }
    bloquearEnvio(true);
    let resultado = null;
    try {
      resultado = await reservarConfirmar(numeroMesa, setor);
      if (!resultado.reserva.committed) {
        if (resultado.reserva.motivo === 'sem_itens') return alert(`Não há itens novos para ${setor.toUpperCase()} nesta mesa.`);
        return alert('A mesa está concluindo outra operação. Aguarde um instante e tente novamente.');
      }
      prepararImpressao(setor, numeroMesa, resultado.cliente, resultado.porSetor[setor] || [], false);
      imprimirAgora();
    } catch (erro) {
      console.error('Falha ao confirmar produção:', erro);
      if (resultado?.reserva?.envioId) {
        try { await window.MesaAtomic.cancelarBloqueio(numeroMesa, resultado.reserva.envioId, 'falha_producao_pdv'); } catch (_) {}
      }
      alert(`Não foi possível enviar para ${setor.toUpperCase()}.`);
    } finally {
      bloquearEnvio(false);
    }
  };

  function instalarBotaoUnico() {
    if (document.getElementById('btn-enviar-producao-pdv')) return;
    const botoes = [...document.querySelectorAll('button')];
    const cozinha = botoes.find(b => /imprimirProducao\(['\"]cozinha['\"],\s*false\)/.test(b.getAttribute('onclick') || ''));
    const bar = botoes.find(b => /imprimirProducao\(['\"]bar['\"],\s*false\)/.test(b.getAttribute('onclick') || ''));
    if (!cozinha && !bar) return;
    const referencia = cozinha || bar;
    const botao = document.createElement('button');
    botao.id = 'btn-enviar-producao-pdv';
    botao.type = 'button';
    botao.className = referencia.className;
    botao.innerText = '🖨️ ENVIAR PRODUÇÃO';
    botao.style.gridColumn = '1 / -1';
    botao.onclick = () => window.enviarProducaoCompletaPdv();
    referencia.parentNode.insertBefore(botao, referencia);
    if (cozinha) cozinha.style.display = 'none';
    if (bar) bar.style.display = 'none';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalarBotaoUnico, { once: true });
  else instalarBotaoUnico();
})();
