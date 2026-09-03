/* Central visual do caixa do PDV. Reorganiza somente a interface; não altera dados nem regras operacionais. */
(() => {
  if (!location.pathname.startsWith('/pdv/')) return;
  if (window.PDV_CASH_HUB_RUNTIME === 'v1') return;
  window.PDV_CASH_HUB_RUNTIME = 'v1';

  let observer = null;
  let agendado = false;

  function instalarEstilo() {
    if (document.getElementById('pdv-cash-hub-style')) return;
    const style = document.createElement('style');
    style.id = 'pdv-cash-hub-style';
    style.textContent = `
      #pdv-atalhos-gestao{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;min-width:0}
      #pdv-atalhos-gestao #rdu-btn,#pdv-caixa-btn{grid-column:auto!important;border:0;border-radius:12px;padding:11px 14px;font-weight:900;cursor:pointer;box-shadow:0 3px 0 rgba(23,61,69,.18);min-height:44px}
      #pdv-atalhos-gestao #rdu-btn{background:#173d45;color:#fff}
      #pdv-caixa-btn{background:#0b6570;color:#fff}
      #pdv-caixa-btn.aberto{background:#167467}
      #pdv-caixa-overlay{display:none;position:fixed;inset:0;z-index:2150;background:rgba(12,35,40,.84);align-items:center;justify-content:center;padding:16px}
      #pdv-caixa-modal{width:min(980px,100%);max-height:92vh;overflow:auto;background:#f7f5ef;border-radius:18px;padding:18px;box-shadow:0 18px 60px rgba(0,0,0,.35)}
      .pdv-caixa-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}.pdv-caixa-head h2{margin:0;color:#173d45;font-family:Georgia,serif}.pdv-caixa-head p{margin:4px 0 0;color:#687678;font-size:.82rem}.pdv-caixa-close{border:0;border-radius:9px;padding:8px 12px;background:#e2e8e6;color:#173d45;font-weight:900;cursor:pointer}
      #pdv-caixa-conteudo{display:grid;grid-template-columns:1fr;gap:10px}
      #pdv-caixa-conteudo .indicador-diario.vendas{display:block!important;grid-column:auto!important;min-width:0!important;margin:0!important;padding:12px 14px!important;box-shadow:none!important;border:1px solid #d7e2df!important;border-radius:12px!important;background:#fff!important}
      #pdv-caixa-conteudo .indicador-diario.vendas small{font-size:.7rem!important}#pdv-caixa-conteudo .indicador-diario.vendas strong{font-size:1.35rem!important;margin-top:2px!important}
      #pdv-caixa-conteudo #pdv-cash-session,#pdv-caixa-conteudo #pdv-cash-session-totals,#pdv-caixa-conteudo #pcsh-btn{grid-column:auto!important;width:100%;margin:0!important;box-sizing:border-box}
      #pdv-caixa-conteudo #pcsh-btn{min-height:44px}
      #pcst-toggle-vendas-diarias{display:none!important}
      @media(max-width:620px){#pdv-atalhos-gestao{grid-template-columns:1fr}#pdv-caixa-modal{padding:14px}.pdv-caixa-head{align-items:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function garantirModal() {
    if (document.getElementById('pdv-caixa-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'pdv-caixa-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div id="pdv-caixa-modal" role="dialog" aria-modal="true" aria-labelledby="pdv-caixa-titulo">
        <div class="pdv-caixa-head">
          <div><h2 id="pdv-caixa-titulo">Caixa</h2><p>Sessão atual, vendas, movimento financeiro e histórico em uma única tela.</p></div>
          <button type="button" class="pdv-caixa-close" id="pdv-caixa-fechar">Fechar</button>
        </div>
        <div id="pdv-caixa-conteudo"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay) fechar(); });
    overlay.querySelector('#pdv-caixa-fechar')?.addEventListener('click', fechar);
  }

  function garantirAtalhos() {
    const painel = document.getElementById('painel-diario');
    if (!painel) return;

    let barra = document.getElementById('pdv-atalhos-gestao');
    const relatorios = document.getElementById('rdu-btn');
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'pdv-atalhos-gestao';
      if (relatorios?.parentElement === painel) painel.insertBefore(barra, relatorios);
      else painel.appendChild(barra);
    }

    if (relatorios && relatorios.parentElement !== barra) barra.appendChild(relatorios);
    if (relatorios) {
      relatorios.textContent = '📊 Relatórios';
      relatorios.title = 'Abrir a Central de Relatórios';
    }

    let caixa = document.getElementById('pdv-caixa-btn');
    if (!caixa) {
      caixa = document.createElement('button');
      caixa.id = 'pdv-caixa-btn';
      caixa.type = 'button';
      caixa.textContent = '💰 Caixa';
      caixa.addEventListener('click', abrir);
      barra.appendChild(caixa);
    } else if (caixa.parentElement !== barra) {
      barra.appendChild(caixa);
    }
  }

  function mover(conteudo, seletor) {
    const elemento = document.querySelector(seletor);
    if (!elemento || elemento === conteudo || elemento.parentElement === conteudo) return;
    conteudo.appendChild(elemento);
  }

  function atualizarStatusBotao() {
    const botao = document.getElementById('pdv-caixa-btn');
    if (!botao) return;
    const sessao = document.getElementById('pdv-cash-session');
    const aberta = Boolean(sessao?.classList.contains('aberto'));
    botao.classList.toggle('aberto', aberta);
    botao.textContent = aberta ? '💰 Caixa · Aberto' : '💰 Caixa';
    botao.title = aberta ? 'Abrir informações da sessão de caixa atual' : 'Abrir controles e histórico do caixa';
  }

  function reorganizar() {
    agendado = false;
    instalarEstilo();
    garantirModal();
    garantirAtalhos();
    const conteudo = document.getElementById('pdv-caixa-conteudo');
    if (!conteudo) return;

    mover(conteudo, '#painel-diario .indicador-diario.vendas');
    mover(conteudo, '#pdv-cash-session');
    mover(conteudo, '#pdv-cash-session-totals');
    mover(conteudo, '#pcsh-btn');
    atualizarStatusBotao();
  }

  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(reorganizar);
  }

  function abrir() {
    reorganizar();
    const overlay = document.getElementById('pdv-caixa-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    document.getElementById('pdv-caixa-fechar')?.focus();
  }

  function fechar() {
    const overlay = document.getElementById('pdv-caixa-overlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    document.getElementById('pdv-caixa-btn')?.focus();
  }

  function iniciar() {
    reorganizar();
    if (!observer) {
      observer = new MutationObserver(agendar);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.getElementById('pdv-caixa-overlay')?.style.display === 'flex') fechar();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.PdvCaixaCentral = Object.freeze({ runtime: 'v1', abrir, fechar, reorganizar });
})();
