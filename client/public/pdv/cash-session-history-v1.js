/* Histórico somente leitura das sessões de caixa fechadas do PDV. */
(() => {
  if (!location.pathname.startsWith('/pdv/')) return;
  if (window.PDV_CASH_SESSION_HISTORY_RUNTIME === 'v1') return;
  window.PDV_CASH_SESSION_HISTORY_RUNTIME = 'v1';

  const ADMIN_EMAIL = 'adm@acesso.joaocaicara.app';
  const LIMITE = 200;
  let sessoes = [];
  let carregando = false;
  let erroAtual = '';
  let detalheId = '';

  const numero = valor => {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  };
  const moeda = valor => numero(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caractere]));
  const pad = valor => String(valor).padStart(2, '0');

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

  function chaveLocal(valor) {
    const d = new Date(Number(valor));
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function dataHora(valor) {
    const d = new Date(Number(valor));
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
  }

  function duracao(ms) {
    const totalMin = Math.max(0, Math.round(numero(ms) / 60000));
    const horas = Math.floor(totalMin / 60);
    const minutos = totalMin % 60;
    return `${horas}h ${String(minutos).padStart(2, '0')}min`;
  }

  function listaRegistros(valor) {
    if (!valor || typeof valor !== 'object') return [];
    return Object.values(valor)
      .filter(item => item && typeof item === 'object' && item.status === 'fechado' && item.id)
      .sort((a, b) => numero(b.fechadoEm) - numero(a.fechadoEm));
  }

  function filtrosAtuais() {
    return {
      data: document.getElementById('pcsh-data')?.value || '',
      busca: String(document.getElementById('pcsh-busca')?.value || '').trim().toLocaleLowerCase('pt-BR')
    };
  }

  function sessoesFiltradas() {
    const { data, busca } = filtrosAtuais();
    return sessoes.filter(sessao => {
      if (data && chaveLocal(sessao.fechadoEm) !== data) return false;
      if (busca) {
        const alvo = `${sessao.codigo || ''} ${sessao.id || ''}`.toLocaleLowerCase('pt-BR');
        if (!alvo.includes(busca)) return false;
      }
      return true;
    });
  }

  function consolidar(lista) {
    const resumo = {
      sessoes: lista.length,
      comResumo: 0,
      semResumo: 0,
      quantidadeVendas: 0,
      totalVendas: 0,
      taxaServico: 0,
      dinheiroLiquido: 0,
      pix: 0,
      credito: 0,
      debito: 0
    };
    lista.forEach(sessao => {
      const r = sessao?.resumoFinal;
      if (!r || typeof r !== 'object') {
        resumo.semResumo += 1;
        return;
      }
      resumo.comResumo += 1;
      resumo.quantidadeVendas += Math.max(0, numero(r.quantidadeVendas));
      resumo.totalVendas += Math.max(0, numero(r.totalVendas));
      resumo.taxaServico += Math.max(0, numero(r.taxaServico));
      resumo.dinheiroLiquido += Math.max(0, numero(r.dinheiroLiquido));
      resumo.pix += Math.max(0, numero(r.pix));
      resumo.credito += Math.max(0, numero(r.credito));
      resumo.debito += Math.max(0, numero(r.debito));
    });
    return resumo;
  }

  function instalarEstilo() {
    if (document.getElementById('pcsh-style')) return;
    const style = document.createElement('style');
    style.id = 'pcsh-style';
    style.textContent = `
      #pcsh-btn{grid-column:1/-1;border:1px solid #b9ceca;border-radius:10px;padding:10px 12px;background:#eef5f3;color:#173d45;font-weight:900;cursor:pointer}
      #pcsh-overlay{display:none;position:fixed;inset:0;z-index:2200;background:rgba(12,35,40,.84);align-items:center;justify-content:center;padding:16px}
      #pcsh-modal{width:min(1040px,100%);max-height:92vh;overflow:auto;background:#f7f5ef;border-radius:18px;padding:18px;box-shadow:0 18px 60px rgba(0,0,0,.35)}
      .pcsh-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.pcsh-head h2{margin:0;color:#173d45;font-family:Georgia,serif}.pcsh-head p{margin:4px 0 0;color:#687678;font-size:.82rem}.pcsh-close{border:0;border-radius:9px;padding:8px 12px;background:#e2e8e6;color:#173d45;font-weight:900;cursor:pointer}
      .pcsh-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:14px 0;padding:10px;border:1px solid #d7e2df;background:#edf3f1;border-radius:12px}.pcsh-controls label{display:flex;flex-direction:column;gap:4px;font-size:.74rem;font-weight:900;color:#234d56}.pcsh-controls input{border:1px solid #b8c9c5;border-radius:8px;padding:8px;background:#fff}.pcsh-controls .pcsh-busca{min-width:230px}.pcsh-action{border:0;border-radius:8px;padding:8px 11px;font-weight:900;cursor:pointer;background:#0f4c5c;color:#fff}.pcsh-action.sec{background:#d9e5e2;color:#173d45}
      .pcsh-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:14px}.pcsh-card{background:#fff;border:1px solid #e0ddcf;border-radius:11px;padding:10px}.pcsh-card small{display:block;color:#6b7779;font-weight:800;font-size:.7rem}.pcsh-card strong{display:block;color:#0f4c5c;font-size:1.02rem;margin-top:3px}.pcsh-card.aviso strong{color:#a54d2c}
      .pcsh-lista{display:grid;gap:9px}.pcsh-sessao{background:#fff;border:1px solid #e0ddcf;border-radius:12px;padding:11px}.pcsh-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.pcsh-codigo{font-weight:900;color:#173d45}.pcsh-meta{margin-top:3px;color:#687678;font-size:.76rem;line-height:1.4}.pcsh-total{text-align:right;white-space:nowrap}.pcsh-total strong{display:block;color:#0f4c5c}.pcsh-total span{display:block;color:#6b7779;font-size:.7rem;margin-top:2px}.pcsh-detail-btn{margin-top:9px;border:0;border-radius:8px;padding:7px 10px;background:#e5efec;color:#173d45;font-weight:900;cursor:pointer}
      .pcsh-detalhe{display:none;margin-top:10px;padding-top:10px;border-top:1px solid #e7e3d7}.pcsh-sessao.aberta-detalhe .pcsh-detalhe{display:block}.pcsh-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.pcsh-mini{background:#f7faf8;border:1px solid #e6ece9;border-radius:8px;padding:8px}.pcsh-mini small{display:block;color:#6d7b7d;font-size:.65rem;font-weight:800}.pcsh-mini strong{display:block;color:#173d45;margin-top:2px}.pcsh-note{margin-top:9px;padding:9px;border-radius:8px;background:#fff8e8;border:1px solid #efd9a7;color:#755b20;font-size:.76rem;line-height:1.4}.pcsh-empty{padding:26px;text-align:center;background:#fff;border:1px dashed #c8d4d1;border-radius:12px;color:#657174}
      @media(max-width:760px){.pcsh-summary,.pcsh-grid{grid-template-columns:1fr 1fr}.pcsh-row{flex-direction:column}.pcsh-total{text-align:left}.pcsh-controls .pcsh-busca{min-width:0;width:100%}}
      @media(max-width:440px){.pcsh-summary,.pcsh-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function garantirInterface() {
    instalarEstilo();
    const painel = document.getElementById('painel-diario');
    if (painel && !document.getElementById('pcsh-btn')) {
      const btn = document.createElement('button');
      btn.id = 'pcsh-btn';
      btn.type = 'button';
      btn.textContent = '🗂 Histórico de sessões de caixa';
      btn.addEventListener('click', abrir);
      const totais = document.getElementById('pdv-cash-session-totals');
      if (totais) totais.insertAdjacentElement('afterend', btn);
      else painel.appendChild(btn);
    }

    if (document.getElementById('pcsh-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'pcsh-overlay';
    overlay.innerHTML = `
      <div id="pcsh-modal" role="dialog" aria-modal="true" aria-labelledby="pcsh-titulo">
        <div class="pcsh-head">
          <div><h2 id="pcsh-titulo">Histórico de sessões de caixa</h2><p>Períodos fechados e seus resumos financeiros preservados.</p></div>
          <button type="button" class="pcsh-close" id="pcsh-fechar">Fechar</button>
        </div>
        <div class="pcsh-controls">
          <label>Data de encerramento<input type="date" id="pcsh-data"></label>
          <label class="pcsh-busca">Buscar sessão<input type="search" id="pcsh-busca" placeholder="Ex.: CX-20260830"></label>
          <button type="button" class="pcsh-action sec" id="pcsh-limpar">Limpar filtros</button>
          <button type="button" class="pcsh-action" id="pcsh-atualizar">Atualizar</button>
        </div>
        <div id="pcsh-conteudo"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay) fechar(); });
    overlay.querySelector('#pcsh-fechar')?.addEventListener('click', fechar);
    overlay.querySelector('#pcsh-data')?.addEventListener('change', renderizar);
    overlay.querySelector('#pcsh-busca')?.addEventListener('input', renderizar);
    overlay.querySelector('#pcsh-atualizar')?.addEventListener('click', carregar);
    overlay.querySelector('#pcsh-limpar')?.addEventListener('click', () => {
      const data = document.getElementById('pcsh-data');
      const busca = document.getElementById('pcsh-busca');
      if (data) data.value = '';
      if (busca) busca.value = '';
      detalheId = '';
      renderizar();
    });
  }

  function htmlResumo(r) {
    if (!r || typeof r !== 'object') {
      return '<div class="pcsh-note">Esta sessão é anterior ao resumo financeiro final por sessão. O período foi preservado, mas os totais não serão inventados nem reconstruídos automaticamente.</div>';
    }
    const itens = [
      ['Vendas', Math.max(0, numero(r.quantidadeVendas)), false],
      ['Subtotal', r.subtotal, true],
      ['Taxa de serviço', r.taxaServico, true],
      ['Total vendido', r.totalVendas, true],
      ['Dinheiro bruto', r.dinheiroBruto, true],
      ['Troco', r.troco, true],
      ['Dinheiro líquido', r.dinheiroLiquido, true],
      ['PIX', r.pix, true],
      ['Crédito', r.credito, true],
      ['Débito', r.debito, true],
      ['Fundo inicial', r.fundoInicial, true],
      ['Espécie esperada', r.especieEsperada, true]
    ];
    return `<div class="pcsh-grid">${itens.map(([rotulo, valor, monetario]) => `<div class="pcsh-mini"><small>${rotulo}</small><strong>${monetario ? moeda(valor) : escapar(valor)}</strong></div>`).join('')}</div>`;
  }

  function renderizar() {
    garantirInterface();
    const conteudo = document.getElementById('pcsh-conteudo');
    if (!conteudo) return;
    if (carregando) {
      conteudo.innerHTML = '<div class="pcsh-empty">Carregando sessões...</div>';
      return;
    }
    if (erroAtual) {
      conteudo.innerHTML = `<div class="pcsh-empty">${escapar(erroAtual)}</div>`;
      return;
    }

    const lista = sessoesFiltradas();
    const c = consolidar(lista);
    const resumoHtml = `
      <div class="pcsh-summary">
        <div class="pcsh-card"><small>Sessões encontradas</small><strong>${c.sessoes}</strong></div>
        <div class="pcsh-card"><small>Vendas nos resumos</small><strong>${c.quantidadeVendas}</strong></div>
        <div class="pcsh-card"><small>Total vendido</small><strong>${moeda(c.totalVendas)}</strong></div>
        <div class="pcsh-card"><small>Taxa de serviço</small><strong>${moeda(c.taxaServico)}</strong></div>
        <div class="pcsh-card"><small>Dinheiro líquido</small><strong>${moeda(c.dinheiroLiquido)}</strong></div>
        <div class="pcsh-card"><small>PIX</small><strong>${moeda(c.pix)}</strong></div>
        <div class="pcsh-card"><small>Crédito + Débito</small><strong>${moeda(c.credito + c.debito)}</strong></div>
        <div class="pcsh-card ${c.semResumo ? 'aviso' : ''}"><small>Sem resumo final</small><strong>${c.semResumo}</strong></div>
      </div>`;

    if (!lista.length) {
      conteudo.innerHTML = `${resumoHtml}<div class="pcsh-empty">Nenhuma sessão fechada corresponde aos filtros.</div>`;
      return;
    }

    const linhas = lista.map(sessao => {
      const r = sessao.resumoFinal;
      const aberta = String(detalheId) === String(sessao.id);
      const total = r && typeof r === 'object' ? moeda(r.totalVendas) : 'Sem resumo final';
      const operadorAbriu = escapar(sessao?.operadorAbertura?.email || '—');
      const operadorFechou = escapar(sessao?.operadorFechamento?.email || '—');
      return `
        <article class="pcsh-sessao ${aberta ? 'aberta-detalhe' : ''}" data-pcsh-id="${escapar(sessao.id)}">
          <div class="pcsh-row">
            <div>
              <div class="pcsh-codigo">${escapar(sessao.codigo || sessao.id)}</div>
              <div class="pcsh-meta">Aberto: ${escapar(dataHora(sessao.abertoEm))}<br>Encerrado: ${escapar(dataHora(sessao.fechadoEm))} · Duração ${escapar(duracao(sessao.duracaoMs))}</div>
            </div>
            <div class="pcsh-total"><strong>${total}</strong><span>${r ? `${Math.max(0, numero(r.quantidadeVendas))} venda(s)` : 'Histórico legado'}</span></div>
          </div>
          <button type="button" class="pcsh-detail-btn" data-pcsh-detalhar="${escapar(sessao.id)}">${aberta ? 'Ocultar detalhes' : 'Ver detalhes'}</button>
          <div class="pcsh-detalhe">
            ${htmlResumo(r)}
            <div class="pcsh-meta" style="margin-top:9px">Operador abertura: ${operadorAbriu} · Operador fechamento: ${operadorFechou}${r?.calculadoEm ? ` · Resumo calculado: ${escapar(dataHora(r.calculadoEm))}` : ''}</div>
          </div>
        </article>`;
    }).join('');

    conteudo.innerHTML = `${resumoHtml}<div class="pcsh-lista">${linhas}</div>`;
    conteudo.querySelectorAll('[data-pcsh-detalhar]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-pcsh-detalhar') || '';
      detalheId = detalheId === id ? '' : id;
      renderizar();
    }));
  }

  async function carregar() {
    if (!adminAtual()) {
      alert('Faça login como administrador no PDV para consultar o histórico de sessões.');
      return false;
    }
    const database = db();
    if (!database) {
      erroAtual = 'Firebase Database indisponível. Tente novamente.';
      renderizar();
      return false;
    }
    carregando = true;
    erroAtual = '';
    renderizar();
    try {
      const snapshot = await database.ref('sessoesCaixa/registros')
        .orderByChild('fechadoEm')
        .limitToLast(LIMITE)
        .once('value');
      sessoes = listaRegistros(snapshot.val());
      carregando = false;
      renderizar();
      return sessoes.slice();
    } catch (erro) {
      console.warn('Não foi possível carregar o histórico de sessões de caixa:', erro);
      carregando = false;
      erroAtual = 'Não foi possível carregar o histórico agora. Nenhum dado foi alterado.';
      renderizar();
      return false;
    }
  }

  function abrir() {
    garantirInterface();
    if (!adminAtual()) {
      alert('Faça login como administrador no PDV para consultar o histórico de sessões.');
      return false;
    }
    const overlay = document.getElementById('pcsh-overlay');
    if (overlay) overlay.style.display = 'flex';
    void carregar();
    return true;
  }

  function fechar() {
    const overlay = document.getElementById('pcsh-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function iniciar() {
    garantirInterface();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.PdvCashSessionHistory = Object.freeze({
    runtime: 'v1',
    abrir,
    fechar,
    carregar,
    listaRegistros,
    consolidar,
    chaveLocal,
    atuais: () => sessoes.map(item => ({ ...item }))
  });
})();
