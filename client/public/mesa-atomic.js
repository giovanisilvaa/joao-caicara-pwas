/* Núcleo compartilhado de concorrência das mesas — Firebase Realtime Database. */
(() => {
  if (window.MesaAtomic) return;

  const TEMPO_BLOQUEIO_MS = 120000;
  const clone = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));
  const agora = () => Date.now();
  const novoId = (prefixo = 'op') => {
    try {
      if (window.crypto?.randomUUID) return `${prefixo}_${window.crypto.randomUUID()}`;
    } catch (_) {}
    return `${prefixo}_${agora()}_${Math.random().toString(36).slice(2, 10)}`;
  };

  function banco() {
    try { if (typeof db !== 'undefined' && db) return db; } catch (_) {}
    return window.firebase?.database?.();
  }

  function normalizarMesa(valor) {
    const mesa = valor && typeof valor === 'object' ? { ...valor } : {};
    const itens = Array.isArray(mesa.itens)
      ? mesa.itens
      : (mesa.itens && typeof mesa.itens === 'object' ? Object.values(mesa.itens) : []);
    mesa.itens = itens.filter(Boolean).map(item => ({ ...item }));
    mesa.cliente = typeof mesa.cliente === 'string' ? mesa.cliente : '';
    mesa.abertura = mesa.abertura || null;
    return mesa;
  }

  function mesaVazia() {
    return { itens: [], cliente: '', abertura: null };
  }

  function garantirIds(mesa) {
    mesa.itens = (mesa.itens || []).filter(Boolean).map(item => {
      if (item.itemOperacaoId) return item;
      return { ...item, itemOperacaoId: novoId('item') };
    });
    return mesa;
  }

  function bloqueioAtivo(mesa) {
    const lock = mesa?.bloqueioOperacional;
    if (!lock || lock.ativo === false) return null;
    const criadoEm = Number(lock.criadoEm) || 0;
    if (criadoEm && agora() - criadoEm > TEMPO_BLOQUEIO_MS) return null;
    return lock;
  }

  function liberarBloqueioExpirado(mesa) {
    const lock = mesa?.bloqueioOperacional;
    if (!lock || lock.ativo === false) return mesa;
    const criadoEm = Number(lock.criadoEm) || 0;
    if (criadoEm && agora() - criadoEm > TEMPO_BLOQUEIO_MS) {
      mesa.bloqueioOperacional = { ...lock, ativo: false, expiradoEm: agora() };
      (mesa.itens || []).forEach(item => {
        if (item.envioPendenteId === lock.id) {
          delete item.envioPendenteId;
          delete item.envioReservadoEm;
        }
      });
    }
    return mesa;
  }

  function sincronizarLocal(numero, mesa) {
    try {
      if (typeof mesas !== 'undefined' && mesas) mesas[numero] = clone(mesa);
    } catch (_) {}
  }

  function transacionar(numero, alterador) {
    const database = banco();
    if (!database) return Promise.reject(new Error('Firebase Database indisponível'));
    let motivo = '';
    let meta = {};

    return new Promise((resolve, reject) => {
      database.ref(`mesas/${numero}`).transaction(current => {
        motivo = '';
        meta = {};
        const mesa = garantirIds(liberarBloqueioExpirado(normalizarMesa(current)));
        const contexto = {
          abortar(razao) { motivo = razao || 'abortado'; return undefined; },
          meta(chave, valor) { meta[chave] = clone(valor); },
          novoId
        };
        const proxima = alterador(mesa, contexto);
        if (typeof proxima === 'undefined') return;
        return garantirIds(normalizarMesa(proxima));
      }, (erro, committed, snapshot) => {
        if (erro) return reject(erro);
        const mesa = garantirIds(normalizarMesa(snapshot?.val()));
        sincronizarLocal(numero, mesa);
        resolve({ committed: Boolean(committed), mesa, motivo, meta });
      }, false);
    });
  }

  function identidadeValida(identidade) {
    if (!identidade || !String(identidade.nome || '').trim()) return null;
    return {
      nome: String(identidade.nome).trim(),
      login: identidade.login || 'garcom',
      uid: identidade.uid || identidade.funcionarioId || null,
      compartilhado: identidade.compartilhado === true
    };
  }

  function registrarGarcom(mesa, identidade) {
    const id = identidadeValida(identidade);
    if (!id) return;
    if (!mesa.garcomResponsavel?.nome) mesa.garcomResponsavel = { ...id, atribuidoEm: agora() };
    const atuais = Array.isArray(mesa.garconsAtendimento) ? mesa.garconsAtendimento.filter(Boolean) : [];
    const chave = `${id.nome.toLocaleLowerCase('pt-BR')}|${id.uid || ''}`;
    if (!atuais.some(item => `${String(item?.nome || '').trim().toLocaleLowerCase('pt-BR')}|${item?.uid || ''}` === chave)) {
      atuais.push({ ...id, primeiroAtendimentoEm: agora() });
    }
    mesa.garconsAtendimento = atuais;
  }

  async function abrirMesa(numero, { identidade = null, origem = 'garcom' } = {}) {
    return transacionar(numero, (mesa, ctx) => {
      if (bloqueioAtivo(mesa)) return ctx.abortar('mesa_bloqueada');
      if (!mesa.abertura) {
        mesa.abertura = agora();
        mesa.origemAbertura = origem;
      }
      registrarGarcom(mesa, identidade);
      return mesa;
    });
  }

  async function adicionarItem(numero, produto, { identidade = null, origem = 'garcom', rascunho = true } = {}) {
    return transacionar(numero, (mesa, ctx) => {
      if (bloqueioAtivo(mesa)) return ctx.abortar('mesa_bloqueada');
      if (!mesa.abertura) {
        mesa.abertura = agora();
        mesa.origemAbertura = origem;
      }
      registrarGarcom(mesa, identidade);
      const idGarcom = identidadeValida(identidade);
      const existente = mesa.itens.find(item =>
        item.id === produto.id &&
        Number(item.preco) === Number(produto.preco) &&
        !item.obs &&
        item.enviado === false &&
        !item.envioPendenteId &&
        (!idGarcom || String(item.garcomLancamento?.nome || '') === idGarcom.nome)
      );
      if (existente) {
        existente.qtd = (Number(existente.qtd) || 0) + 1;
        if (idGarcom) existente.garcomUltimoLancamento = { ...idGarcom, em: agora() };
        ctx.meta('itemOperacaoId', existente.itemOperacaoId);
      } else {
        const item = {
          ...clone(produto),
          qtd: 1,
          obs: '',
          enviado: false,
          rascunho,
          itemOperacaoId: novoId('item')
        };
        if (idGarcom) item.garcomLancamento = { ...idGarcom, em: agora() };
        mesa.itens.push(item);
        ctx.meta('itemOperacaoId', item.itemOperacaoId);
      }
      return mesa;
    });
  }

  async function alterarQuantidade(numero, itemOperacaoId, delta, fallbackIndex = -1) {
    return transacionar(numero, (mesa, ctx) => {
      if (bloqueioAtivo(mesa)) return ctx.abortar('mesa_bloqueada');
      let index = mesa.itens.findIndex(item => item.itemOperacaoId === itemOperacaoId);
      if (index < 0 && fallbackIndex >= 0 && mesa.itens[fallbackIndex]) index = fallbackIndex;
      if (index < 0) return ctx.abortar('item_nao_encontrado');
      const item = mesa.itens[index];
      const antes = Number(item.qtd) || 0;
      const depois = antes + Number(delta || 0);
      ctx.meta('itemAntes', item);
      ctx.meta('quantidadeRemovida', Math.max(0, antes - Math.max(0, depois)));
      if (depois <= 0) mesa.itens.splice(index, 1);
      else item.qtd = depois;
      if (!mesa.itens.length) mesa.abertura = null;
      return mesa;
    });
  }

  async function atualizarItem(numero, itemOperacaoId, patch, fallbackIndex = -1) {
    return transacionar(numero, (mesa, ctx) => {
      if (bloqueioAtivo(mesa)) return ctx.abortar('mesa_bloqueada');
      let index = mesa.itens.findIndex(item => item.itemOperacaoId === itemOperacaoId);
      if (index < 0 && fallbackIndex >= 0 && mesa.itens[fallbackIndex]) index = fallbackIndex;
      if (index < 0) return ctx.abortar('item_nao_encontrado');
      mesa.itens[index] = { ...mesa.itens[index], ...clone(patch), itemOperacaoId: mesa.itens[index].itemOperacaoId };
      ctx.meta('item', mesa.itens[index]);
      return mesa;
    });
  }

  async function atualizarCliente(numero, cliente) {
    return transacionar(numero, (mesa, ctx) => {
      if (bloqueioAtivo(mesa)) return ctx.abortar('mesa_bloqueada');
      mesa.cliente = String(cliente || '').slice(0, 160);
      return mesa;
    });
  }

  async function limparMesa(numero) {
    return transacionar(numero, (mesa, ctx) => {
      if (bloqueioAtivo(mesa)) return ctx.abortar('mesa_bloqueada');
      return mesaVazia();
    });
  }

  async function reservarEnvio(numero, { setor = null, incluirRascunho = true, origem = 'garcom' } = {}) {
    const envioId = novoId(`envio_${origem}`);
    const resultado = await transacionar(numero, (mesa, ctx) => {
      if (bloqueioAtivo(mesa)) return ctx.abortar('mesa_bloqueada');
      const indices = [];
      const itens = [];
      mesa.itens.forEach((item, index) => {
        const setorItem = item.setor === 'bar' ? 'bar' : 'cozinha';
        const setorOk = !setor || setorItem === setor;
        const estadoOk = item.enviado === false && (incluirRascunho || item.rascunho !== true);
        if (!setorOk || !estadoOk) return;
        item.envioPendenteId = envioId;
        item.envioReservadoEm = agora();
        indices.push(index);
        itens.push(clone(item));
      });
      if (!itens.length) return ctx.abortar('sem_itens');
      mesa.bloqueioOperacional = { id: envioId, tipo: 'envio_producao', origem, ativo: true, criadoEm: agora() };
      ctx.meta('indices', indices);
      ctx.meta('itens', itens);
      ctx.meta('cliente', mesa.cliente || '');
      return mesa;
    });
    return { ...resultado, envioId };
  }

  async function cancelarBloqueio(numero, id, motivo = 'cancelado') {
    return transacionar(numero, (mesa, ctx) => {
      const lock = mesa.bloqueioOperacional;
      if (!lock || lock.id !== id || lock.ativo === false) return ctx.abortar('bloqueio_nao_encontrado');
      mesa.bloqueioOperacional = { ...lock, ativo: false, liberadoEm: agora(), motivoLiberacao: motivo };
      mesa.itens.forEach(item => {
        if (item.envioPendenteId === id) {
          delete item.envioPendenteId;
          delete item.envioReservadoEm;
        }
      });
      return mesa;
    });
  }

  async function bloquearMesa(numero, { tipo = 'operacao', origem = 'pdv' } = {}) {
    const id = novoId(`lock_${tipo}`);
    const resultado = await transacionar(numero, (mesa, ctx) => {
      if (bloqueioAtivo(mesa)) return ctx.abortar('mesa_bloqueada');
      mesa.bloqueioOperacional = { id, tipo, origem, ativo: true, criadoEm: agora() };
      ctx.meta('snapshot', clone(mesa));
      return mesa;
    });
    return { ...resultado, id };
  }

  function marcarBloqueioInativo(mesa, id, motivo = 'concluido') {
    const atual = mesa?.bloqueioOperacional;
    if (atual?.id !== id) return mesa;
    mesa.bloqueioOperacional = { ...atual, ativo: false, liberadoEm: agora(), motivoLiberacao: motivo };
    return mesa;
  }

  window.MesaAtomic = Object.freeze({
    normalizarMesa,
    mesaVazia,
    garantirIds,
    bloqueioAtivo,
    novoId,
    abrirMesa,
    adicionarItem,
    alterarQuantidade,
    atualizarItem,
    atualizarCliente,
    limparMesa,
    reservarEnvio,
    cancelarBloqueio,
    bloquearMesa,
    marcarBloqueioInativo,
    sincronizarLocal
  });
})();
