/* Totais financeiros da sessão de caixa — leitura filtrada de vendas, sem mutações financeiras. */
(() => {
  if (!location.pathname.startsWith('/pdv/')) return;
  if (window.PDV_CASH_SESSION_TOTALS_RUNTIME === 'v1') return;
  window.PDV_CASH_SESSION_TOTALS_RUNTIME = 'v1';

  const ADMIN_EMAIL = 'adm@acesso.joaocaicara.app';
  let refSessao = null;
  let listenerSessao = null;
  let queryVendas = null;
  let listenerVendas = null;
  let sessaoAtual = null;
  let vendasAtuais = [];
  let totaisAtuais = null;

  const numero = valor => {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  };
  const naoNegativo = valor => Math.max(0, numero(valor));
  const moeda = valor => numero(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function auth() {
    try { return window.firebase?.auth?.() || null; } catch (_) { return null; }
  }

  function db() {
    try { return window.firebase?.database?.() || null; } catch (_) { return null; }
  }

  function adminValido(user) {
    return Boolean(user && String(user.email || '').toLowerCase() === ADMIN_EMAIL);
  }

  function listaVendas(valor) {
    if (!valor || typeof valor !== 'object') return [];
    return Object.values(valor).filter(venda => venda && typeof venda === 'object');
  }

  function calcular(vendas, sessao = null) {
    const acumulado = {
      quantidadeVendas: 0,
      subtotal: 0,
      taxaServico: 0,
      totalVendas: 0,
      dinheiroBruto: 0,
      troco: 0,
      dinheiroLiquido: 0,
      pix: 0,
      credito: 0,
      debito: 0,
      fundoInicial: naoNegativo(sessao?.fundoInicial),
      especieEsperada: 0
    };

    (Array.isArray(vendas) ? vendas : []).forEach(venda => {
      const total = naoNegativo(venda?.total);
      const taxa = naoNegativo(venda?.taxa);
      const subtotal = venda?.subtotal == null ? Math.max(0, total - taxa) : naoNegativo(venda.subtotal);
      const pagamentos = venda?.pagamentos && typeof venda.pagamentos === 'object' ? venda.pagamentos : {};
      const dinheiro = naoNegativo(pagamentos.dinheiro);
      const troco = naoNegativo(venda?.troco);

      acumulado.quantidadeVendas += 1;
      acumulado.subtotal += subtotal;
      acumulado.taxaServico += taxa;
      acumulado.totalVendas += total;
      acumulado.dinheiroBruto += dinheiro;
      acumulado.troco += troco;
      acumulado.dinheiroLiquido += Math.max(0, dinheiro - troco);
      acumulado.pix += naoNegativo(pagamentos.pix);
      acumulado.credito += naoNegativo(pagamentos.credito);
      acumulado.debito += naoNegativo(pagamentos.debito);
    });

    acumulado.especieEsperada = acumulado.fundoInicial + acumulado.dinheiroLiquido;
    return acumulado;
  }

  function instalarEstilo() {
    if (document.getElementById('pdv-cash-session-totals-style')) return;
    const style = document.createElement('style');
    style.id = 'pdv-cash-session-totals-style';
    style.textContent = `
      #pdv-cash-session-totals{grid-column:1/-1;display:none;background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px 12px;box-shadow:0 3px 0 rgba(15,76,92,.05)}
      #pdv-cash-session-totals.ativo{display:block}
      .pcst-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}.pcst-head strong{color:var(--primary);font-size:.82rem;text-transform:uppercase;letter-spacing:.05em}.pcst-head span{font-size:.7rem;color:#6d7b7d}
      .pcst-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.pcst-item{min-width:0;background:#f7faf8;border:1px solid #e6ece9;border-radius:8px;padding:7px 8px}.pcst-item small{display:block;font-size:.61rem;text-transform:uppercase;letter-spacing:.05em;color:#6d7b7d;font-weight:800}.pcst-item strong{display:block;margin-top:2px;color:var(--primary);font-size:.9rem;white-space:nowrap}.pcst-item.destaque{background:#edf8f4;border-color:#cce8de}
      @media(max-width:850px){.pcst-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:460px){.pcst-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function garantirInterface() {
    instalarEstilo();
    if (document.getElementById('pdv-cash-session-totals')) return true;
    const cardSessao = document.getElementById('pdv-cash-session');
    const painel = document.getElementById('painel-diario');
    if (!painel || !cardSessao) return false;

    const card = document.createElement('div');
    card.id = 'pdv-cash-session-totals';
    card.innerHTML = `
      <div class="pcst-head"><strong>Movimento da sessão</strong><span class="pcst-sessao"></span></div>
      <div class="pcst-grid">
        <div class="pcst-item"><small>Vendas</small><strong data-pcst="quantidadeVendas">0</strong></div>
        <div class="pcst-item"><small>Subtotal</small><strong data-pcst="subtotal">R$ 0,00</strong></div>
        <div class="pcst-item"><small>Taxa de serviço</small><strong data-pcst="taxaServico">R$ 0,00</strong></div>
        <div class="pcst-item destaque"><small>Total vendido</small><strong data-pcst="totalVendas">R$ 0,00</strong></div>
        <div class="pcst-item"><small>Dinheiro líquido</small><strong data-pcst="dinheiroLiquido">R$ 0,00</strong></div>
        <div class="pcst-item"><small>PIX</small><strong data-pcst="pix">R$ 0,00</strong></div>
        <div class="pcst-item"><small>Crédito</small><strong data-pcst="credito">R$ 0,00</strong></div>
        <div class="pcst-item"><small>Débito</small><strong data-pcst="debito">R$ 0,00</strong></div>
        <div class="pcst-item"><small>Fundo inicial</small><strong data-pcst="fundoInicial">R$ 0,00</strong></div>
        <div class="pcst-item destaque"><small>Espécie esperada</small><strong data-pcst="especieEsperada">R$ 0,00</strong></div>
      </div>`;
    cardSessao.insertAdjacentElement('afterend', card);
    renderizar();
    return true;
  }

  function escrever(chave, valor, monetario = true) {
    const el = document.querySelector(`#pdv-cash-session-totals [data-pcst="${chave}"]`);
    if (el) el.textContent = monetario ? moeda(valor) : String(valor ?? 0);
  }

  function renderizar() {
    if (!garantirInterface()) return;
    const card = document.getElementById('pdv-cash-session-totals');
    if (!card) return;
    const ativa = Boolean(sessaoAtual?.status === 'aberto' && sessaoAtual?.id);
    card.classList.toggle('ativo', ativa);
    if (!ativa) return;

    const totais = totaisAtuais || calcular(vendasAtuais, sessaoAtual);
    const titulo = card.querySelector('.pcst-sessao');
    if (titulo) titulo.textContent = sessaoAtual.codigo || sessaoAtual.id;
    escrever('quantidadeVendas', totais.quantidadeVendas, false);
    escrever('subtotal', totais.subtotal);
    escrever('taxaServico', totais.taxaServico);
    escrever('totalVendas', totais.totalVendas);
    escrever('dinheiroLiquido', totais.dinheiroLiquido);
    escrever('pix', totais.pix);
    escrever('credito', totais.credito);
    escrever('debito', totais.debito);
    escrever('fundoInicial', totais.fundoInicial);
    escrever('especieEsperada', totais.especieEsperada);
  }

  function desconectarVendas() {
    if (queryVendas && listenerVendas) {
      try { queryVendas.off('value', listenerVendas); } catch (_) {}
    }
    queryVendas = null;
    listenerVendas = null;
  }

  function acompanharVendas(sessao) {
    desconectarVendas();
    vendasAtuais = [];
    totaisAtuais = calcular(vendasAtuais, sessao);
    renderizar();
    const database = db();
    if (!database || !sessao?.id) return;

    queryVendas = database.ref('vendas').orderByChild('sessaoCaixaId').equalTo(String(sessao.id));
    listenerVendas = snapshot => {
      vendasAtuais = listaVendas(snapshot.val());
      totaisAtuais = calcular(vendasAtuais, sessaoAtual);
      renderizar();
    };
    queryVendas.on('value', listenerVendas, erro => {
      console.warn('Não foi possível calcular os totais da sessão de caixa:', erro);
      vendasAtuais = [];
      totaisAtuais = calcular(vendasAtuais, sessaoAtual);
      renderizar();
    });
  }

  function desconectarSessao() {
    if (refSessao && listenerSessao) {
      try { refSessao.off('value', listenerSessao); } catch (_) {}
    }
    refSessao = null;
    listenerSessao = null;
    desconectarVendas();
  }

  function conectar(user) {
    desconectarSessao();
    sessaoAtual = null;
    vendasAtuais = [];
    totaisAtuais = null;
    if (!adminValido(user) || !db()) {
      renderizar();
      return;
    }

    refSessao = db().ref('sessoesCaixa/atual');
    listenerSessao = snapshot => {
      const proxima = snapshot.val() || null;
      const idAnterior = sessaoAtual?.id || null;
      sessaoAtual = proxima;
      if (!sessaoAtual?.id || sessaoAtual.status !== 'aberto') {
        desconectarVendas();
        vendasAtuais = [];
        totaisAtuais = null;
        renderizar();
        return;
      }
      if (String(idAnterior || '') !== String(sessaoAtual.id)) acompanharVendas(sessaoAtual);
      else {
        totaisAtuais = calcular(vendasAtuais, sessaoAtual);
        renderizar();
      }
    };
    refSessao.on('value', listenerSessao, erro => {
      console.warn('Não foi possível acompanhar a sessão para calcular totais:', erro);
      sessaoAtual = null;
      vendasAtuais = [];
      totaisAtuais = null;
      desconectarVendas();
      renderizar();
    });
  }

  function iniciar() {
    garantirInterface();
    const firebaseAuth = auth();
    if (!firebaseAuth) {
      setTimeout(iniciar, 250);
      return;
    }
    firebaseAuth.onAuthStateChanged(user => conectar(user));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.PdvCashSessionTotals = Object.freeze({
    runtime: 'v1',
    calcular: (vendas, sessao) => ({ ...calcular(vendas, sessao) }),
    atual: () => totaisAtuais ? { ...totaisAtuais } : null,
    renderizar
  });
})();
