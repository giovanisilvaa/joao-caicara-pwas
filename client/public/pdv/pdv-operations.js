/* Operações críticas do PDV separadas do hotfix principal. */
(() => {
  const mesaVaziaOperacoes = () => ({ itens: [], cliente: '', abertura: null });

  const normalizarMesaOperacoes = (valor) => {
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

  window.transferirMesa = async function transferirMesaSeguro() {
    if (!mesaAtualSelecionada) return alert('Selecione uma mesa!');

    const origem = mesaAtualSelecionada;
    const destinoStr = prompt(`Transferir Mesa ${origem} para qual mesa? (número de 1 a 25 ou 50 a 65)`);
    if (destinoStr === null) return;

    const destino = parseInt(destinoStr, 10);
    const destinoValido = (destino >= 1 && destino <= 25) || (destino >= 50 && destino <= 65);
    if (Number.isNaN(destino) || destino === origem || !destinoValido) return alert('Número de mesa inválido.');

    try {
      const [snapOrigem, snapDestino] = await Promise.all([
        db.ref(`mesas/${origem}`).once('value'),
        db.ref(`mesas/${destino}`).once('value')
      ]);

      const dadosOrigem = normalizarMesaOperacoes(snapOrigem.val() || mesas[origem]);
      const dadosDestino = normalizarMesaOperacoes(snapDestino.val() || mesas[destino] || mesaVaziaOperacoes());

      if (!dadosOrigem.itens.length) return alert('A comanda está vazia, não há nada para transferir!');
      if (dadosDestino.itens.length && !confirm(`A Mesa ${destino} já está ocupada. Deseja JUNTAR a conta da Mesa ${origem} com a Mesa ${destino}?`)) return;

      const destinoFinal = normalizarMesaOperacoes(dadosDestino);
      if (destinoFinal.itens.length) {
        dadosOrigem.itens.forEach(item => {
          const igual = destinoFinal.itens.find(i =>
            i.id === item.id &&
            i.preco === item.preco &&
            (i.obs || '') === (item.obs || '') &&
            i.enviado === item.enviado &&
            i.rascunho === item.rascunho
          );
          if (igual) {
            igual.qtd = (Number(igual.qtd) || 0) + (Number(item.qtd) || 0);
          } else {
            destinoFinal.itens.push(item);
          }
        });
        if (!destinoFinal.cliente && dadosOrigem.cliente) destinoFinal.cliente = dadosOrigem.cliente;
        destinoFinal.abertura = destinoFinal.abertura || dadosOrigem.abertura || Date.now();
      } else {
        destinoFinal.itens = dadosOrigem.itens;
        destinoFinal.cliente = dadosOrigem.cliente;
        destinoFinal.abertura = dadosOrigem.abertura || Date.now();
      }

      const origemFechada = mesaVaziaOperacoes();
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
      alert('Não foi possível transferir a mesa. Nenhuma alteração parcial foi confirmada.');
    }
  };
})();
