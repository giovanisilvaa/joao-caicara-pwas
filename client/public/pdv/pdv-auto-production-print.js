/* Impressão automática no PDV para pedidos enviados pelos garçons. Usa a única impressora do caixa. */
(() => {
  const fila = [];
  const emFila = new Set();
  let processando = false;

  function prepararPedido(pedido) {
    const setor = pedido.setor === 'bar' ? 'bar' : 'cozinha';
    document.getElementById('prod-titulo').innerText = setor === 'bar' ? 'PEDIDO BAR' : 'PEDIDO COZINHA';
    document.getElementById('prod-mesa').innerText = pedido.mesa || '-';
    document.getElementById('prod-cliente').innerText = pedido.cliente || 'Balcão/Geral';
    document.getElementById('prod-data').innerText = new Date(pedido.criadoEm || Date.now()).toLocaleString('pt-BR');
    document.getElementById('prod-itens').innerHTML = (pedido.itens || []).map(item => {
      const obs = item.obs ? `<div style="font-size:13px;font-weight:normal;margin:2px 0 0 0;">↳ Obs: ${item.obs}</div>` : '';
      const serve2 = item.servePara2 ? `<div style="font-size:11px;font-weight:normal;margin:2px 0 0 0;">(serve bem 2 pessoas)</div>` : '';
      return `<div class="cozinha-item">[ ] ${item.qtd}x ${item.nome}${obs}${serve2}</div>`;
    }).join('');
  }

  async function imprimirDaFila(registro) {
    prepararPedido(registro.pedido);
    document.body.classList.add('print-mode-producao');
    window.print();
    document.body.classList.remove('print-mode-producao');
    await db.ref(`pedidosProducao/${registro.chave}`).update({
      status: 'impresso',
      impressoEm: Date.now(),
      atualizadoEm: Date.now(),
      impressoNoPdv: true
    });
  }

  async function processarFila() {
    if (processando || !fila.length) return;
    processando = true;
    while (fila.length) {
      const registro = fila.shift();
      try {
        await imprimirDaFila(registro);
      } catch (erro) {
        console.error('Falha ao imprimir pedido do garçom no PDV:', erro);
        emFila.delete(registro.chave);
        break;
      }
      emFila.delete(registro.chave);
    }
    processando = false;
    if (fila.length) setTimeout(processarFila, 500);
  }

  function enfileirar(chave, pedido) {
    if (!pedido || pedido.origem !== 'garcom') return;
    if (pedido.impressoEm || pedido.impressoNoPdv || pedido.status === 'impresso') return;
    if (!Array.isArray(pedido.itens) || !pedido.itens.length) return;
    if (emFila.has(chave)) return;
    emFila.add(chave);
    fila.push({ chave, pedido });
    processarFila();
  }

  function iniciar() {
    if (typeof db === 'undefined' || !db) return;
    db.ref('pedidosProducao').on('child_added', snap => enfileirar(snap.key, snap.val() || {}));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.PdvImpressaoAutomatica = Object.freeze({ enfileirar, processarFila });
})();
