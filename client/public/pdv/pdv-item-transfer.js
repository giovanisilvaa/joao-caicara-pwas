/* Transferência de itens entre mesas — exclusiva do PDV/administrador. */
(() => {
  if (window.PDV_ITEM_TRANSFER_RUNTIME === 'v1') return;
  window.PDV_ITEM_TRANSFER_RUNTIME = 'v1';

  const ADMIN_EMAIL = 'adm@acesso.joaocaicara.app';
  const STATUS_FECHADA = 'aguardando_pagamento';
  const clone = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));

  function atomic() { return window.MesaAtomic; }
  function mesaAtual() { try { return Number(mesaAtualSelecionada) || null; } catch (_) { return null; } }
  function mesaValida(numero) { return (numero >= 1 && numero <= 25) || (numero >= 50 && numero <= 65); }
  function contaFechada(mesa) { return mesa?.estadoConta === STATUS_FECHADA; }
  function usuarioAdmin() {
    try { return String(firebase.auth().currentUser?.email || '').toLowerCase() === ADMIN_EMAIL; }
    catch (_) { return false; }
  }
  function moeda(valor) {
    try { if (typeof formatarMoeda === 'function') return formatarMoeda(Number(valor) || 0); } catch (_) {}
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
  }

  function atualizarTelas(origem, destino, mesaOrigem, mesaDestino) {
    try {
      mesas[origem] = clone(mesaOrigem);
      mesas[destino] = clone(mesaDestino);
      renderizarComanda();
      gerarMesas();
      atualizarPainelDiario();
    } catch (_) {}
  }

  async function transferirItem({ origem, destino, itemOperacaoId, indexOriginal, quantidade }) {
    if (!usuarioAdmin()) throw new Error('somente_pdv');
    if (!atomic()) throw new Error('atomic_indisponivel');
    if (!mesaValida(origem) || !mesaValida(destino) || origem === destino) throw new Error('mesa_invalida');

    let lockOrigem = null;
    let lockDestino = null;
    try {
      lockOrigem = await atomic().bloquearMesa(origem, { tipo: 'transferencia_item', origem: 'pdv' });
      if (!lockOrigem.committed) throw new Error(lockOrigem.motivo || 'origem_bloqueada');

      lockDestino = await atomic().bloquearMesa(destino, { tipo: 'receber_transferencia_item', origem: 'pdv' });
      if (!lockDestino.committed) throw new Error(lockDestino.motivo || 'destino_bloqueado');

      const mesaOrigem = atomic().normalizarMesa(lockOrigem.mesa);
      const mesaDestino = atomic().normalizarMesa(lockDestino.mesa);
      if (contaFechada(mesaOrigem) || contaFechada(mesaDestino)) throw new Error('conta_fechada');

      let index = mesaOrigem.itens.findIndex(item => item.itemOperacaoId && item.itemOperacaoId === itemOperacaoId);
      if (index < 0 && Number.isInteger(indexOriginal) && mesaOrigem.itens[indexOriginal]) index = indexOriginal;
      if (index < 0) throw new Error('item_nao_encontrado');

      const itemOriginal = mesaOrigem.itens[index];
      const qtdDisponivel = Math.max(0, Number(itemOriginal.qtd) || 0);
      const qtdMover = Math.max(1, Math.min(qtdDisponivel, Number(quantidade) || 1));
      if (!qtdDisponivel || qtdMover > qtdDisponivel) throw new Error('quantidade_invalida');

      const finalOrigem = clone(mesaOrigem);
      const finalDestino = clone(mesaDestino);
      const itemOrigemFinal = finalOrigem.itens[index];
      const restante = qtdDisponivel - qtdMover;
      if (restante <= 0) finalOrigem.itens.splice(index, 1);
      else itemOrigemFinal.qtd = restante;
      if (!finalOrigem.itens.length) finalOrigem.abertura = null;

      const agora = Date.now();
      const itemTransferido = clone(itemOriginal);
      itemTransferido.qtd = qtdMover;
      itemTransferido.itemOperacaoId = atomic().novoId('item_transferido');
      itemTransferido.transferidoDeMesa = origem;
      itemTransferido.transferidoEm = agora;
      itemTransferido.transferidoPor = 'pdv';
      finalDestino.itens.push(itemTransferido);
      if (!finalDestino.abertura) {
        finalDestino.abertura = agora;
        finalDestino.origemAbertura = 'pdv_transferencia';
      }

      atomic().marcarBloqueioInativo(finalOrigem, lockOrigem.id, 'transferencia_concluida');
      atomic().marcarBloqueioInativo(finalDestino, lockDestino.id, 'transferencia_concluida');

      const auditRef = db.ref('auditoria').push();
      const atualizacoes = {
        [`mesas/${origem}`]: finalOrigem,
        [`mesas/${destino}`]: finalDestino,
        [`auditoria/${auditRef.key}`]: {
          acao: 'transferir_item_mesa',
          origemMesa: origem,
          destinoMesa: destino,
          item: itemOriginal.nome || '',
          itemId: itemOriginal.id ?? null,
          itemOperacaoIdOriginal: itemOriginal.itemOperacaoId || null,
          itemOperacaoIdDestino: itemTransferido.itemOperacaoId,
          quantidade: qtdMover,
          precoUnitario: Number(itemOriginal.preco) || 0,
          jaEnviadoProducao: itemOriginal.enviado === true,
          garcomLancamento: itemOriginal.garcomLancamento || null,
          criadoEm: agora,
          origem: 'pdv'
        }
      };

      await db.ref('/').update(atualizacoes);
      atualizarTelas(origem, destino, finalOrigem, finalDestino);
      return { item: itemTransferido, quantidade: qtdMover, origem, destino };
    } catch (erro) {
      if (lockDestino?.id) {
        try { await atomic().cancelarBloqueio(destino, lockDestino.id, 'falha_transferencia'); } catch (_) {}
      }
      if (lockOrigem?.id) {
        try { await atomic().cancelarBloqueio(origem, lockOrigem.id, 'falha_transferencia'); } catch (_) {}
      }
      throw erro;
    }
  }

  function mensagemErro(erro) {
    const codigo = String(erro?.message || erro || '');
    if (codigo.includes('somente_pdv')) return 'Somente o PDV/administrador pode transferir itens entre mesas.';
    if (codigo.includes('conta_fechada')) return 'Reabra a conta antes de transferir itens. A mesa de origem e a de destino precisam estar abertas.';
    if (codigo.includes('mesa_bloqueada') || codigo.includes('origem_bloqueada') || codigo.includes('destino_bloqueado')) return 'Uma das mesas está concluindo outra operação. Tente novamente em alguns segundos.';
    if (codigo.includes('item_nao_encontrado')) return 'O item mudou em outro aparelho. A comanda será atualizada; tente novamente.';
    if (codigo.includes('mesa_invalida')) return 'Selecione uma mesa de destino válida e diferente da mesa de origem.';
    return 'Não foi possível transferir o item. Nenhuma transferência parcial foi considerada concluída.';
  }

  function fecharModal() {
    const overlay = document.getElementById('pdv-transfer-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function abrirModal() {
    const origem = mesaAtual();
    if (!origem || !mesas?.[origem]) return alert('Selecione uma mesa com itens antes de transferir.');
    if (!usuarioAdmin()) return alert('Somente o PDV/administrador pode transferir itens entre mesas.');
    const mesa = mesas[origem];
    if (contaFechada(mesa)) return alert('Reabra a conta antes de transferir itens.');
    const itens = Array.isArray(mesa.itens) ? mesa.itens.filter(Boolean) : [];
    if (!itens.length) return alert('A mesa selecionada não possui itens para transferir.');

    const overlay = garantirModal();
    const selectItem = overlay.querySelector('#pdv-transfer-item');
    const quantidade = overlay.querySelector('#pdv-transfer-qtd');
    const destino = overlay.querySelector('#pdv-transfer-destino');
    const resumo = overlay.querySelector('#pdv-transfer-resumo');
    selectItem.innerHTML = itens.map((item, index) => `<option value="${index}">${index + 1}. ${Number(item.qtd) || 0}x ${String(item.nome || '')} · ${moeda(item.preco)}</option>`).join('');
    quantidade.value = '1';
    quantidade.max = String(Math.max(1, Number(itens[0]?.qtd) || 1));
    destino.value = '';
    resumo.textContent = `Origem: Mesa ${origem}`;

    selectItem.onchange = () => {
      const item = itens[Number(selectItem.value) || 0];
      quantidade.max = String(Math.max(1, Number(item?.qtd) || 1));
      if (Number(quantidade.value) > Number(quantidade.max)) quantidade.value = quantidade.max;
    };

    overlay.dataset.origem = String(origem);
    overlay.style.display = 'flex';
  }

  function garantirModal() {
    let overlay = document.getElementById('pdv-transfer-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'pdv-transfer-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:1900;background:rgba(15,76,92,.82);align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML = `
      <div style="width:min(520px,100%);background:#f9f6f0;border-radius:14px;padding:20px;box-shadow:0 18px 42px rgba(0,0,0,.3);border:2px solid #e0ddcf">
        <h3 style="font-family:Georgia,serif;color:#0f4c5c;margin-bottom:8px">Transferir item para outra mesa</h3>
        <p id="pdv-transfer-resumo" style="font-weight:800;color:#457b9d;margin-bottom:14px"></p>
        <label style="display:block;font-weight:800;margin:9px 0 5px">Item</label>
        <select id="pdv-transfer-item" style="width:100%;padding:10px;border:1px solid #e0ddcf;border-radius:7px;background:#fff"></select>
        <label style="display:block;font-weight:800;margin:9px 0 5px">Quantidade a transferir</label>
        <input id="pdv-transfer-qtd" type="number" min="1" step="1" value="1" style="width:100%;padding:10px;border:1px solid #e0ddcf;border-radius:7px;background:#fff">
        <label style="display:block;font-weight:800;margin:9px 0 5px">Mesa de destino</label>
        <input id="pdv-transfer-destino" type="number" min="1" step="1" placeholder="Ex.: 12 ou 50" style="width:100%;padding:10px;border:1px solid #e0ddcf;border-radius:7px;background:#fff">
        <div style="display:flex;gap:8px;margin-top:16px">
          <button type="button" id="pdv-transfer-cancelar" style="flex:1;border:0;border-radius:8px;padding:11px;font-weight:800;background:#c49a6c;color:#333">Cancelar</button>
          <button type="button" id="pdv-transfer-confirmar" style="flex:1;border:0;border-radius:8px;padding:11px;font-weight:800;background:#457b9d;color:#fff">Transferir</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#pdv-transfer-cancelar').onclick = fecharModal;
    overlay.addEventListener('click', event => { if (event.target === overlay) fecharModal(); });
    overlay.querySelector('#pdv-transfer-confirmar').onclick = async () => {
      const origem = Number(overlay.dataset.origem) || null;
      const itens = origem && mesas?.[origem] && Array.isArray(mesas[origem].itens) ? mesas[origem].itens.filter(Boolean) : [];
      const index = Number(overlay.querySelector('#pdv-transfer-item').value) || 0;
      const item = itens[index];
      const quantidade = Number(overlay.querySelector('#pdv-transfer-qtd').value) || 0;
      const destino = Number(overlay.querySelector('#pdv-transfer-destino').value) || 0;
      if (!item || quantidade < 1 || quantidade > Number(item.qtd || 0)) return alert('Confira o item e a quantidade informada.');
      if (!mesaValida(destino) || destino === origem) return alert('Informe uma mesa de destino válida e diferente da origem.');
      if (contaFechada(mesas?.[destino])) return alert('A mesa de destino está com conta fechada. Reabra essa conta antes da transferência.');
      if (!confirm(`Transferir ${quantidade}x ${item.nome} da Mesa ${origem} para a Mesa ${destino}?`)) return;
      const botao = overlay.querySelector('#pdv-transfer-confirmar');
      botao.disabled = true;
      botao.textContent = 'Transferindo...';
      try {
        const resultado = await transferirItem({ origem, destino, itemOperacaoId: item.itemOperacaoId, indexOriginal: index, quantidade });
        fecharModal();
        alert(`Transferência concluída: ${resultado.quantidade}x ${resultado.item.nome} · Mesa ${origem} → Mesa ${destino}.`);
      } catch (erro) {
        console.error('Falha na transferência de item entre mesas:', erro);
        alert(mensagemErro(erro));
      } finally {
        botao.disabled = false;
        botao.textContent = 'Transferir';
      }
    };
    return overlay;
  }

  function instalarBotao() {
    const acoes = document.querySelector('.action-buttons');
    if (!acoes || document.getElementById('btn-pdv-transferir-item')) return;
    const botao = document.createElement('button');
    botao.id = 'btn-pdv-transferir-item';
    botao.type = 'button';
    botao.className = 'btn';
    botao.style.cssText = 'background:#457b9d;grid-column:span 2';
    botao.textContent = '↔ TRANSFERIR ITEM PARA OUTRA MESA';
    botao.onclick = abrirModal;
    const fechar = acoes.querySelector('.btn-close');
    if (fechar) acoes.insertBefore(botao, fechar);
    else acoes.appendChild(botao);
  }

  function iniciar() {
    if (!location.pathname.startsWith('/pdv/')) return;
    garantirModal();
    instalarBotao();
    const observer = new MutationObserver(instalarBotao);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.PdvItemTransfer = Object.freeze({ transferirItem, abrirModal });
})();
