/* Impressão automática de cancelamentos — central do PDV. */
(() => {
  if (window.PDV_CANCELLATION_PRINT_RUNTIME === 'v1') return;
  window.PDV_CANCELLATION_PRINT_RUNTIME = 'v1';

  const EMAIL_PDV = 'adm@acesso.joaocaicara.app';
  const RECUPERAR_MS = 30 * 60 * 1000;
  const sessao = `cancel-print_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const conhecidos = new Set();
  const fila = [];
  let processando = false;
  let ref = null;
  let onAdded = null;

  function elegivel(pedido) {
    if (!pedido || pedido.tipo !== 'cancelamento' || pedido.origem !== 'cancelamento') return false;
    if (!Array.isArray(pedido.itens) || !pedido.itens.length) return false;
    if (pedido.cancelamentoImpressoEm || pedido.impressaoCancelamentoPdv?.estado === 'impresso') return false;
    return true;
  }

  function recente(pedido) {
    const criadoEm = Number(pedido?.criadoEm) || 0;
    return criadoEm > 0 && Date.now() - criadoEm <= RECUPERAR_MS;
  }

  function reivindicar(chave) {
    return new Promise((resolve, reject) => {
      db.ref(`pedidosProducao/${chave}/impressaoCancelamentoPdv`).transaction(atual => {
        const agora = Date.now();
        if (atual?.estado === 'impresso') return;
        if (atual?.estado === 'processando' && agora - Number(atual.iniciadoEm || 0) < 120000) return;
        return { estado: 'processando', sessao, iniciadoEm: agora };
      }, (erro, committed) => {
        if (erro) return reject(erro);
        resolve(Boolean(committed));
      }, false);
    });
  }

  async function marcar(chave, sucesso) {
    const agora = Date.now();
    const updates = {};
    if (sucesso) {
      updates[`pedidosProducao/${chave}/status`] = 'impresso';
      updates[`pedidosProducao/${chave}/cancelamentoImpressoEm`] = agora;
      updates[`pedidosProducao/${chave}/atualizadoEm`] = agora;
      updates[`pedidosProducao/${chave}/impressaoCancelamentoPdv`] = { estado: 'impresso', sessao, concluidoEm: agora };
    } else {
      updates[`pedidosProducao/${chave}/impressaoCancelamentoPdv`] = { estado: 'falha', sessao, falhouEm: agora };
    }
    try { await db.ref('/').update(updates); } catch (_) {}
  }

  function imprimir(pedido) {
    if (!window.PdvProducao?.prepararImpressao || !window.PdvProducao?.imprimirAgora) {
      throw new Error('Módulo de impressão da produção indisponível.');
    }
    const setor = pedido.setor === 'bar' ? 'bar' : 'cozinha';
    const itens = (pedido.itens || []).map(item => ({
      ...item,
      nome: `⛔ CANCELAR — ${item.nome}`,
      obs: item.obs || `Motivo: ${pedido.motivo || 'não informado'}`
    }));
    window.PdvProducao.prepararImpressao(setor, pedido.mesa || '-', pedido.cliente || '', itens, false, pedido.criadoEm || Date.now());
    const titulo = document.getElementById('prod-titulo');
    if (titulo) titulo.innerText = `⛔ CANCELAMENTO ${setor === 'bar' ? 'BAR' : 'COZINHA'}`;
    window.PdvProducao.imprimirAgora();
  }

  async function processar() {
    if (processando || !fila.length) return;
    processando = true;
    const atual = fila.shift();
    try {
      if (await reivindicar(atual.chave)) {
        imprimir(atual.pedido);
        await marcar(atual.chave, true);
      }
    } catch (erro) {
      console.error('Falha ao imprimir cancelamento:', erro);
      await marcar(atual.chave, false);
    } finally {
      processando = false;
      if (fila.length) setTimeout(processar, 500);
    }
  }

  function enfileirar(chave, pedido) {
    if (!elegivel(pedido) || conhecidos.has(chave)) return;
    conhecidos.add(chave);
    fila.push({ chave, pedido });
    processar();
  }

  function desconectar() {
    if (ref && onAdded) ref.off('child_added', onAdded);
    ref = null;
    onAdded = null;
    conhecidos.clear();
  }

  async function conectar() {
    desconectar();
    const user = firebase.auth().currentUser;
    if (!user || String(user.email || '').toLowerCase() !== EMAIL_PDV) return;
    ref = db.ref('pedidosProducao');
    const inicial = await ref.once('value');
    inicial.forEach(child => {
      const pedido = child.val() || {};
      if (elegivel(pedido) && recente(pedido)) enfileirar(child.key, pedido);
      else conhecidos.add(child.key);
    });
    onAdded = snap => enfileirar(snap.key, snap.val() || {});
    ref.on('child_added', onAdded, erro => console.error('Falha ao observar cancelamentos:', erro));
  }

  function iniciar() {
    if (typeof firebase === 'undefined' || typeof db === 'undefined' || !db) return;
    firebase.auth().onAuthStateChanged(() => conectar().catch(erro => console.error('Falha ao iniciar impressão de cancelamentos:', erro)));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.PdvCancelamentoPrint = Object.freeze({ elegivel, enfileirar, conectar });
})();
