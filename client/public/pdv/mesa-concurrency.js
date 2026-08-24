/* Concorrência segura do PDV — alterações da comanda por transação. */
(() => {
  const atomic = () => window.MesaAtomic;

  function atualizarTela() {
    try { renderizarComanda(); } catch (_) {}
    try { gerarMesas(); } catch (_) {}
    try { atualizarPainelDiario(); } catch (_) {}
  }

  function mensagem(motivo) {
    if (motivo === 'mesa_bloqueada') return 'A mesa está concluindo outra operação. Aguarde um instante e tente novamente.';
    if (motivo === 'item_nao_encontrado') return 'A comanda mudou em outro aparelho. A tela foi atualizada; tente novamente.';
    return 'Não foi possível concluir a alteração agora.';
  }

  window.adicionarProduto = async function adicionarProdutoAtomico(produtoId) {
    if (!mesaAtualSelecionada || !atomic()) return;
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    try {
      const resultado = await atomic().adicionarItem(mesaAtualSelecionada, produto, { origem: 'pdv', rascunho: false });
      if (!resultado.committed) return alert(mensagem(resultado.motivo));
      mesas[mesaAtualSelecionada] = resultado.mesa;
      atualizarTela();
    } catch (erro) {
      console.error('Falha ao adicionar produto de forma atômica:', erro);
      alert('Não foi possível adicionar o produto. Tente novamente.');
    }
  };

  window.alterarQtdItem = async function alterarQtdItemAtomico(produtoId, indexOriginal, delta) {
    if (!mesaAtualSelecionada || !atomic()) return;
    const numero = mesaAtualSelecionada;
    const itemLocal = mesas[numero]?.itens?.[indexOriginal];
    if (!itemLocal) return;

    let motivoCancelamento = '';
    if (delta < 0 && itemLocal.enviado === true) {
      const motivo = prompt(`Motivo do cancelamento de ${itemLocal.nome}:`);
      if (!motivo || !motivo.trim()) return alert('Informe o motivo para cancelar um item já enviado.');
      motivoCancelamento = motivo.trim();
    }

    try {
      const resultado = await atomic().alterarQuantidade(numero, itemLocal.itemOperacaoId, delta, indexOriginal);
      if (!resultado.committed) {
        atualizarTela();
        return alert(mensagem(resultado.motivo));
      }
      mesas[numero] = resultado.mesa;
      atualizarTela();

      const itemAntes = resultado.meta.itemAntes || itemLocal;
      const removida = Number(resultado.meta.quantidadeRemovida) || Math.min(Math.abs(delta), Number(itemAntes.qtd) || 0);
      if (delta < 0 && itemAntes.enviado === true) {
        if (!motivoCancelamento) motivoCancelamento = 'Ajuste concorrente confirmado no PDV';
        if (typeof registrarCancelamentoItem === 'function') {
          Promise.resolve(registrarCancelamentoItem(numero, itemAntes, removida, motivoCancelamento, 'pdv'))
            .then(() => typeof registrarAuditoriaPdv === 'function' && registrarAuditoriaPdv('cancelar_item', { mesa: numero, item: itemAntes.nome, motivo: motivoCancelamento }))
            .catch(erro => console.warn('Quantidade alterada, mas o registro de cancelamento falhou:', erro));
        }
      }
    } catch (erro) {
      console.error('Falha ao alterar quantidade de forma atômica:', erro);
      alert('Não foi possível alterar a quantidade. Tente novamente.');
    }
  };

  window.editarObsItem = async function editarObsItemAtomico(indexOriginal) {
    if (!mesaAtualSelecionada || !atomic()) return;
    const numero = mesaAtualSelecionada;
    const item = mesas[numero]?.itens?.[indexOriginal];
    if (!item) return;
    const novaObs = prompt(`Observação para: ${item.nome}\n(ex: sem cebola, ao ponto, sem gelo...)`, item.obs || '');
    if (novaObs === null) return;
    try {
      const resultado = await atomic().atualizarItem(numero, item.itemOperacaoId, { obs: novaObs.trim() }, indexOriginal);
      if (!resultado.committed) return alert(mensagem(resultado.motivo));
      mesas[numero] = resultado.mesa;
      atualizarTela();
    } catch (erro) {
      console.error('Falha ao editar observação de forma atômica:', erro);
      alert('Não foi possível salvar a observação.');
    }
  };

  window.editarPrecoItem = async function editarPrecoItemAtomico(indexOriginal) {
    if (!mesaAtualSelecionada || !atomic()) return;
    const numero = mesaAtualSelecionada;
    const item = mesas[numero]?.itens?.[indexOriginal];
    if (!item) return;
    let novoPreco = prompt(`Novo preço para ${item.nome}:`, Number(item.preco || 0).toFixed(2).replace('.', ','));
    if (novoPreco === null) return;
    novoPreco = parseFloat(String(novoPreco).replace(',', '.'));
    if (!Number.isFinite(novoPreco) || novoPreco < 0) return alert('Valor inválido! Digite apenas números.');
    try {
      const resultado = await atomic().atualizarItem(numero, item.itemOperacaoId, { preco: novoPreco }, indexOriginal);
      if (!resultado.committed) return alert(mensagem(resultado.motivo));
      mesas[numero] = resultado.mesa;
      atualizarTela();
      if (typeof registrarAuditoriaPdv === 'function') {
        Promise.resolve(registrarAuditoriaPdv('editar_preco', { mesa: numero, item: item.nome, novoPreco })).catch(() => {});
      }
    } catch (erro) {
      console.error('Falha ao editar preço de forma atômica:', erro);
      alert('Não foi possível alterar o preço.');
    }
  };

  window.atualizarNomeCliente = async function atualizarNomeClienteAtomico() {
    if (!mesaAtualSelecionada || !atomic()) return;
    const numero = mesaAtualSelecionada;
    const nome = document.getElementById('nome-cliente')?.value || '';
    try {
      const resultado = await atomic().atualizarCliente(numero, nome);
      if (resultado.committed) mesas[numero] = resultado.mesa;
    } catch (erro) {
      console.warn('Falha ao atualizar cliente no PDV:', erro);
    }
  };

  window.PdvConcorrencia = Object.freeze({ atualizarTela });
})();
