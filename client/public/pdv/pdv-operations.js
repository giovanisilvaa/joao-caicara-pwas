/* Operações críticas do PDV — transferência protegida por locks transacionais. */
(() => {
  const clone = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));

  window.transferirMesa = async function transferirMesaSeguro() {
    if (!mesaAtualSelecionada) return alert('Selecione uma mesa!');
    if (!window.MesaAtomic) return alert('A proteção de concorrência ainda está carregando. Tente novamente em um instante.');

    const origem = mesaAtualSelecionada;
    const destinoStr = prompt(`Transferir Mesa ${origem} para qual mesa? (número de 1 a 25 ou 50 a 65)`);
    if (destinoStr === null) return;
    const destino = parseInt(destinoStr, 10);
    const destinoValido = (destino >= 1 && destino <= 25) || (destino >= 50 && destino <= 65);
    if (Number.isNaN(destino) || destino === origem || !destinoValido) return alert('Número de mesa inválido.');

    let lockOrigem = null;
    let lockDestino = null;
    try {
      lockOrigem = await window.MesaAtomic.bloquearMesa(origem, { tipo: 'transferencia_origem', origem: 'pdv' });
      if (!lockOrigem.committed) return alert('A mesa de origem está em outra operação. Aguarde um instante e tente novamente.');

      lockDestino = await window.MesaAtomic.bloquearMesa(destino, { tipo: 'transferencia_destino', origem: 'pdv' });
      if (!lockDestino.committed) {
        await window.MesaAtomic.cancelarBloqueio(origem, lockOrigem.id, 'destino_ocupado_por_operacao');
        return alert('A mesa de destino está em outra operação. Aguarde um instante e tente novamente.');
      }

      const dadosOrigem = window.MesaAtomic.normalizarMesa(lockOrigem.mesa);
      const dadosDestino = window.MesaAtomic.normalizarMesa(lockDestino.mesa);
      if (!dadosOrigem.itens.length) {
        await Promise.all([
          window.MesaAtomic.cancelarBloqueio(origem, lockOrigem.id, 'origem_vazia'),
          window.MesaAtomic.cancelarBloqueio(destino, lockDestino.id, 'origem_vazia')
        ]);
        return alert('A comanda está vazia, não há nada para transferir!');
      }

      if (dadosDestino.itens.length && !confirm(`A Mesa ${destino} já está ocupada. Deseja JUNTAR a conta da Mesa ${origem} com a Mesa ${destino}?`)) {
        await Promise.all([
          window.MesaAtomic.cancelarBloqueio(origem, lockOrigem.id, 'transferencia_cancelada'),
          window.MesaAtomic.cancelarBloqueio(destino, lockDestino.id, 'transferencia_cancelada')
        ]);
        return;
      }

      const destinoFinal = window.MesaAtomic.normalizarMesa(dadosDestino);
      dadosOrigem.itens.forEach(item => {
        const igual = destinoFinal.itens.find(i =>
          i.id === item.id &&
          Number(i.preco) === Number(item.preco) &&
          (i.obs || '') === (item.obs || '') &&
          i.enviado === item.enviado &&
          i.rascunho === item.rascunho &&
          String(i.garcomLancamento?.nome || '') === String(item.garcomLancamento?.nome || '')
        );
        if (igual) igual.qtd = (Number(igual.qtd) || 0) + (Number(item.qtd) || 0);
        else destinoFinal.itens.push(clone(item));
      });
      if (!destinoFinal.cliente && dadosOrigem.cliente) destinoFinal.cliente = dadosOrigem.cliente;
      destinoFinal.abertura = destinoFinal.abertura || dadosOrigem.abertura || Date.now();

      const atendentes = [
        ...(Array.isArray(destinoFinal.garconsAtendimento) ? destinoFinal.garconsAtendimento : []),
        ...(Array.isArray(dadosOrigem.garconsAtendimento) ? dadosOrigem.garconsAtendimento : [])
      ];
      if (atendentes.length) {
        const vistos = new Set();
        destinoFinal.garconsAtendimento = atendentes.filter(item => {
          const chave = `${String(item?.nome || '').toLowerCase()}|${item?.uid || ''}`;
          if (vistos.has(chave)) return false;
          vistos.add(chave);
          return true;
        });
      }
      if (!destinoFinal.garcomResponsavel && dadosOrigem.garcomResponsavel) destinoFinal.garcomResponsavel = clone(dadosOrigem.garcomResponsavel);

      // A mesa de destino continua com o mesmo lock, mas já liberado, para que a
      // substituição final não perca a proteção durante o update multipath.
      destinoFinal.bloqueioOperacional = {
        ...(dadosDestino.bloqueioOperacional || {}),
        id: lockDestino.id,
        ativo: false,
        liberadoEm: Date.now(),
        motivoLiberacao: 'transferencia_concluida'
      };
      const origemFechada = window.MesaAtomic.mesaVazia();
      await db.ref('/').update({
        [`mesas/${origem}`]: origemFechada,
        [`mesas/${destino}`]: destinoFinal
      });

      mesas[origem] = origemFechada;
      mesas[destino] = destinoFinal;
      mesaAtualSelecionada = destino;
      const titulo = document.getElementById('mesa-titulo');
      const nomeCliente = document.getElementById('nome-cliente');
      if (titulo) titulo.innerText = `Comanda - Mesa ${destino}`;
      if (nomeCliente) nomeCliente.value = destinoFinal.cliente || '';
      if (typeof renderizarComanda === 'function') renderizarComanda();
      if (typeof gerarMesas === 'function') gerarMesas();
      if (typeof atualizarPainelDiario === 'function') atualizarPainelDiario();
      if (typeof registrarAuditoriaPdv === 'function') {
        Promise.resolve(registrarAuditoriaPdv('transferir_mesa', { origem, destino }))
          .catch(erro => console.warn('Falha ao registrar auditoria da transferência:', erro));
      }
      alert(`Mesa ${origem} transferida para a Mesa ${destino} com sucesso!`);
    } catch (erro) {
      console.error('Falha ao transferir mesa:', erro);
      if (lockOrigem?.id) {
        try { await window.MesaAtomic.cancelarBloqueio(origem, lockOrigem.id, 'falha_transferencia'); } catch (_) {}
      }
      if (lockDestino?.id) {
        try { await window.MesaAtomic.cancelarBloqueio(destino, lockDestino.id, 'falha_transferencia'); } catch (_) {}
      }
      alert('Não foi possível transferir a mesa. Nenhuma alteração parcial foi confirmada.');
    }
  };
})();
