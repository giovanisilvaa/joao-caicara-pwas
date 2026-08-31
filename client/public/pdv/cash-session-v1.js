/* Sessão estrutural de caixa do PDV — abertura/encerramento atômicos, sem alterar vendas ou relatórios. */
(() => {
  if (window.PDV_CASH_SESSION_RUNTIME === 'v1') return;
  window.PDV_CASH_SESSION_RUNTIME = 'v1';

  const PATH = 'sessoesCaixa';
  const ADMIN_EMAIL = 'adm@acesso.joaocaicara.app';
  const STATUS_ABERTO = 'aberto';
  const STATUS_FECHADO = 'fechado';
  let sessaoAtual = null;
  let refAtual = null;
  let listenerAtual = null;

  const clone = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));
  const pad = valor => String(valor).padStart(2, '0');
  const moeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function auth() {
    try { return window.firebase?.auth?.() || null; } catch (_) { return null; }
  }

  function db() {
    try { return window.firebase?.database?.() || null; } catch (_) { return null; }
  }

  function adminAtual() {
    const user = auth()?.currentUser || null;
    return user && String(user.email || '').toLowerCase() === ADMIN_EMAIL ? user : null;
  }

  function operador(user) {
    return {
      uid: String(user?.uid || ''),
      email: String(user?.email || ADMIN_EMAIL)
    };
  }

  function numeroValor(valor) {
    let texto = String(valor ?? '').trim().replace(/\s/g, '');
    if (!texto) return 0;
    if (texto.includes(',') && texto.includes('.')) texto = texto.replace(/\./g, '').replace(',', '.');
    else if (texto.includes(',')) texto = texto.replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(texto)) texto = texto.replace(/\./g, '');
    const n = Number(texto);
    return Number.isFinite(n) ? n : NaN;
  }

  function codigoSessao(agora = Date.now()) {
    const d = new Date(agora);
    return `CX-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function idSessao(agora = Date.now()) {
    return `${codigoSessao(agora)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function extrairMesasPendentes(valor) {
    const origem = valor && typeof valor === 'object' ? valor : {};
    return Object.entries(origem).filter(([, mesa]) => {
      if (!mesa || typeof mesa !== 'object') return false;
      const itens = Array.isArray(mesa.itens)
        ? mesa.itens.filter(Boolean)
        : (mesa.itens && typeof mesa.itens === 'object' ? Object.values(mesa.itens).filter(Boolean) : []);
      return Boolean(mesa.abertura || itens.length || mesa.estadoConta === 'aguardando_pagamento');
    }).map(([numero]) => numero);
  }

  async function mesasPendentesServidor() {
    const database = db();
    if (!database) throw new Error('Firebase Database indisponível.');
    const refMesas = database.ref('mesas');
    const snapshot = await refMesas.once('value');
    return extrairMesasPendentes(snapshot.val());
  }

  function executarTransacao(mutador) {
    const database = db();
    if (!database) return Promise.reject(new Error('Firebase Database indisponível.'));
    return new Promise((resolve, reject) => {
      database.ref(PATH).transaction(mutador, (erro, committed, snapshot) => {
        if (erro) return reject(erro);
        resolve({ committed: Boolean(committed), valor: snapshot?.val() || null });
      }, false);
    });
  }

  async function abrir(fundoInformado) {
    const user = adminAtual();
    if (!user) {
      alert('Faça login como administrador no PDV antes de abrir o caixa.');
      return false;
    }

    let informado = fundoInformado;
    if (informado === undefined) {
      informado = prompt('Fundo inicial do caixa:', '0,00');
      if (informado === null) return false;
    }
    const fundoInicial = numeroValor(informado);
    if (!Number.isFinite(fundoInicial) || fundoInicial < 0) {
      alert('Informe um fundo inicial válido, igual ou maior que zero.');
      return false;
    }

    const agora = Date.now();
    const id = idSessao(agora);
    const sessao = {
      id,
      codigo: codigoSessao(agora),
      status: STATUS_ABERTO,
      abertoEm: agora,
      fundoInicial,
      operadorAbertura: operador(user),
      origem: 'pdv',
      versao: 1
    };

    try {
      const resultado = await executarTransacao(valor => {
        const raiz = valor && typeof valor === 'object' ? clone(valor) : {};
        if (raiz.atual?.status === STATUS_ABERTO) return;
        const registros = raiz.registros && typeof raiz.registros === 'object' ? raiz.registros : {};
        return {
          ...raiz,
          atual: sessao,
          registros: { ...registros, [id]: sessao }
        };
      });

      if (!resultado.committed) {
        sessaoAtual = resultado.valor?.atual || sessaoAtual;
        renderizar();
        alert(`Já existe uma sessão de caixa aberta${sessaoAtual?.codigo ? ` (${sessaoAtual.codigo})` : ''}. Encerre-a antes de abrir outra.`);
        return false;
      }

      sessaoAtual = clone(sessao);
      renderizar();
      alert(`Caixa aberto com sucesso.\nSessão: ${sessao.codigo}\nFundo inicial: ${moeda(fundoInicial)}`);
      return clone(sessao);
    } catch (erro) {
      console.error('Falha ao abrir sessão de caixa:', erro);
      alert('Não foi possível abrir a sessão de caixa. Nenhuma venda ou mesa foi alterada.');
      return false;
    }
  }

  async function encerrar() {
    const user = adminAtual();
    if (!user) {
      alert('Faça login como administrador no PDV antes de encerrar o caixa.');
      return false;
    }
    const esperada = sessaoAtual?.id || null;
    if (!esperada) {
      alert('Não existe uma sessão de caixa aberta para encerrar.');
      return false;
    }

    let pendentes = [];
    try {
      pendentes = await mesasPendentesServidor();
    } catch (erro) {
      console.warn('Não foi possível confirmar as mesas antes do encerramento do caixa:', erro);
      alert('Não foi possível confirmar o estado das mesas no servidor. Por segurança, a sessão de caixa permanece aberta.');
      return false;
    }
    if (pendentes.length) {
      const amostra = pendentes.slice(0, 8).join(', ');
      const restante = pendentes.length > 8 ? ` e mais ${pendentes.length - 8}` : '';
      alert(`Não é possível encerrar o caixa com mesas/comandas abertas ou aguardando pagamento.\n\nPendentes: ${amostra}${restante}.`);
      return false;
    }

    if (!confirm(`Encerrar a sessão ${sessaoAtual.codigo || esperada}?\n\nNesta etapa, isso encerra somente o período operacional. Vendas e relatórios existentes não serão apagados nem alterados.`)) return false;

    const agora = Date.now();
    try {
      const resultado = await executarTransacao(valor => {
        const raiz = valor && typeof valor === 'object' ? clone(valor) : {};
        const ativa = raiz.atual;
        if (!ativa || ativa.status !== STATUS_ABERTO || ativa.id !== esperada) return;
        const fechada = {
          ...ativa,
          status: STATUS_FECHADO,
          fechadoEm: agora,
          duracaoMs: Math.max(0, agora - Number(ativa.abertoEm || agora)),
          operadorFechamento: operador(user),
          fase: 'estrutura_v1'
        };
        const registros = raiz.registros && typeof raiz.registros === 'object' ? raiz.registros : {};
        const proxima = {
          ...raiz,
          registros: { ...registros, [esperada]: fechada }
        };
        delete proxima.atual;
        return proxima;
      });

      if (!resultado.committed) {
        sessaoAtual = resultado.valor?.atual || null;
        renderizar();
        alert('A sessão mudou em outro PDV. O estado atual foi recarregado; confira antes de tentar novamente.');
        return false;
      }

      const codigo = sessaoAtual?.codigo || esperada;
      sessaoAtual = null;
      renderizar();
      alert(`Sessão ${codigo} encerrada. O histórico foi preservado no Firebase.`);
      return true;
    } catch (erro) {
      console.error('Falha ao encerrar sessão de caixa:', erro);
      alert('Não foi possível encerrar a sessão de caixa. Ela permanece aberta e nenhuma venda foi alterada.');
      return false;
    }
  }

  function instalarEstilo() {
    if (document.getElementById('pdv-cash-session-style')) return;
    const style = document.createElement('style');
    style.id = 'pdv-cash-session-style';
    style.textContent = `
      #pdv-cash-session{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:#fff;border:1px solid var(--border);border-left:5px solid #8b9496;border-radius:10px;box-shadow:0 3px 0 rgba(15,76,92,.05)}
      #pdv-cash-session.aberto{border-left-color:var(--success)}
      #pdv-cash-session .pcs-info{min-width:0}.pcs-label{display:block;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;font-weight:900;color:#657174}.pcs-status{display:block;margin-top:2px;font-weight:900;color:var(--primary)}.pcs-meta{display:block;margin-top:2px;font-size:.72rem;color:#6d7b7d}
      #pdv-cash-session button{border:0;border-radius:8px;padding:9px 12px;font-weight:900;cursor:pointer;background:var(--success);color:#fff;white-space:nowrap}#pdv-cash-session.aberto button{background:#536b70}
      @media(max-width:620px){#pdv-cash-session{align-items:stretch;flex-direction:column}#pdv-cash-session button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function garantirInterface() {
    instalarEstilo();
    const painel = document.getElementById('painel-diario');
    if (!painel || document.getElementById('pdv-cash-session')) return;
    const card = document.createElement('div');
    card.id = 'pdv-cash-session';
    card.innerHTML = '<div class="pcs-info"><span class="pcs-label">Sessão de caixa</span><strong class="pcs-status">Carregando...</strong><span class="pcs-meta"></span></div><button type="button" class="pcs-action">Abrir caixa</button>';
    card.querySelector('.pcs-action')?.addEventListener('click', () => {
      if (sessaoAtual?.status === STATUS_ABERTO) encerrar();
      else abrir();
    });
    painel.appendChild(card);
    renderizar();
  }

  function renderizar() {
    garantirInterface();
    const card = document.getElementById('pdv-cash-session');
    if (!card) return;
    const status = card.querySelector('.pcs-status');
    const meta = card.querySelector('.pcs-meta');
    const botao = card.querySelector('.pcs-action');
    const aberta = sessaoAtual?.status === STATUS_ABERTO;
    card.classList.toggle('aberto', aberta);
    if (aberta) {
      if (status) status.textContent = `ABERTO · ${sessaoAtual.codigo || sessaoAtual.id}`;
      if (meta) meta.textContent = `Desde ${new Date(Number(sessaoAtual.abertoEm) || Date.now()).toLocaleString('pt-BR')} · Fundo ${moeda(sessaoAtual.fundoInicial)}`;
      if (botao) {
        botao.textContent = 'Encerrar sessão';
        botao.disabled = false;
      }
    } else {
      if (status) status.textContent = adminAtual() ? 'Nenhuma sessão aberta' : 'Aguardando login administrativo';
      if (meta) meta.textContent = adminAtual() ? 'Abra uma sessão para iniciar um novo período operacional.' : 'A sessão de caixa é exclusiva do administrador/PDV.';
      if (botao) {
        botao.textContent = 'Abrir caixa';
        botao.disabled = !adminAtual();
      }
    }
  }

  function desconectar() {
    if (refAtual && listenerAtual) {
      try { refAtual.off('value', listenerAtual); } catch (_) {}
    }
    refAtual = null;
    listenerAtual = null;
  }

  function conectar(user) {
    desconectar();
    if (!user || String(user.email || '').toLowerCase() !== ADMIN_EMAIL || !db()) {
      sessaoAtual = null;
      renderizar();
      return;
    }
    refAtual = db().ref(`${PATH}/atual`);
    listenerAtual = snapshot => {
      sessaoAtual = snapshot.val() || null;
      renderizar();
    };
    refAtual.on('value', listenerAtual, erro => {
      console.warn('Não foi possível acompanhar a sessão de caixa:', erro);
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

  window.PdvSessaoCaixa = Object.freeze({
    runtime: 'v1',
    abrir,
    encerrar,
    atual: () => clone(sessaoAtual),
    idAtual: () => sessaoAtual?.status === STATUS_ABERTO ? String(sessaoAtual.id || '') : '',
    codigoAtual: () => sessaoAtual?.status === STATUS_ABERTO ? String(sessaoAtual.codigo || '') : ''
  });
})();
