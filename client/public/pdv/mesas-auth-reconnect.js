/* Reconecta /mesas depois que a conta real do PDV estiver autenticada.
 * O listener legado pode iniciar antes do login e receber permission_denied.
 * Esta camada mantém a visão das mesas autoritativa após a autenticação.
 */
(() => {
  if (window.PDV_MESAS_AUTH_RUNTIME === 'v1') return;
  window.PDV_MESAS_AUTH_RUNTIME = 'v1';

  const EMAIL_PDV = 'adm@acesso.joaocaicara.app';
  let refMesas = null;
  let callbackMesas = null;
  let conectadoUid = null;

  function normalizar(valor) {
    const origem = valor && typeof valor === 'object' ? valor : {};
    const resultado = {};
    Object.keys(origem).forEach(numero => {
      const mesa = origem[numero] && typeof origem[numero] === 'object' ? origem[numero] : {};
      const itens = Array.isArray(mesa.itens)
        ? mesa.itens
        : (mesa.itens && typeof mesa.itens === 'object' ? Object.values(mesa.itens) : []);
      resultado[numero] = {
        ...mesa,
        itens: itens.filter(Boolean),
        cliente: typeof mesa.cliente === 'string' ? mesa.cliente : '',
        abertura: mesa.abertura || null
      };
    });
    return resultado;
  }

  function atualizarInterface() {
    try { localStorage.setItem('mesas_abertas_caicara_cache', JSON.stringify(mesas)); } catch (_) {}
    try { if (typeof gerarMesas === 'function') gerarMesas(); } catch (_) {}
    try { if (typeof atualizarPainelDiario === 'function') atualizarPainelDiario(); } catch (_) {}

    try {
      if (typeof mesaAtualSelecionada !== 'undefined' && mesaAtualSelecionada !== null) {
        const inputCliente = document.getElementById('nome-cliente');
        if (inputCliente && document.activeElement !== inputCliente) {
          inputCliente.value = mesas[mesaAtualSelecionada]?.cliente || '';
        }
        if (typeof renderizarComanda === 'function') renderizarComanda();
      }
    } catch (erro) {
      console.warn('Falha ao atualizar comanda selecionada após sincronizar mesas:', erro);
    }
  }

  function desconectar() {
    if (refMesas && callbackMesas) {
      try { refMesas.off('value', callbackMesas); } catch (_) {}
    }
    refMesas = null;
    callbackMesas = null;
    conectadoUid = null;
  }

  function conectar(user) {
    const email = String(user?.email || '').toLowerCase();
    if (!user || email !== EMAIL_PDV) return desconectar();
    if (conectadoUid === user.uid && refMesas && callbackMesas) return;

    desconectar();
    conectadoUid = user.uid;
    refMesas = db.ref('mesas');
    callbackMesas = snap => {
      try {
        mesas = normalizar(snap.val());
        atualizarInterface();
      } catch (erro) {
        console.error('Falha ao aplicar mesas autenticadas no PDV:', erro);
      }
    };

    refMesas.on('value', callbackMesas, erro => {
      console.error('Falha ao reconectar mesas autenticadas no PDV:', erro);
      try {
        if (typeof atualizarStatusConexaoPdv === 'function') {
          atualizarStatusConexaoPdv('🔴 falha ao sincronizar mesas', 'sync-error');
        }
      } catch (_) {}
    });
  }

  firebase.auth().onAuthStateChanged(conectar);
  window.PdvMesasAuth = Object.freeze({ reconectar: () => conectar(firebase.auth().currentUser), desconectar });
})();
