/* Central autenticada de produção do PDV — recebe pedidos do garçom e imprime em lote na única impressora do caixa. */
(() => {
  if (window.PDV_AUTO_PRODUCTION_RUNTIME === 'v3') return;
  window.PDV_AUTO_PRODUCTION_RUNTIME = 'v3';

  const fila = [];
  const emFila = new Set();
  const conhecidos = new Set();
  const sessao = `pdv-print_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const EMAIL_PDV = 'adm@acesso.joaocaicara.app';
  const TEMPO_RECLAIM_MS = 120000;
  const AGUARDO_LOTE_MS = 650;
  const RECUPERAR_INICIAL_MS = 15 * 60 * 1000;
  let processando = false;
  let timerProcessamento = null;
  let conectado = false;
  let refProducao = null;
  let onValue = null;
  let onChildAdded = null;

  function pedidoPendente(pedido) {
    if (!pedido || pedido.origem !== 'garcom') return false;
    if (pedido.impressoEm || pedido.impressoNoPdv || pedido.status === 'impresso' || pedido.impressaoPdv?.estado === 'impresso') return false;
    return Array.isArray(pedido.itens) && pedido.itens.length > 0;
  }

  function deveRecuperarInicial(pedido) {
    if (!pedidoPendente(pedido)) return false;
    const criadoEm = Number(pedido.criadoEm || 0);
    return criadoEm > 0 && Date.now() - criadoEm <= RECUPERAR_INICIAL_MS;
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

  async function assumirLote(registros) {
    const assumidos = [];
    for (const registro of registros) {
      try {
        if (await reivindicarImpressao(registro.chave)) assumidos.push(registro);
      } catch (erro) {
        console.error('Falha ao reivindicar impressão:', registro.chave, erro);
      }
    }
    return assumidos;
  }

  async function marcarLoteImpresso(registros) {
    const agora = Date.now();
    const atualizacoes = {};
    registros.forEach(registro => {
      const base = `pedidosProducao/${registro.chave}`;
      atualizacoes[`${base}/status`] = 'impresso';
      atualizacoes[`${base}/impressoEm`] = agora;
      atualizacoes[`${base}/atualizadoEm`] = agora;
      atualizacoes[`${base}/impressoNoPdv`] = true;
      atualizacoes[`${base}/impressaoPdv`] = { estado: 'impresso', sessao, iniciadoEm: agora, concluidoEm: agora };
    });
    await db.ref('/').update(atualizacoes);
  }

  async function marcarLoteFalha(registros) {
    const agora = Date.now();
    const atualizacoes = {};
    registros.forEach(registro => {
      atualizacoes[`pedidosProducao/${registro.chave}/impressaoPdv`] = {
        estado: 'falha', sessao, falhouEm: agora
      };
    });
    try { await db.ref('/').update(atualizacoes); } catch (_) {}
  }

  function documentosDoLote(registros) {
    return registros
      .slice()
      .sort((a, b) => {
        const mesaA = Number(a.pedido?.mesa || 0);
        const mesaB = Number(b.pedido?.mesa || 0);
        if (mesaA !== mesaB) return mesaA - mesaB;
        if (a.pedido?.setor === b.pedido?.setor) return Number(a.pedido?.criadoEm || 0) - Number(b.pedido?.criadoEm || 0);
        return a.pedido?.setor === 'cozinha' ? -1 : 1;
      })
      .map(registro => ({
        setor: registro.pedido.setor === 'bar' ? 'bar' : 'cozinha',
        numeroMesa: registro.pedido.mesa || '-',
        cliente: registro.pedido.cliente || '',
        itens: registro.pedido.itens || [],
        criadoEm: registro.pedido.criadoEm || Date.now()
      }));
  }

  async function imprimirLoteFila(registros) {
    const assumidos = await assumirLote(registros);
    if (!assumidos.length) return;

    try {
      if (!window.PdvProducao?.imprimirLote) {
        throw new Error('Runtime de impressão em lote ainda não disponível.');
      }
      window.PdvProducao.imprimirLote(documentosDoLote(assumidos));
      await marcarLoteImpresso(assumidos);
      for (const registro of assumidos) {
        try {
          if (typeof registrarAuditoriaPdv === 'function') {
            await Promise.resolve(registrarAuditoriaPdv('imprimir_producao_automatica', {
              pedido: registro.chave,
              mesa: registro.pedido.mesa,
              setor: registro.pedido.setor
            }));
          }
        } catch (_) {}
      }
    } catch (erro) {
      await marcarLoteFalha(assumidos);
      throw erro;
    }
  }

  function agendarProcessamento() {
    if (timerProcessamento || processando) return;
    timerProcessamento = setTimeout(() => {
      timerProcessamento = null;
      processarFila();
    }, AGUARDO_LOTE_MS);
  }

  async function processarFila() {
    if (processando || !fila.length) return;
    processando = true;
    const loteAtual = fila.splice(0, fila.length);
    try {
      await imprimirLoteFila(loteAtual);
    } catch (erro) {
      console.error('Falha ao imprimir lote do garçom no PDV:', erro);
    } finally {
      loteAtual.forEach(registro => emFila.delete(registro.chave));
      processando = false;
      if (fila.length) setTimeout(processarFila, 900);
    }
  }

  function enfileirar(chave, pedido) {
    if (!pedidoPendente(pedido)) return;
    if (emFila.has(chave)) return;
    emFila.add(chave);
    fila.push({ chave, pedido });
    agendarProcessamento();
  }

  function desconectar() {
    if (refProducao) {
      if (onValue) refProducao.off('value', onValue);
      if (onChildAdded) refProducao.off('child_added', onChildAdded);
    }
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
    inicial.forEach(child => {
      conhecidos.add(child.key);
      const pedido = child.val() || {};
      if (deveRecuperarInicial(pedido)) enfileirar(child.key, pedido);
    });

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
