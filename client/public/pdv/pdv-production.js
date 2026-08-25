/* Núcleo de produção do PDV — envio único, separação cozinha/bar e impressão pela mesma impressora. */
(() => {
  window.PDV_PRODUCTION_RUNTIME = 'v40';
  const clone = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));
  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[caractere]));

  function htmlItens(itens) {
    return (itens || []).map(item => {
      const obs = item.obs ? `<div style="font-size:13px;font-weight:normal;margin:2px 0 0 0;">↳ Obs: ${escapar(item.obs)}</div>` : '';
      const serve2 = item.servePara2 ? `<div style="font-size:11px;font-weight:normal;margin:2px 0 0 0;">(serve bem 2 pessoas)</div>` : '';
      return `<div class="cozinha-item">[ ] ${Number(item.qtd) || 0}x ${escapar(item.nome)}${obs}${serve2}</div>`;
    }).join('');
  }

  function prepararImpressao(setor, numeroMesa, cliente, itens, reimprimirTudo = false, criadoEm = Date.now()) {
    document.getElementById('prod-titulo').innerText = `${setor === 'bar' ? 'PEDIDO BAR' : 'PEDIDO COZINHA'}${reimprimirTudo ? ' (REIMPRESSÃO)' : ''}`;
    document.getElementById('prod-mesa').innerText = numeroMesa;
    document.getElementById('prod-cliente').innerText = cliente || 'Balcão/Geral';
    document.getElementById('prod-data').innerText = new Date(criadoEm || Date.now()).toLocaleString('pt-BR');
    document.getElementById('prod-itens').innerHTML = htmlItens(itens);
  }

  function imprimirAgora() {
    document.body.classList.add('print-mode-producao');
    try {
      window.print();
    } finally {
      document.body.classList.remove('print-mode-producao');
    }
  }

  function garantirEstruturaLote() {
    let estilo = document.getElementById('pdv-print-lote-style');
    if (!estilo) {
      estilo = document.createElement('style');
      estilo.id = 'pdv-print-lote-style';
      estilo.textContent = `
        #cupom-producao-lote { display:none; }
        @media print {
          body.print-mode-producao-lote #cupom-producao { display:none !important; }
          body.print-mode-producao-lote #cupom-producao-lote { display:block !important; width:80mm !important; padding:0 !important; margin:0 auto !important; }
          body.print-mode-producao-lote #cupom-producao-lote .pdv-comanda-folha { display:block !important; width:80mm; padding:4mm; margin:0; box-sizing:border-box; }
          body.print-mode-producao-lote #cupom-producao-lote .pdv-comanda-folha:not(:last-child) { page-break-after:always; break-after:page; }
          body.print-mode-producao-lote #cupom-producao-lote .pdv-comanda-folha:last-child { page-break-after:auto; break-after:auto; }
        }
      `;
      document.head.appendChild(estilo);
    }

    let container = document.getElementById('cupom-producao-lote');
    if (!container) {
      container = document.createElement('div');
      container.id = 'cupom-producao-lote';
      container.className = 'print-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function imprimirLote(documentos) {
    const lista = (documentos || []).filter(doc => doc && Array.isArray(doc.itens) && doc.itens.length);
    if (!lista.length) return;
    if (lista.length === 1) {
      const doc = lista[0];
      prepararImpressao(doc.setor, doc.numeroMesa ?? doc.mesa, doc.cliente, doc.itens, Boolean(doc.reimprimirTudo), doc.criadoEm);
      imprimirAgora();
      return;
    }

    const container = garantirEstruturaLote();
    container.innerHTML = lista.map(doc => {
      const setor = doc.setor === 'bar' ? 'bar' : 'cozinha';
      const titulo = `${setor === 'bar' ? 'PEDIDO BAR' : 'PEDIDO COZINHA'}${doc.reimprimirTudo ? ' (REIMPRESSÃO)' : ''}`;
      const mesa = doc.numeroMesa ?? doc.mesa ?? '-';
      const cliente = doc.cliente || 'Balcão/Geral';
      const data = new Date(doc.criadoEm || Date.now()).toLocaleString('pt-BR');
      return `<section class="pdv-comanda-folha">
        <div class="t-header">
          <h2>${escapar(titulo)}</h2>
          <p style="font-size:16px;">MESA: <strong>${escapar(mesa)}</strong> | CLIENTE: <span>${escapar(cliente)}</span></p>
          <p>Data: ${escapar(data)}</p>
        </div>
        <div style="margin-top:10px;">${htmlItens(doc.itens)}</div>
        <p style="text-align:center;margin-top:20px;font-size:10px;">Fim do pedido.</p>
      </section>`;
    }).join('');

    document.body.classList.add('print-mode-producao-lote');
    try {
      window.print();
    } finally {
      document.body.classList.remove('print-mode-producao-lote');
      container.innerHTML = '';
    }
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
        envioId: reserva.envioId,
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
    return { reserva, porSetor, cliente, criadoEm };
  }

  async function imprimirSetores(numeroMesa, cliente, porSetor, criadoEm = Date.now()) {
    const documentos = [];
    if (porSetor.cozinha?.length) documentos.push({ setor: 'cozinha', numeroMesa, cliente, itens: porSetor.cozinha, criadoEm });
    if (porSetor.bar?.length) documentos.push({ setor: 'bar', numeroMesa, cliente, itens: porSetor.bar, criadoEm });
    imprimirLote(documentos);
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
      await imprimirSetores(numeroMesa, resultado.cliente, resultado.porSetor, resultado.criadoEm);
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
      prepararImpressao(setor, numeroMesa, resultado.cliente, resultado.porSetor[setor] || [], false, resultado.criadoEm);
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
    const area = document.querySelector('.action-buttons');
    if (!area) return;
    const botoes = [...area.querySelectorAll('button')];
    const cozinha = botoes.find(b => b.classList.contains('btn-kitchen') && !/reimprimir/i.test(b.textContent || ''));
    const bar = botoes.find(b => b.classList.contains('btn-bar') && !/reimprimir/i.test(b.textContent || ''));
    if (cozinha) cozinha.style.display = 'none';
    if (bar) bar.style.display = 'none';

    let botao = document.getElementById('btn-enviar-producao-pdv');
    if (!botao) {
      botao = document.createElement('button');
      botao.id = 'btn-enviar-producao-pdv';
      botao.type = 'button';
      botao.className = 'btn btn-production-send';
      botao.innerText = '🖨️ ENVIAR PRODUÇÃO';
      botao.style.gridColumn = '1 / -1';
      botao.style.background = 'var(--primary)';
      botao.style.fontSize = '1rem';
      botao.onclick = () => window.enviarProducaoCompletaPdv();
      const referencia = cozinha || bar || area.querySelector('.btn-close');
      if (referencia) area.insertBefore(botao, referencia);
      else area.appendChild(botao);
    }
  }

  function garantirInterfaceProducao() {
    instalarBotaoUnico();
    setTimeout(instalarBotaoUnico, 250);
    setTimeout(instalarBotaoUnico, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', garantirInterfaceProducao, { once: true });
  else garantirInterfaceProducao();

  window.PdvProducao = Object.freeze({ prepararImpressao, imprimirAgora, imprimirLote, instalarBotaoUnico });
})();
