/* Reconecta as mesas depois que a conta real do Garçom estiver autenticada.
 * As regras do Firebase bloqueiam a leitura anônima; um listener que falha antes
 * do login não se recupera sozinho, então esta camada garante a assinatura real.
 */
(() => {
  const EMAIL_GARCOM = 'garcom@acesso.joaocaicara.app';
  let refMesas = null;
  let callbackMesas = null;
  let conectadoUid = null;

  const normalizar = valor => {
    if (typeof window.normalizarMesas === 'function') return window.normalizarMesas(valor);
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
  };

  const pedidoNovo = mesa => Boolean(
    mesa && Array.isArray(mesa.itens) && mesa.itens.some(item => item && item.enviado === false && item.rascunho !== true)
  );

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
    if (!user || email !== EMAIL_GARCOM) return desconectar();
    if (conectadoUid === user.uid && refMesas && callbackMesas) return;

    desconectar();
    conectadoUid = user.uid;
    refMesas = firebase.database().ref('mesas');
    callbackMesas = snap => {
      try {
        const anteriores = (typeof mesas === 'object' && mesas) ? mesas : {};
        const atualizadas = normalizar(snap.val());
        const novos = Object.keys(atualizadas).filter(numero => pedidoNovo(atualizadas[numero]) && !pedidoNovo(anteriores[numero]));
        mesas = atualizadas;
        if (typeof renderizarMesasG === 'function') renderizarMesasG();
        if (typeof mesaSelecionada !== 'undefined' && mesaSelecionada && mesas[mesaSelecionada] && typeof renderizarComandaG === 'function') {
          renderizarComandaG();
        }
        if (typeof notificarNovoPedidoG === 'function') novos.forEach(numero => notificarNovoPedidoG(numero));
        if (typeof atualizarStatusConexaoG === 'function') atualizarStatusConexaoG('🟢 Firebase online · sincronizado', 'sync-ok');
      } catch (erro) {
        console.error('Falha ao atualizar mesas após autenticação:', erro);
      }
    };

    refMesas.on('value', callbackMesas, erro => {
      console.error('Falha ao reconectar mesas autenticadas:', erro);
      if (typeof atualizarStatusConexaoG === 'function') atualizarStatusConexaoG('🔴 falha ao sincronizar mesas', 'sync-error');
    });
  }

  firebase.auth().onAuthStateChanged(conectar);

  window.GarcomMesasAuth = Object.freeze({ reconectar: () => conectar(firebase.auth().currentUser) });
})();
