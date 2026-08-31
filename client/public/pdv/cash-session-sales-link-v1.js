/* Vincula novas vendas do PDV à sessão de caixa ativa sem alterar o fluxo de fechamento. */
(() => {
  if (!location.pathname.startsWith('/pdv/')) return;
  if (window.PDV_CASH_SESSION_SALES_LINK_RUNTIME === 'v1') return;
  window.PDV_CASH_SESSION_SALES_LINK_RUNTIME = 'v1';

  const CACHE_KEY = 'historico_vendas_caicara';
  let instalado = false;
  let tentativas = 0;

  function banco() {
    try {
      if (typeof db !== 'undefined' && db?.ref) return db;
    } catch (_) {}
    try { return window.firebase?.database?.() || null; } catch (_) { return null; }
  }

  function sessaoAtiva() {
    try {
      const atual = window.PdvSessaoCaixa?.atual?.() || null;
      if (!atual || atual.status !== 'aberto' || !atual.id) return null;
      return {
        sessaoCaixaId: String(atual.id),
        sessaoCaixaCodigo: String(atual.codigo || atual.id),
        sessaoCaixaAbertoEm: Number(atual.abertoEm) || 0,
        sessaoCaixaVersao: Number(atual.versao) || 1
      };
    } catch (_) {
      return null;
    }
  }

  function historicoLocal() {
    try {
      const valor = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
      return Array.isArray(valor) ? valor : [];
    } catch (_) {
      return [];
    }
  }

  function criarRegistro(args, sessao, agora = Date.now()) {
    const [mesaId, cliente, itens, total, pagamentos, troco, dataHora, subtotal, taxa] = args;
    return {
      id: `pdv-${agora}-${Math.random().toString(36).slice(2, 8)}`,
      mesa: mesaId,
      cliente: cliente || 'Não informado',
      dataHora,
      criadoEm: agora,
      itens,
      subtotal,
      taxa,
      total,
      pagamentos,
      troco,
      origem: 'pdv',
      ...sessao
    };
  }

  function instalar() {
    const original = window.salvarVendaNoHistorico;
    if (typeof original !== 'function') {
      if (tentativas++ < 40) setTimeout(instalar, 100);
      return false;
    }
    if (original.__pdvCashSessionSalesLink === 'v1') {
      instalado = true;
      return true;
    }

    function salvarVendaNoHistoricoComSessao(...args) {
      const sessao = sessaoAtiva();
      if (!sessao) return original.apply(this, args);

      const database = banco();
      if (!database) {
        console.warn('Sessão de caixa ativa, mas Firebase indisponível ao vincular a venda. O fluxo original será preservado.');
        return original.apply(this, args);
      }

      const registro = criarRegistro(args, sessao);
      const historico = historicoLocal();
      historico.unshift(registro);
      localStorage.setItem(CACHE_KEY, JSON.stringify(historico));
      database.ref('vendas').push(registro);
    }

    Object.defineProperty(salvarVendaNoHistoricoComSessao, '__pdvCashSessionSalesLink', {
      value: 'v1', enumerable: false, configurable: false, writable: false
    });
    Object.defineProperty(salvarVendaNoHistoricoComSessao, '__original', {
      value: original, enumerable: false, configurable: false, writable: false
    });

    window.salvarVendaNoHistorico = salvarVendaNoHistoricoComSessao;
    instalado = true;
    return true;
  }

  instalar();

  window.PdvCashSessionSalesLink = Object.freeze({
    runtime: 'v1',
    instalar,
    instalado: () => instalado,
    sessaoAtiva: () => {
      const sessao = sessaoAtiva();
      return sessao ? { ...sessao } : null;
    }
  });
})();
