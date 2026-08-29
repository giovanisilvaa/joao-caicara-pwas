/* Cancelamento operacional v2 — remove item enviado e cria aviso de produção na mesma atualização. */
(() => {
  if (window.ITEM_CANCELLATION_RUNTIME === 'v2') return;
  window.ITEM_CANCELLATION_RUNTIME = 'v2';

  const clone = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));
  const originalGarcom = typeof window.alterarQtdG === 'function' ? window.alterarQtdG : null;
  const originalPdv = typeof window.alterarQtdItem === 'function' ? window.alterarQtdItem : null;

  function usuarioAtual(origem) {
    try {
      if (origem === 'garcom' && window.GarcomAtribuicao?.identidadeAtual) {
        const identidade = window.GarcomAtribuicao.identidadeAtual();
        if (identidade?.nome) return clone(identidade);
      }
    } catch (_) {}
    try {
      const user = firebase.auth().currentUser;
      if (user) return { uid: user.uid || null, email: user.email || '', nome: origem === 'pdv' ? 'Caixa / PDV' : 'Garçom' };
    } catch (_) {}
    return { nome: origem === 'pdv' ? 'Caixa / PDV' : 'Garçom' };
  }

  function atualizarTela(origem) {
    if (origem === 'garcom') {
      try { renderizarComandaG(); } catch (_) {}
      try { renderizarMesasG(); } catch (_) {}
    } else {
      try { renderizarComanda(); } catch (_) {}
      try { gerarMesas(); } catch (_) {}
      try { atualizarPainelDiario(); } catch (_) {}
    }
  }

  function mensagemBloqueio(motivo) {
    if (motivo === 'mesa_bloqueada') return 'Esta mesa está concluindo outra operação. Aguarde um instante e tente novamente.';
    return 'A comanda mudou enquanto o cancelamento era preparado. A tela será atualizada; tente novamente.';
  }

  async function cancelarItemEnviado({ numero, itemLocal, indexOriginal, quantidade = 1, origem }) {
    if (!window.MesaAtomic || !numero || !itemLocal) return false;
    const motivoDigitado = prompt(`Motivo do cancelamento de ${itemLocal.nome}:`);
    const motivo = String(motivoDigitado || '').trim();
    if (!motivo) {
      alert('Informe o motivo para cancelar um item já enviado.');
      return false;
    }

    let lock = null;
    try {
      lock = await window.MesaAtomic.bloquearMesa(numero, { tipo: 'cancelamento_item', origem });
      if (!lock.committed) {
        atualizarTela(origem);
        alert(mensagemBloqueio(lock.motivo));
        return false;
      }

      const mesaServidor = window.MesaAtomic.normalizarMesa(lock.mesa);
      let index = mesaServidor.itens.findIndex(item => item.itemOperacaoId && item.itemOperacaoId === itemLocal.itemOperacaoId);
      if (index < 0 && Number.isInteger(indexOriginal) && mesaServidor.itens[indexOriginal]) index = indexOriginal;
      if (index < 0) {
        await window.MesaAtomic.cancelarBloqueio(numero, lock.id, 'item_nao_encontrado');
        atualizarTela(origem);
        alert('O item mudou em outro aparelho. A comanda foi atualizada; tente novamente.');
        return false;
      }

      const itemServidor = mesaServidor.itens[index];
      if (itemServidor.enviado !== true) {
        await window.MesaAtomic.cancelarBloqueio(numero, lock.id, 'item_nao_enviado');
        atualizarTela(origem);
        alert('Este item ainda não foi enviado à produção. Tente novamente pelo botão de quantidade.');
        return false;
      }

      const qtdAntes = Math.max(0, Number(itemServidor.qtd) || 0);
      const qtdCancelar = Math.min(qtdAntes, Math.max(1, Number(quantidade) || 1));
      if (!qtdCancelar) {
        await window.MesaAtomic.cancelarBloqueio(numero, lock.id, 'quantidade_invalida');
        return false;
      }

      const mesaFinal = clone(mesaServidor);
      const itemFinal = mesaFinal.itens[index];
      const restante = qtdAntes - qtdCancelar;
      if (restante <= 0) mesaFinal.itens.splice(index, 1);
      else itemFinal.qtd = restante;
      if (!mesaFinal.itens.length) mesaFinal.abertura = null;
      window.MesaAtomic.marcarBloqueioInativo(mesaFinal, lock.id, 'cancelamento_confirmado');

      const agora = Date.now();
      const solicitante = usuarioAtual(origem);
      const setor = itemServidor.setor === 'bar' ? 'bar' : 'cozinha';
      const pedidoRef = db.ref('pedidosProducao').push();
      const auditoriaRef = db.ref('auditoria').push();
      const cancelamentoId = `cancel-${agora}-${Math.random().toString(36).slice(2, 8)}`;
      const itemCancelado = {
        id: itemServidor.id,
        nome: itemServidor.nome,
        preco: Number(itemServidor.preco) || 0,
        qtd: qtdCancelar,
        obs: `CANCELAMENTO — Motivo: ${motivo}`,
        setor,
        itemOperacaoId: itemServidor.itemOperacaoId || null,
        envioIdOriginal: itemServidor.envioId || null,
        cancelamento: true
      };
      const ticketCancelamento = {
        chave: pedidoRef.key,
        mesa: Number(numero),
        cliente: mesaServidor.cliente || '',
        setor,
        itens: [itemCancelado],
        status: 'recebido',
        origem: 'cancelamento',
        solicitadoPorOrigem: origem,
        tipo: 'cancelamento',
        motivo,
        cancelamentoId,
        solicitante,
        criadoEm: agora,
        atualizadoEm: agora
      };
      const auditoria = {
        acao: 'cancelar_item',
        mesa: Number(numero),
        item: itemServidor.nome,
        quantidade: qtdCancelar,
        motivo,
        origem,
        solicitante,
        criadoEm: agora,
        cancelamentoId
      };

      const atualizacoes = {
        [`mesas/${numero}`]: mesaFinal,
        [`pedidosProducao/${pedidoRef.key}`]: ticketCancelamento,
        [`auditoria/${auditoriaRef.key}`]: auditoria
      };

      // Compatibilidade com o histórico administrativo já existente no PDV.
      if (origem === 'pdv') {
        const cancelRef = db.ref('cancelamentos').push();
        atualizacoes[`cancelamentos/${cancelRef.key}`] = {
          id: cancelamentoId,
          mesa: Number(numero),
          item: { id: itemServidor.id, nome: itemServidor.nome, preco: Number(itemServidor.preco) || 0 },
          quantidade: qtdCancelar,
          motivo,
          origem,
          solicitante,
          criadoEm: agora
        };
      }

      await db.ref('/').update(atualizacoes);
      try {
        const snap = await db.ref(`mesas/${numero}`).once('value');
        const confirmada = window.MesaAtomic.normalizarMesa(snap.val());
        if (origem === 'garcom') mesas[numero] = confirmada;
        else mesas[numero] = confirmada;
      } catch (_) {
        mesas[numero] = mesaFinal;
      }
      atualizarTela(origem);
      alert(`Cancelamento confirmado: ${qtdCancelar}x ${itemServidor.nome}. A produção foi avisada.`);
      return true;
    } catch (erro) {
      console.error('Falha no cancelamento operacional do item:', erro);
      if (lock?.id) {
        try { await window.MesaAtomic.cancelarBloqueio(numero, lock.id, 'falha_cancelamento_item'); } catch (_) {}
      }
      atualizarTela(origem);
      alert('Não foi possível confirmar o cancelamento. O item foi mantido na comanda; tente novamente.');
      return false;
    }
  }

  if (originalGarcom) {
    window.alterarQtdG = async function alterarQtdGComCancelamento(index, delta) {
      const numero = typeof mesaSelecionada !== 'undefined' ? mesaSelecionada : null;
      const itemLocal = numero ? mesas[numero]?.itens?.[index] : null;
      if (delta < 0 && itemLocal?.enviado === true) {
        return cancelarItemEnviado({ numero, itemLocal, indexOriginal: index, quantidade: Math.abs(delta), origem: 'garcom' });
      }
      return originalGarcom(index, delta);
    };
  }

  if (originalPdv) {
    window.alterarQtdItem = async function alterarQtdItemComCancelamento(produtoId, indexOriginal, delta) {
      const numero = typeof mesaAtualSelecionada !== 'undefined' ? mesaAtualSelecionada : null;
      const itemLocal = numero ? mesas[numero]?.itens?.[indexOriginal] : null;
      if (delta < 0 && itemLocal?.enviado === true) {
        return cancelarItemEnviado({ numero, itemLocal, indexOriginal, quantidade: Math.abs(delta), origem: 'pdv' });
      }
      return originalPdv(produtoId, indexOriginal, delta);
    };
  }

  window.ItemCancellationV2 = Object.freeze({ cancelarItemEnviado });
})();
