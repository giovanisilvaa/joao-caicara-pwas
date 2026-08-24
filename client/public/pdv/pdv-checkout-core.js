/* Fechamento atômico do caixa do PDV — bloqueia a mesa e usa o snapshot autoritativo. */
(() => {
  const clone = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));

  window.imprimirCaixa = async function imprimirCaixaSeguro() {
    const mesaId = mesaAtualSelecionada;
    if (!mesaId || !mesas[mesaId]) return alert('Selecione uma mesa!');
    if (!window.MesaAtomic) return alert('A proteção de concorrência ainda está carregando. Tente novamente em um instante.');

    let lock = null;
    try {
      lock = await window.MesaAtomic.bloquearMesa(mesaId, { tipo: 'fechamento', origem: 'pdv' });
      if (!lock.committed) return alert('A mesa está concluindo outra operação. Aguarde um instante e tente novamente.');

      const dadosMesa = window.MesaAtomic.normalizarMesa(lock.mesa);
      mesas[mesaId] = dadosMesa;
      const subtotal = dadosMesa.itens.reduce((soma, item) => soma + (Number(item.preco) || 0) * (Number(item.qtd) || 0), 0);
      if (subtotal <= 0) {
        await window.MesaAtomic.cancelarBloqueio(mesaId, lock.id, 'mesa_vazia');
        return alert('A mesa está vazia.');
      }
      const taxaAtiva = document.getElementById('chk-taxa-servico')?.checked !== false;
      const taxa = taxaAtiva ? subtotal * 0.10 : 0;
      const total = subtotal + taxa;
      const dinheiro = parseFloat(document.getElementById('pag-dinheiro').value) || 0;
      const pix = parseFloat(document.getElementById('pag-pix').value) || 0;
      const credito = parseFloat(document.getElementById('pag-credito').value) || 0;
      const debito = parseFloat(document.getElementById('pag-debito').value) || 0;
      const informado = dinheiro + pix + credito + debito;

      if (informado < total - 0.01) {
        await window.MesaAtomic.cancelarBloqueio(mesaId, lock.id, 'pagamento_insuficiente');
        try { renderizarComanda(); } catch (_) {}
        return alert(`A comanda foi atualizada e o pagamento informado ficou insuficiente. Total atual: ${formatarMoeda(total)}. Revise o pagamento.`);
      }

      const troco = informado - total;
      const dataAtualStr = new Date().toLocaleString('pt-BR');
      const garcomResponsavel = dadosMesa.garcomResponsavel && typeof dadosMesa.garcomResponsavel === 'object'
        ? clone(dadosMesa.garcomResponsavel)
        : null;
      const garconsAtendimento = Array.isArray(dadosMesa.garconsAtendimento)
        ? clone(dadosMesa.garconsAtendimento.filter(Boolean))
        : [];
      const itensVenda = clone(dadosMesa.itens);
      itensVenda.forEach(item => {
        delete item.envioPendenteId;
        delete item.envioReservadoEm;
      });
      const registro = {
        id: `pdv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mesa: mesaId,
        cliente: dadosMesa.cliente || 'Não informado',
        dataHora: dataAtualStr,
        criadoEm: Date.now(),
        itens: itensVenda,
        garcomResponsavel,
        garcomNome: garcomResponsavel?.nome || '',
        garconsAtendimento,
        subtotal,
        taxa,
        total,
        pagamentos: { dinheiro, pix, credito, debito },
        troco,
        origem: 'pdv'
      };

      const vendaRef = db.ref('vendas').push();
      // Venda e liberação da mesa são confirmadas juntas. Enquanto o lock está ativo,
      // os módulos novos de Garçom/PDV não aceitam alteração da comanda.
      await db.ref('/').update({
        [`vendas/${vendaRef.key}`]: registro,
        [`mesas/${mesaId}`]: window.MesaAtomic.mesaVazia()
      });

      const historico = JSON.parse(localStorage.getItem('historico_vendas_caicara')) || [];
      historico.unshift(registro);
      localStorage.setItem('historico_vendas_caicara', JSON.stringify(historico));

      let detalhe = '';
      if (garcomResponsavel?.nome) detalhe += `Mesa aberta por: ${garcomResponsavel.nome}<br>`;
      if (garconsAtendimento.length) detalhe += `Atendida por: ${garconsAtendimento.map(item => item.nome).filter(Boolean).join(', ')}<br>`;
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
      document.getElementById('caixa-itens').innerHTML = dadosMesa.itens.map(item =>
        `<div class="t-item"><span class="t-item-name">${item.qtd}x ${item.nome}</span><span>R$ ${((Number(item.preco) || 0) * (Number(item.qtd) || 0)).toFixed(2)}</span></div>`
      ).join('');

      mesas[mesaId] = window.MesaAtomic.mesaVazia();
      fecharModais();
      document.body.classList.add('print-mode-caixa');
      window.print();
      document.body.classList.remove('print-mode-caixa');

      mesaAtualSelecionada = null;
      document.getElementById('mesa-titulo').innerText = 'Selecione uma Mesa';
      document.getElementById('nome-cliente').value = '';
      document.getElementById('menu-panel').classList.remove('active');
      document.getElementById('order-items').innerHTML = '<p style="text-align:center; color:#999; margin-top:20px;">Nenhuma mesa selecionada.</p>';
      document.getElementById('total-valor').innerText = formatarMoeda(0);
      gerarMesas();
      atualizarPainelDiario();

      if (typeof registrarAuditoriaPdv === 'function') {
        Promise.resolve(registrarAuditoriaPdv('fechar_conta', { mesa: mesaId, total, venda: registro.id, garcom: garcomResponsavel?.nome || '', garconsAtendimento: garconsAtendimento.map(item => item.nome).filter(Boolean) }))
          .catch(erro => console.warn('Venda concluída, mas a auditoria do fechamento falhou:', erro));
      }
    } catch (erro) {
      console.error('Falha no fechamento atômico:', erro);
      if (lock?.id) {
        try { await window.MesaAtomic.cancelarBloqueio(mesaId, lock.id, 'falha_fechamento_pdv'); } catch (_) {}
      }
      alert('Não foi possível registrar o fechamento. A mesa foi mantida aberta.');
    }
  };
})();
