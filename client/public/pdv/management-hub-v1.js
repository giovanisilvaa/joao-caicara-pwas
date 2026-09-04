/* Central compacta de Gestão do PDV.
   Reorganiza apenas a interface e reutiliza os botões/funções já existentes.
   Não altera vendas, sessões, relatórios, mesas, pedidos ou Firebase. */
(() => {
  if (!location.pathname.startsWith('/pdv/')) return;
  if (window.PDV_MANAGEMENT_HUB_RUNTIME === 'v1') return;
  window.PDV_MANAGEMENT_HUB_RUNTIME = 'v1';

  let observer = null;
  let agendado = false;

  function instalarEstilo() {
    if (document.getElementById('pdv-management-hub-style')) return;
    const style = document.createElement('style');
    style.id = 'pdv-management-hub-style';
    style.textContent = `
      #painel-diario.pdv-gestao-compacto{
        grid-template-columns:minmax(0,1fr) auto!important;
        align-items:center!important;
        gap:8px!important;
        padding:6px 12px!important;
        min-height:0!important;
      }
      #painel-diario.pdv-gestao-compacto .painel-diario-titulo{
        grid-column:1!important;
        display:flex!important;
        align-items:center!important;
        justify-content:flex-start!important;
        gap:8px!important;
        min-width:0!important;
      }
      #painel-diario.pdv-gestao-compacto .painel-diario-titulo strong{
        font-size:1rem!important;
        white-space:nowrap;
      }
      #painel-diario.pdv-gestao-compacto #painel-diario-data{
        margin-left:auto!important;
        white-space:nowrap;
      }
      #painel-diario.pdv-gestao-compacto .indicador-diario.mesas{
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
      #painel-diario.pdv-gestao-compacto .indicador-diario.mesas small{
        margin:0!important;
        font-size:.67rem!important;
        line-height:1!important;
      }
      #painel-diario.pdv-gestao-compacto .indicador-diario.mesas strong{
        margin:0!important;
        font-size:1.02rem!important;
        line-height:1!important;
      }
      #pdv-gestao-btn{
        flex:0 0 auto;
        border:1px solid rgba(15,76,92,.18);
        border-radius:10px;
        min-height:34px;
        padding:7px 11px;
        background:#173d45;
        color:#fff;
        font-weight:900;
        cursor:pointer;
        box-shadow:0 2px 0 rgba(23,61,69,.18);
      }
      #pdv-gestao-btn:hover{filter:brightness(1.08)}

      /* Os controles originais continuam no DOM e funcionais; apenas saem da tela principal. */
      #pdv-atalhos-gestao,
      #painel-diario > #btn-relatorio-garcons,
      #painel-diario > #rdu-btn,
      #painel-diario > #pdv-caixa-btn{
        display:none!important;
      }

      #pdv-gestao-overlay{
        display:none;
        position:fixed;
        inset:0;
        z-index:2250;
        background:rgba(12,35,40,.84);
        align-items:center;
        justify-content:center;
        padding:16px;
      }
      #pdv-gestao-modal{
        width:min(560px,100%);
        background:#f7f5ef;
        border-radius:18px;
        padding:18px;
        box-shadow:0 18px 60px rgba(0,0,0,.35);
      }
      .pdv-gestao-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        margin-bottom:14px;
      }
      .pdv-gestao-head h2{
        margin:0;
        color:#173d45;
        font-family:Georgia,serif;
      }
      .pdv-gestao-head p{
        margin:4px 0 0;
        color:#687678;
        font-size:.82rem;
        line-height:1.35;
      }
      #pdv-gestao-fechar{
        border:0;
        border-radius:9px;
        padding:8px 12px;
        background:#e2e8e6;
        color:#173d45;
        font-weight:900;
        cursor:pointer;
      }
      .pdv-gestao-acoes{
        display:grid;
        grid-template-columns:1fr;
        gap:9px;
      }
      .pdv-gestao-acao{
        width:100%;
        min-height:58px;
        border:1px solid #d7e2df;
        border-radius:13px;
        background:#fff;
        color:#173d45;
        padding:11px 13px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        text-align:left;
        cursor:pointer;
        box-shadow:0 2px 0 rgba(23,61,69,.08);
      }
      .pdv-gestao-acao:hover{border-color:#9fbab4;background:#fbfdfc}
      .pdv-gestao-acao:disabled{opacity:.55;cursor:not-allowed}
      .pdv-gestao-acao strong{display:block;font-size:.95rem}
      .pdv-gestao-acao small{display:block;margin-top:3px;color:#6c797b;font-size:.73rem;line-height:1.25}
      .pdv-gestao-seta{font-size:1.15rem;color:#6b7a7c;flex:0 0 auto}

      @media(max-width:760px){
        #painel-diario.pdv-gestao-compacto{
          grid-template-columns:minmax(0,1fr) auto!important;
          padding:6px 8px!important;
        }
        #painel-diario.pdv-gestao-compacto #painel-diario-data{display:none!important}
        #painel-diario.pdv-gestao-compacto .painel-diario-titulo strong{font-size:.9rem!important}
        #painel-diario.pdv-gestao-compacto .indicador-diario.mesas small{display:none!important}
        #pdv-gestao-btn{min-height:32px;padding:6px 9px;font-size:.76rem}
        #pdv-gestao-modal{padding:14px}
      }
    `;
    document.head.appendChild(style);
  }

  function garantirModal() {
    if (document.getElementById('pdv-gestao-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'pdv-gestao-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div id="pdv-gestao-modal" role="dialog" aria-modal="true" aria-labelledby="pdv-gestao-titulo">
        <div class="pdv-gestao-head">
          <div>
            <h2 id="pdv-gestao-titulo">Gestão</h2>
            <p>Relatórios, vendas por garçom e caixa fora da área principal de atendimento.</p>
          </div>
          <button type="button" id="pdv-gestao-fechar">Fechar</button>
        </div>
        <div class="pdv-gestao-acoes">
          <button type="button" class="pdv-gestao-acao" id="pdv-gestao-relatorios">
            <span><strong>📊 Relatórios</strong><small>Resumo financeiro, vendas e indicadores.</small></span>
            <span class="pdv-gestao-seta">›</span>
          </button>
          <button type="button" class="pdv-gestao-acao" id="pdv-gestao-garcons">
            <span><strong>👥 Vendas por Garçom</strong><small>Consulta e impressão do desempenho diário.</small></span>
            <span class="pdv-gestao-seta">›</span>
          </button>
          <button type="button" class="pdv-gestao-acao" id="pdv-gestao-caixa">
            <span><strong id="pdv-gestao-caixa-titulo">💰 Caixa</strong><small id="pdv-gestao-caixa-status">Sessão, movimento e histórico.</small></span>
            <span class="pdv-gestao-seta">›</span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) fechar();
    });
    overlay.querySelector('#pdv-gestao-fechar')?.addEventListener('click', fechar);
    overlay.querySelector('#pdv-gestao-relatorios')?.addEventListener('click', () => abrirOriginal('rdu-btn', 'Relatórios'));
    overlay.querySelector('#pdv-gestao-garcons')?.addEventListener('click', () => abrirOriginal('btn-relatorio-garcons', 'Vendas por Garçom'));
    overlay.querySelector('#pdv-gestao-caixa')?.addEventListener('click', () => abrirOriginal('pdv-caixa-btn', 'Caixa'));
  }

  function garantirBotao() {
    const painel = document.getElementById('painel-diario');
    const titulo = painel?.querySelector('.painel-diario-titulo');
    if (!painel || !titulo) return;
    painel.classList.add('pdv-gestao-compacto');

    let botao = document.getElementById('pdv-gestao-btn');
    if (!botao) {
      botao = document.createElement('button');
      botao.id = 'pdv-gestao-btn';
      botao.type = 'button';
      botao.textContent = '☰ Gestão';
      botao.title = 'Abrir Relatórios, Vendas por Garçom e Caixa';
      botao.addEventListener('click', abrir);
      titulo.appendChild(botao);
    } else if (botao.parentElement !== titulo) {
      titulo.appendChild(botao);
    }
  }

  function atualizarDisponibilidade() {
    const mapa = [
      ['pdv-gestao-relatorios', 'rdu-btn'],
      ['pdv-gestao-garcons', 'btn-relatorio-garcons'],
      ['pdv-gestao-caixa', 'pdv-caixa-btn']
    ];
    mapa.forEach(([novoId, originalId]) => {
      const novo = document.getElementById(novoId);
      if (novo) novo.disabled = !document.getElementById(originalId);
    });

    const originalCaixa = document.getElementById('pdv-caixa-btn');
    const tituloCaixa = document.getElementById('pdv-gestao-caixa-titulo');
    const statusCaixa = document.getElementById('pdv-gestao-caixa-status');
    const aberto = Boolean(originalCaixa?.classList.contains('aberto') || /aberto/i.test(originalCaixa?.textContent || ''));
    const novoTitulo = aberto ? '💰 Caixa · Aberto' : '💰 Caixa';
    const novoStatus = aberto ? 'Sessão aberta · movimento e histórico.' : 'Sessão, movimento e histórico.';
    if (tituloCaixa && tituloCaixa.textContent !== novoTitulo) tituloCaixa.textContent = novoTitulo;
    if (statusCaixa && statusCaixa.textContent !== novoStatus) statusCaixa.textContent = novoStatus;
  }

  function reorganizar() {
    agendado = false;
    instalarEstilo();
    garantirModal();
    garantirBotao();
    atualizarDisponibilidade();
  }

  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(reorganizar);
  }

  function abrir() {
    reorganizar();
    const overlay = document.getElementById('pdv-gestao-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    document.getElementById('pdv-gestao-fechar')?.focus();
  }

  function fechar(restaurarFoco = true) {
    const overlay = document.getElementById('pdv-gestao-overlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    if (restaurarFoco) document.getElementById('pdv-gestao-btn')?.focus();
  }

  function abrirOriginal(id, nome) {
    const original = document.getElementById(id);
    if (!original) {
      alert(`${nome} ainda está carregando. Tente novamente em um instante.`);
      agendar();
      return;
    }
    fechar(false);
    requestAnimationFrame(() => original.click());
  }

  function iniciar() {
    reorganizar();
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
      if (event.key === 'Escape' && document.getElementById('pdv-gestao-overlay')?.style.display === 'flex') fechar();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.PdvGestaoCentral = Object.freeze({ runtime: 'v1', abrir, fechar, reorganizar });
})();