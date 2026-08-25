/* Central autenticada de produção do PDV — recebe pedidos do garçom e imprime em fila na única impressora do caixa. */
(() => {
  if (window.PDV_AUTO_PRODUCTION_RUNTIME === 'v2') return;
  window.PDV_AUTO_PRODUCTION_RUNTIME = 'v2';

  const fila = [];
  const emFila = new Set();
  const conhecidos = new Set();
  const sessao = `pdv-print_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const EMAIL_PDV = 'adm@acesso.joaocaicara.app';
  const TEMPO_RECLAIM_MS = 120000;
  let processando = false;
  let conectado = false;
  let refProducao = null;
  let onValue = null;
  let onChildAdded = null;

  function prepararPedido(pedido) {
    if (window.PdvProducao?.prepararImpressao) {
      window.PdvProducao.prepararImpressao(
        pedido.setor === 'bar' ? 'bar' : 'cozinha',
        pedido.mesa || '-',
        pedido.cliente || '',
        pedido.itens || [],
        false
      );
      return;
    }
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

  function imprimirDocumentoAtual() {
    if (window.PdvProducao?.imprimirAgora) return window.PdvProducao.imprimirAgora();
    document.body.classList.add('print-mode-producao');
    window.print();
    document.body.classList.remove('print-mode-producao');
  }

  function sincronizarPainel(snapshot) {
    try {
      if (typeof producaoCache === 'undefined') return;
      Object.keys(producaoCache).forEach(chave => delete producaoCache[chave]);
      snapshot.forEach(child => { producaoCache[child.key] = child.val() || {}; });
      if (typeof registrarNovosPedidosPdv === 'function') registrarNovosPedidosPdv(producaoCache);
      if (typeof renderizarPainelProducao === 'function') renderizarPainelProducao();
    } catch (erro) {
      console.warn('Falha ao sincronizar painel de produção autenticado:', erro);
    }
  }

  function reivindicarImpressao(chave) {
    const ref = db.ref(`pedidosProducao/${chave}/impressaoPdv`);
    return new Promise((resolve, reject) => {
      ref.transaction(atual => {
        const agora = Date.now();
        if (atual?.estado === 'impresso') return;
        if (atual?.estado === 'processando' && agora - Number(atual.iniciadoEm || 0) < TEMPO_RECLAIM_MS) return;
        return { estado: 'processando', sessao, iniciadoEm: agora };
      }, (erro, committed) => {
        if (erro) return reject(erro);
        resolve(Boolean(committed));
      }, false);
    });
  }

  async function imprimirDaFila(registro) {
    const pedido = registro.pedido;
    const assumiu = await reivindicarImpressao(registro.chave);
    if (!assumiu) return;

    try {
      prepararPedido(pedido);
      imprimirDocumentoAtual();
      const agora = Date.now();
      await db.ref(`pedidosProducao/${registro.chave}`).update({
        status: 'impresso',
        impressoEm: agora,
        atualizadoEm: agora,
        impressoNoPdv: true,
        impressaoPdv: { estado: 'impresso', sessao, iniciadoEm: agora, concluidoEm: agora }
      });
      try {
        if (typeof registrarAuditoriaPdv === 'function') {
          await Promise.resolve(registrarAuditoriaPdv('imprimir_producao_automatica', {
            pedido: registro.chave,
            mesa: pedido.mesa,
            setor: pedido.setor
          }));
        }
      } catch (_) {}
    } catch (erro) {
      try {
        await db.ref(`pedidosProducao/${registro.chave}/impressaoPdv`).update({
          estado: 'falha', sessao, falhouEm: Date.now()
        });
      } catch (_) {}
      throw erro;
    }
  }

  async function processarFila() {
    if (processando) return;
    processando = true;
    try {
      while (fila.length) {
        const registro = fila.shift();
        try {
          await imprimirDaFila(registro);
        } catch (erro) {
          console.error('Falha ao imprimir pedido do garçom no PDV:', erro);
        } finally {
          emFila.delete(registro.chave);
        }
      }
    } finally {
      processando = false;
      if (fila.length) setTimeout(processarFila, 300);
    }
  }

  function enfileirar(chave, pedido) {
    if (!pedido || pedido.origem !== 'garcom') return;
    if (pedido.impressoEm || pedido.impressoNoPdv || pedido.status === 'impresso' || pedido.impressaoPdv?.estado === 'impresso') return;
    if (!Array.isArray(pedido.itens) || !pedido.itens.length) return;
    if (emFila.has(chave)) return;
    emFila.add(chave);
    fila.push({ chave, pedido });
    processarFila();
  }

  function desconectar() {
    if (!refProducao) return;
    if (onValue) refProducao.off('value', onValue);
    if (onChildAdded) refProducao.off('child_added', onChildAdded);
    refProducao = null;
    onValue = null;
    onChildAdded = null;
    conectado = false;
    conhecidos.clear();
  }

  async function conectarAutenticado() {
    if (conectado) return;
    const user = firebase.auth().currentUser;
    if (!user || String(user.email || '').toLowerCase() !== EMAIL_PDV) return;

    refProducao = db.ref('pedidosProducao');
    const inicial = await refProducao.once('value');
    sincronizarPainel(inicial);
    conhecidos.clear();
    inicial.forEach(child => conhecidos.add(child.key));

    onValue = snap => sincronizarPainel(snap);
    onChildAdded = snap => {
      const chave = snap.key;
      const pedido = snap.val() || {};
      if (conhecidos.has(chave)) return;
      conhecidos.add(chave);
      enfileirar(chave, pedido);
    };

    refProducao.on('value', onValue, erro => console.error('Falha na leitura autenticada de pedidosProducao:', erro));
    refProducao.on('child_added', onChildAdded, erro => console.error('Falha na fila autenticada de produção:', erro));
    conectado = true;
  }

  function iniciar() {
    if (typeof firebase === 'undefined' || typeof db === 'undefined' || !db) return;
    firebase.auth().onAuthStateChanged(user => {
      const email = String(user?.email || '').toLowerCase();
      if (email !== EMAIL_PDV) {
        desconectar();
        return;
      }
      conectarAutenticado().catch(erro => console.error('Falha ao conectar central de produção:', erro));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.PdvImpressaoAutomatica = Object.freeze({ enfileirar, processarFila, conectarAutenticado, desconectar });
})();
