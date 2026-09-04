/* Modo operacional privado do PDV.
   Remove da interface do caixa os valores e relatórios gerenciais.
   Preserva todas as rotinas originais no DOM/runtime e mantém apenas um
   controle de sessão sem valores, protegido por reautenticação administrativa. */
(() => {
  if (!location.pathname.startsWith('/pdv/')) return;
  if (window.PDV_MANAGEMENT_HUB_RUNTIME === 'v2') return;
  window.PDV_MANAGEMENT_HUB_RUNTIME = 'v2';

  const ADMIN_EMAIL = 'adm@acesso.joaocaicara.app';
  const DESBLOQUEIO_MS = 60 * 1000;
  let observer = null;
  let agendado = false;
  let desbloqueadoAte = 0;
  let timerDesbloqueio = null;

  const SELETORES_PRIVADOS = [
    '.header-actions .btn-history[onclick*="abrirModalHistorico"]',
    '#painel-diario .indicador-diario.vendas',
    '#pcst-toggle-vendas-diarias',
    '#pcst-toggle-movimento',
    '#pdv-cash-session',
    '#pdv-cash-session-totals',
    '#pcsh-btn',
    '#pdv-atalhos-gestao',
    '#btn-relatorio-garcons',
    '#rdu-btn',
    '#pdv-caixa-btn',
    '#pdv-gestao-btn',
    '#pdv-gestao-overlay',
    '#rdu-overlay',
    '#relatorio-garcons-overlay',
    '#pdv-caixa-overlay',
    '#modal-historico'
  ];

  function instalarEstilo() {
    if (document.getElementById('pdv-operational-privacy-style')) return;
    const style = document.createElement('style');
    style.id = 'pdv-operational-privacy-style';
    style.textContent = `
      .header-actions .btn-history[onclick*="abrirModalHistorico"],
      #painel-diario .indicador-diario.vendas,
      #pcst-toggle-vendas-diarias,
      #pcst-toggle-movimento,
      #pdv-cash-session,
      #pdv-cash-session-totals,
      #pcsh-btn,
      #pdv-atalhos-gestao,
      #btn-relatorio-garcons,
      #rdu-btn,
      #pdv-caixa-btn,
      #pdv-gestao-btn,
      #pdv-gestao-overlay,
      #rdu-overlay,
      #relatorio-garcons-overlay,
      #pdv-caixa-overlay,
      #modal-historico{
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }

      #painel-diario.pdv-operacional-privado{
        grid-template-columns:minmax(0,1fr) auto!important;
        align-items:center!important;
        gap:8px!important;
        padding:6px 12px!important;
        min-height:0!important;
      }
      #painel-diario.pdv-operacional-privado .painel-diario-titulo{
        grid-column:1!important;
        display:flex!important;
        align-items:center!important;
        justify-content:flex-start!important;
        gap:8px!important;
        min-width:0!important;
      }
      #painel-diario.pdv-operacional-privado .painel-diario-titulo strong{
        font-size:1rem!important;
        white-space:nowrap;
      }
      #painel-diario.pdv-operacional-privado #painel-diario-data{
        margin-left:auto!important;
        white-space:nowrap;
      }
      #painel-diario.pdv-operacional-privado .indicador-diario.mesas{
        grid-column:2!important;
        display:inline-flex!important;
        flex-direction:row!important;
        align-items:center!important;
        justify-content:center!important;
        gap:8px!important;
        width:auto!important;
        min-width:0!important;
        margin:0!important;
        padding:6px 10px!important;
        border-radius:999px!important;
        box-shadow:none!important;
        white-space:nowrap;
      }
      #painel-diario.pdv-operacional-privado .indicador-diario.mesas small{
        margin:0!important;
        font-size:.67rem!important;
        line-height:1!important;
      }
      #painel-diario.pdv-operacional-privado .indicador-diario.mesas strong{
        margin:0!important;
        font-size:1.02rem!important;
        line-height:1!important;
      }

      #pdv-sessao-operacional-btn{
        border:1px solid rgba(255,255,255,.2);
        border-radius:9px;
        padding:8px 11px;
        background:rgba(255,255,255,.12);
        color:#fff;
        font-weight:900;
        cursor:pointer;
        white-space:nowrap;
      }
      #pdv-sessao-operacional-btn:hover{background:rgba(255,255,255,.2)}

      #pdv-sessao-operacional-overlay{
        display:none;
        position:fixed;
        inset:0;
        z-index:2350;
        background:rgba(12,35,40,.86);
        align-items:center;
        justify-content:center;
        padding:16px;
      }
      #pdv-sessao-operacional-modal{
        width:min(440px,100%);
        background:#f7f5ef;
        border-radius:18px;
        padding:18px;
        box-shadow:0 18px 60px rgba(0,0,0,.35);
        color:#173d45;
      }
      .pdv-sessao-op-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
      .pdv-sessao-op-head h2{margin:0;font-family:Georgia,serif;color:#173d45;font-size:1.3rem}
      .pdv-sessao-op-head p{margin:4px 0 0;color:#687678;font-size:.78rem;line-height:1.35}
      #pdv-sessao-operacional-fechar{border:0;border-radius:9px;padding:8px 11px;background:#e2e8e6;color:#173d45;font-weight:900;cursor:pointer}
      .pdv-sessao-op-status{border:1px solid #d7e2df;border-radius:12px;background:#fff;padding:11px 12px;margin-bottom:12px}
      .pdv-sessao-op-status small{display:block;color:#6c797b;font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;font-weight:900}
      .pdv-sessao-op-status strong{display:block;margin-top:3px;color:#0f4c5c;font-size:1rem}
      .pdv-sessao-op-login{display:grid;gap:7px}
      .pdv-sessao-op-login label{font-size:.72rem;font-weight:900;color:#536b70}
      #pdv-sessao-operacional-senha{width:100%;border:1px solid #bccdc8;border-radius:9px;padding:10px;background:#fff;color:#173d45}
      .pdv-sessao-op-msg{min-height:19px;font-size:.72rem;font-weight:800;color:#b6533a}
      .pdv-sessao-op-acoes{display:grid;grid-template-columns:1fr;gap:8px;margin-top:5px}
      .pdv-sessao-op-btn{border:0;border-radius:9px;padding:10px 12px;font-weight:900;cursor:pointer;background:#0f4c5c;color:#fff}
      .pdv-sessao-op-btn.sec{background:#536b70}
      .pdv-sessao-op-btn:disabled{opacity:.55;cursor:not-allowed}
      #pdv-sessao-operacional-acao[hidden]{display:none!important}
      .pdv-sessao-op-nota{display:block;margin-top:10px;color:#718083;font-size:.69rem;line-height:1.35}

      @media(max-width:760px){
        #painel-diario.pdv-operacional-privado{padding:6px 8px!important}
        #painel-diario.pdv-operacional-privado #painel-diario-data{display:none!important}
        #painel-diario.pdv-operacional-privado .painel-diario-titulo strong{font-size:.9rem!important}
        #painel-diario.pdv-operacional-privado .indicador-diario.mesas small{display:none!important}
        #pdv-sessao-operacional-btn{padding:7px 9px;font-size:.74rem}
      }
    `;
    document.head.appendChild(style);
  }

  function bloquearElemento(elemento) {
    if (!elemento) return;
    elemento.setAttribute('aria-hidden', 'true');
    if (elemento.matches('button, [role="button"], a')) elemento.setAttribute('tabindex', '-1');
    if (elemento.id && /overlay|modal-historico/.test(elemento.id)) elemento.style.display = 'none';
  }

  function garantirModalSessao() {
    if (document.getElementById('pdv-sessao-operacional-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'pdv-sessao-operacional-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div id="pdv-sessao-operacional-modal" role="dialog" aria-modal="true" aria-labelledby="pdv-sessao-operacional-titulo">
        <div class="pdv-sessao-op-head">
          <div>
            <h2 id="pdv-sessao-operacional-titulo">Sessão operacional</h2>
            <p>Este controle não exibe faturamento, formas de pagamento, fundo ou histórico.</p>
          </div>
          <button type="button" id="pdv-sessao-operacional-fechar">Fechar</button>
        </div>
        <div class="pdv-sessao-op-status">
          <small>Status</small>
          <strong id="pdv-sessao-operacional-status">Carregando…</strong>
        </div>
        <div class="pdv-sessao-op-login">
          <label for="pdv-sessao-operacional-senha">Senha administrativa</label>
          <input id="pdv-sessao-operacional-senha" type="password" autocomplete="current-password" placeholder="Digite a senha para desbloquear">
          <div id="pdv-sessao-operacional-msg" class="pdv-sessao-op-msg" role="status" aria-live="polite"></div>
        </div>
        <div class="pdv-sessao-op-acoes">
          <button type="button" class="pdv-sessao-op-btn" id="pdv-sessao-operacional-desbloquear">Desbloquear</button>
          <button type="button" class="pdv-sessao-op-btn sec" id="pdv-sessao-operacional-acao" hidden>Gerenciar sessão</button>
        </div>
        <small class="pdv-sessao-op-nota">🔒 O desbloqueio dura no máximo 60 segundos e não altera o login atual do PDV.</small>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', event => { if (event.target === overlay) fecharSessao(); });
    overlay.querySelector('#pdv-sessao-operacional-fechar')?.addEventListener('click', fecharSessao);
    overlay.querySelector('#pdv-sessao-operacional-desbloquear')?.addEventListener('click', reautenticar);
    overlay.querySelector('#pdv-sessao-operacional-acao')?.addEventListener('click', executarAcaoSessao);
    overlay.querySelector('#pdv-sessao-operacional-senha')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') reautenticar();
    });
  }

  function garantirBotaoSessao() {
    const acoes = document.querySelector('.header-actions');
    if (!acoes) return;
    let botao = document.getElementById('pdv-sessao-operacional-btn');
    if (!botao) {
      botao = document.createElement('button');
      botao.id = 'pdv-sessao-operacional-btn';
      botao.type = 'button';
      botao.addEventListener('click', abrirSessao);
      const usuario = document.getElementById('usuario-logado-pdv');
      if (usuario?.parentElement === acoes) acoes.insertBefore(botao, usuario);
      else acoes.appendChild(botao);
    }
  }

  function sessaoAtual() {
    try { return window.PdvSessaoCaixa?.atual?.() || null; } catch (_) { return null; }
  }

  function atualizarSessao() {
    const sessao = sessaoAtual();
    const aberta = String(sessao?.status || '').toLowerCase() === 'aberto';
    const botao = document.getElementById('pdv-sessao-operacional-btn');
    if (botao) {
      const texto = aberta ? '🟢 Sessão' : '⚪ Sessão';
      if (botao.textContent !== texto) botao.textContent = texto;
      botao.title = aberta ? 'Sessão operacional aberta · acesso protegido' : 'Sessão operacional fechada · acesso protegido';
    }
    const status = document.getElementById('pdv-sessao-operacional-status');
    if (status) status.textContent = aberta ? '🟢 Aberta' : '⚪ Fechada';
    const acao = document.getElementById('pdv-sessao-operacional-acao');
    if (acao) acao.textContent = aberta ? 'Encerrar sessão' : 'Abrir sessão';
  }

  function limparDesbloqueio() {
    desbloqueadoAte = 0;
    if (timerDesbloqueio) clearTimeout(timerDesbloqueio);
    timerDesbloqueio = null;
    const acao = document.getElementById('pdv-sessao-operacional-acao');
    if (acao) acao.hidden = true;
    const senha = document.getElementById('pdv-sessao-operacional-senha');
    if (senha) senha.value = '';
  }

  function abrirSessao() {
    garantirModalSessao();
    limparDesbloqueio();
    atualizarSessao();
    const msg = document.getElementById('pdv-sessao-operacional-msg');
    if (msg) msg.textContent = '';
    const overlay = document.getElementById('pdv-sessao-operacional-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => document.getElementById('pdv-sessao-operacional-senha')?.focus(), 30);
  }

  function fecharSessao() {
    limparDesbloqueio();
    const overlay = document.getElementById('pdv-sessao-operacional-overlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    document.getElementById('pdv-sessao-operacional-btn')?.focus();
  }

  async function reautenticar() {
    const msg = document.getElementById('pdv-sessao-operacional-msg');
    const senhaEl = document.getElementById('pdv-sessao-operacional-senha');
    const desbloquear = document.getElementById('pdv-sessao-operacional-desbloquear');
    const senha = String(senhaEl?.value || '');
    if (!senha) {
      if (msg) msg.textContent = 'Digite a senha administrativa.';
      senhaEl?.focus();
      return;
    }

    try {
      const firebaseAuth = window.firebase?.auth?.();
      const user = firebaseAuth?.currentUser || null;
      const email = String(user?.email || '').toLowerCase();
      const provider = window.firebase?.auth?.EmailAuthProvider;
      if (!user || email !== ADMIN_EMAIL || !provider?.credential || typeof user.reauthenticateWithCredential !== 'function') {
        throw new Error('Sessão administrativa indisponível');
      }
      if (desbloquear) { desbloquear.disabled = true; desbloquear.textContent = 'Verificando…'; }
      if (msg) msg.textContent = '';
      const credencial = provider.credential(ADMIN_EMAIL, senha);
      await user.reauthenticateWithCredential(credencial);
      desbloqueadoAte = Date.now() + DESBLOQUEIO_MS;
      const acao = document.getElementById('pdv-sessao-operacional-acao');
      if (acao) acao.hidden = false;
      if (senhaEl) senhaEl.value = '';
      if (msg) msg.textContent = 'Acesso administrativo liberado por até 60 segundos.';
      timerDesbloqueio = setTimeout(() => {
        limparDesbloqueio();
        const aviso = document.getElementById('pdv-sessao-operacional-msg');
        if (aviso) aviso.textContent = 'Acesso bloqueado novamente.';
      }, DESBLOQUEIO_MS);
    } catch (erro) {
      console.warn('Falha ao reautenticar controle de sessão:', erro);
      limparDesbloqueio();
      if (msg) msg.textContent = 'Senha administrativa inválida ou sessão indisponível.';
    } finally {
      if (desbloquear) { desbloquear.disabled = false; desbloquear.textContent = 'Desbloquear'; }
    }
  }

  async function executarAcaoSessao() {
    if (Date.now() > desbloqueadoAte) {
      limparDesbloqueio();
      const msg = document.getElementById('pdv-sessao-operacional-msg');
      if (msg) msg.textContent = 'O desbloqueio expirou. Digite a senha novamente.';
      return;
    }
    const api = window.PdvSessaoCaixa;
    if (!api || typeof api.abrir !== 'function' || typeof api.encerrar !== 'function') {
      const msg = document.getElementById('pdv-sessao-operacional-msg');
      if (msg) msg.textContent = 'Controle de sessão ainda está carregando. Tente novamente em instantes.';
      return;
    }

    const aberta = String(sessaoAtual()?.status || '').toLowerCase() === 'aberto';
    fecharSessao();
    try {
      if (aberta) await api.encerrar();
      else await api.abrir();
    } finally {
      setTimeout(atualizarSessao, 100);
    }
  }

  function aplicarPrivacidade() {
    agendado = false;
    instalarEstilo();
    garantirModalSessao();
    garantirBotaoSessao();
    const painel = document.getElementById('painel-diario');
    if (painel) painel.classList.add('pdv-operacional-privado');
    SELETORES_PRIVADOS.forEach(seletor => {
      document.querySelectorAll(seletor).forEach(bloquearElemento);
    });
    atualizarSessao();
  }

  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(aplicarPrivacidade);
  }

  function iniciar() {
    aplicarPrivacidade();
    if (!observer) {
      observer = new MutationObserver(agendar);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.getElementById('pdv-sessao-operacional-overlay')?.style.display === 'flex') fecharSessao();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.PdvPrivacidadeOperacional = Object.freeze({
    runtime: 'v2',
    aplicar: aplicarPrivacidade,
    abrirSessao,
    fecharSessao,
    atualizarSessao,
    get financeiroVisivel() { return false; }
  });
})();