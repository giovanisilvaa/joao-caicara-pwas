/* Concorrência segura do Garçom — evita perda de itens quando vários aparelhos usam a mesma mesa. */
(() => {
  const atomic = () => window.MesaAtomic;
  const clone = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));

  function identidadeAtual() {
    try {
      if (window.GarcomAtribuicao?.identidadeAtual) return window.GarcomAtribuicao.identidadeAtual();
      const sessao = typeof window.sessaoGarcomAtual === 'function' ? window.sessaoGarcomAtual() : null;
      const nome = String(sessao?.nome || '').trim();
      if (!nome) return null;
      return { nome, login: sessao.login || 'garcom', uid: sessao.uid || sessao.funcionarioId || null, compartilhado: sessao.compartilhado === true };
    } catch (_) { return null; }
  }

  function atualizarTelaMesa() {
    try { renderizarComandaG(); } catch (_) {}
    try { renderizarMesasG(); } catch (_) {}
  }

  function mensagemBloqueio(motivo) {
    if (motivo === 'mesa_bloqueada') return 'Esta mesa está concluindo outra operação. Aguarde um instante e tente novamente.';
    if (motivo === 'item_nao_encontrado') return 'A comanda mudou em outro aparelho. Ela foi atualizada; tente novamente.';
    return 'Não foi possível concluir a alteração agora. Tente novamente.';
  }

  function efeitoAdicao(produtoId) {
    const card = document.querySelector(`[data-produto-id="${produtoId}"]`);
    if (card) {
      card.classList.remove('speed-added');
      void card.offsetWidth;
      card.classList.add('speed-added');
      setTimeout(() => card.classList.remove('speed-added'), 450);
    }
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (_) {}
  }

  window.selecionarMesaG = async function selecionarMesaGAtomico(numero) {
    if (!atomic()) return;
    mesaSelecionada = numero;
    try {
      const resultado = await atomic().abrirMesa(numero, { identidade: identidadeAtual(), origem: 'garcom' });
      if (!resultado.committed) {
        mesaSelecionada = null;
        return alert(mensagemBloqueio(resultado.motivo));
      }
      mesas[numero] = resultado.mesa;
      document.getElementById('tela-mesas').style.display = 'none';
      document.getElementById('tela-pedido').style.display = 'flex';
      document.getElementById('btn-voltar').style.display = 'inline-block';
      document.getElementById('header-titulo').innerText = `Mesa ${numero}`;
      document.getElementById('nome-cliente-g').value = resultado.mesa.cliente || '';
      renderizarTabsG();
      filtrarCardapioG('favoritos');
      renderizarComandaG();
      if (typeof registrarAuditoriaGarcom === 'function' && resultado.mesa.origemAbertura === 'garcom') {
        Promise.resolve(registrarAuditoriaGarcom('acessar_mesa', { mesa: numero, garcom: identidadeAtual()?.nome || '' })).catch(() => {});
      }
    } catch (erro) {
      console.error('Falha ao abrir mesa com transação:', erro);
      mesaSelecionada = null;
      alert('Não foi possível abrir a mesa no servidor. Verifique a conexão e tente novamente.');
    }
  };

  window.adicionarItemG = async function adicionarItemGAtomico(produtoId) {
    if (!mesaSelecionada || !atomic()) return;
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    try {
      const resultado = await atomic().adicionarItem(mesaSelecionada, produto, {
        identidade: identidadeAtual(),
        origem: 'garcom',
        rascunho: true
      });
      if (!resultado.committed) return alert(mensagemBloqueio(resultado.motivo));
      mesas[mesaSelecionada] = resultado.mesa;
      renderizarComandaG();
      renderizarMesasG();
      efeitoAdicao(produtoId);
    } catch (erro) {
      console.error('Falha ao adicionar item de forma atômica:', erro);
      alert('Não foi possível adicionar o item. Confira a conexão e tente novamente.');
    }
  };

  window.alterarQtdG = async function alterarQtdGAtomico(index, delta) {
    if (!mesaSelecionada || !atomic()) return;
    const itemLocal = mesas[mesaSelecionada]?.itens?.[index];
    if (!itemLocal) return;
    try {
      const resultado = await atomic().alterarQuantidade(mesaSelecionada, itemLocal.itemOperacaoId, delta, index);
      if (!resultado.committed) {
        atualizarTelaMesa();
        return alert(mensagemBloqueio(resultado.motivo));
      }
      mesas[mesaSelecionada] = resultado.mesa;
      atualizarTelaMesa();
    } catch (erro) {
      console.error('Falha ao alterar quantidade de forma atômica:', erro);
      alert('Não foi possível alterar a quantidade. Tente novamente.');
    }
  };

  window.atualizarNomeClienteG = async function atualizarNomeClienteGAtomico() {
    if (!mesaSelecionada || !atomic()) return;
    const nome = document.getElementById('nome-cliente-g')?.value || '';
    try {
      const resultado = await atomic().atualizarCliente(mesaSelecionada, nome);
      if (resultado.committed) mesas[mesaSelecionada] = resultado.mesa;
    } catch (erro) {
      console.warn('Falha ao atualizar cliente:', erro);
    }
  };

  async function salvarObservacao(index, texto) {
    if (!mesaSelecionada || !atomic()) return false;
    const itemLocal = mesas[mesaSelecionada]?.itens?.[index];
    if (!itemLocal) return false;
    try {
      const resultado = await atomic().atualizarItem(mesaSelecionada, itemLocal.itemOperacaoId, { obs: String(texto || '').trim() }, index);
      if (!resultado.committed) {
        atualizarTelaMesa();
        alert(mensagemBloqueio(resultado.motivo));
        return false;
      }
      mesas[mesaSelecionada] = resultado.mesa;
      if (typeof registrarAuditoriaGarcom === 'function') {
        Promise.resolve(registrarAuditoriaGarcom('editar_observacao', { mesa: mesaSelecionada, item: itemLocal.nome })).catch(() => {});
      }
      renderizarComandaG();
      return true;
    } catch (erro) {
      console.error('Falha ao salvar observação de forma atômica:', erro);
      alert('Não foi possível salvar a observação. Tente novamente.');
      return false;
    }
  }

  window.enviarProducaoG = async function enviarProducaoGAtomico() {
    const numero = mesaSelecionada;
    if (!numero || !atomic()) return;
    if (!firebase.auth().currentUser) return alert('Aguarde a conexão ser confirmada antes de enviar o pedido.');
    const botao = document.getElementById('btn-enviar-g');
    const textoOriginal = botao?.innerText || 'Enviar pedido';
    if (botao) { botao.disabled = true; botao.classList.add('is-sending'); botao.innerText = 'Enviando...'; }
    try { atualizarStatusConexaoG('🟠 sincronizando', 'sync-pending'); } catch (_) {}

    let reserva = null;
    try {
      reserva = await atomic().reservarEnvio(numero, { incluirRascunho: true, origem: 'garcom' });
      if (!reserva.committed) {
        if (reserva.motivo === 'sem_itens') alert('Não há itens novos para enviar.');
        else alert(mensagemBloqueio(reserva.motivo));
        return;
      }

      const itens = clone(reserva.meta.itens || []);
      const indices = reserva.meta.indices || [];
      const cliente = reserva.meta.cliente || '';
      const porSetor = { cozinha: [], bar: [] };
      itens.forEach((item, pos) => {
        const setor = item.setor === 'bar' ? 'bar' : 'cozinha';
        const copia = { ...item, envioId: reserva.envioId };
        delete copia.envioPendenteId;
        delete copia.envioReservadoEm;
        porSetor[setor].push(copia);
      });

      const agoraEnvio = Date.now();
      const atualizacoes = {};
      Object.entries(porSetor).forEach(([setor, lista]) => {
        if (!lista.length) return;
        const ref = db.ref('pedidosProducao').push();
        atualizacoes[`pedidosProducao/${ref.key}`] = {
          chave: ref.key,
          mesa: numero,
          cliente,
          setor,
          itens: lista,
          status: 'recebido',
          origem: 'garcom',
          criadoEm: agoraEnvio,
          atualizadoEm: agoraEnvio
        };
      });

      indices.forEach(index => {
        atualizacoes[`mesas/${numero}/itens/${index}/enviado`] = true;
        atualizacoes[`mesas/${numero}/itens/${index}/rascunho`] = false;
        atualizacoes[`mesas/${numero}/itens/${index}/envioId`] = reserva.envioId;
        atualizacoes[`mesas/${numero}/itens/${index}/envioPendenteId`] = null;
        atualizacoes[`mesas/${numero}/itens/${index}/envioReservadoEm`] = null;
      });
      atualizacoes[`mesas/${numero}/bloqueioOperacional/ativo`] = false;
      atualizacoes[`mesas/${numero}/bloqueioOperacional/liberadoEm`] = Date.now();
      atualizacoes[`mesas/${numero}/bloqueioOperacional/motivoLiberacao`] = 'envio_confirmado';

      await db.ref('/').update(atualizacoes);
      const snap = await db.ref(`mesas/${numero}`).once('value');
      mesas[numero] = atomic().normalizarMesa(snap.val());
      atualizarTelaMesa();
      if (typeof registrarAuditoriaGarcom === 'function') {
        Promise.resolve(registrarAuditoriaGarcom('enviar_producao', { mesa: numero, envioId: reserva.envioId, setores: Object.keys(porSetor).filter(s => porSetor[s].length) })).catch(() => {});
      }
      try { limparPendenciaG('producao'); } catch (_) {}
      try { atualizarStatusConexaoG('🟢 Firebase online · sincronizado', 'sync-ok'); } catch (_) {}
      const setores = `${porSetor.cozinha.length ? 'cozinha' : ''}${porSetor.cozinha.length && porSetor.bar.length ? ' e ' : ''}${porSetor.bar.length ? 'bar' : ''}`;
      alert(`Pedido enviado para ${setores}.`);
    } catch (erro) {
      console.error('Falha no envio atômico para produção:', erro);
      if (reserva?.envioId) {
        try { await atomic().cancelarBloqueio(numero, reserva.envioId, 'falha_envio'); } catch (_) {}
      }
      try { atualizarStatusConexaoG('🔴 falha ao enviar', 'sync-error'); } catch (_) {}
      alert('Não foi possível confirmar o envio. Nenhum envio parcial foi considerado concluído; tente novamente.');
    } finally {
      if (botao) { botao.disabled = false; botao.classList.remove('is-sending'); botao.innerText = textoOriginal; }
    }
  };

  window.limparComandaG = async function limparComandaGAtomica() {
    const numero = mesaSelecionada;
    if (!numero || !atomic()) return;
    if (!confirm(`Limpar a comanda da Mesa ${numero}?`)) return;
    try {
      const resultado = await atomic().limparMesa(numero);
      if (!resultado.committed) return alert(mensagemBloqueio(resultado.motivo));
      mesas[numero] = resultado.mesa;
      if (typeof registrarAuditoriaGarcom === 'function') Promise.resolve(registrarAuditoriaGarcom('limpar_comanda', { mesa: numero })).catch(() => {});
      atualizarTelaMesa();
    } catch (erro) {
      console.error('Falha ao limpar comanda:', erro);
      alert('Não foi possível limpar a comanda.');
    }
  };

  window.confirmarFechamentoG = async function confirmarFechamentoGAtomico() {
    const numero = mesaSelecionada;
    if (!numero || !atomic()) return;
    let lock = null;
    try {
      lock = await atomic().bloquearMesa(numero, { tipo: 'fechamento', origem: 'garcom' });
      if (!lock.committed) return alert(mensagemBloqueio(lock.motivo));
      const dados = atomic().normalizarMesa(lock.mesa);
      const subtotal = dados.itens.reduce((soma, item) => soma + (Number(item.preco) || 0) * (Number(item.qtd) || 0), 0);
      if (subtotal <= 0) {
        await atomic().cancelarBloqueio(numero, lock.id, 'mesa_vazia');
        return alert('A mesa não possui itens para fechar.');
      }
      const taxaAtiva = window.GarcomTaxaServico?.ativa !== false;
      const taxa = taxaAtiva ? subtotal * 0.10 : 0;
      const total = subtotal + taxa;
      const forma = document.getElementById('pagamento-fechar-g')?.value || 'dinheiro';
      const recebido = parseFloat(document.getElementById('valor-recebido-g')?.value || '') || total;
      if (recebido < total - 0.01) {
        mesas[numero] = dados;
        await atomic().cancelarBloqueio(numero, lock.id, 'pagamento_insuficiente');
        try { abrirFechamentoG(); } catch (_) {}
        return alert(`A comanda mudou ou o valor recebido é insuficiente. Total atual: ${formatarMoeda(total)}.`);
      }

      const pagamentos = { dinheiro: 0, pix: 0, credito: 0, debito: 0 };
      if (Object.prototype.hasOwnProperty.call(pagamentos, forma)) pagamentos[forma] = total;
      else pagamentos.dinheiro = total;
      const responsavel = dados.garcomResponsavel && typeof dados.garcomResponsavel === 'object' ? clone(dados.garcomResponsavel) : null;
      const atendentes = Array.isArray(dados.garconsAtendimento) ? clone(dados.garconsAtendimento.filter(Boolean)) : [];
      const venda = {
        id: `garcom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mesa: numero,
        cliente: dados.cliente || 'Não informado',
        itens: clone(dados.itens),
        garcomResponsavel: responsavel,
        garcomNome: responsavel?.nome || '',
        garconsAtendimento: atendentes,
        subtotal,
        taxa,
        total,
        pagamentos,
        troco: Math.max(0, recebido - total),
        taxaServicoPercentual: taxaAtiva ? 10 : 0,
        dataHora: new Date().toLocaleString('pt-BR'),
        criadoEm: Date.now(),
        origem: 'garcom'
      };
      venda.itens.forEach(item => {
        delete item.envioPendenteId;
        delete item.envioReservadoEm;
      });

      const vendaRef = db.ref('vendas').push();
      await db.ref('/').update({
        [`vendas/${vendaRef.key}`]: venda,
        [`mesas/${numero}`]: atomic().mesaVazia()
      });

      mesas[numero] = atomic().mesaVazia();
      try { fecharModalG(); } catch (_) {}
      mesaSelecionada = null;
      const telaPedido = document.getElementById('tela-pedido');
      const telaMesas = document.getElementById('tela-mesas');
      const voltar = document.getElementById('btn-voltar');
      const titulo = document.getElementById('header-titulo');
      if (telaPedido) telaPedido.style.display = 'none';
      if (telaMesas) telaMesas.style.display = 'block';
      if (voltar) voltar.style.display = 'none';
      if (titulo) titulo.innerText = 'Mesas';
      renderizarMesasG();
      if (typeof registrarAuditoriaGarcom === 'function') {
        Promise.resolve(registrarAuditoriaGarcom('fechar_conta', { mesa: numero, total, venda: venda.id, garcom: identidadeAtual()?.nome || '' })).catch(() => {});
      }
      alert(`Conta da Mesa ${numero} fechada com sucesso.`);
    } catch (erro) {
      console.error('Falha no fechamento concorrente do Garçom:', erro);
      if (lock?.id) {
        try { await atomic().cancelarBloqueio(numero, lock.id, 'falha_fechamento'); } catch (_) {}
      }
      alert('Não foi possível fechar a conta. A mesa foi mantida aberta.');
    }
  };

  window.GarcomConcorrencia = Object.freeze({ salvarObservacao });
})();
