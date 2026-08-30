/* Comanda visível v4 — renderiza os itens diretamente na área nativa do PDV, com fallback seguro pelo cache local. */
(() => {
  if (window.PDV_COMANDA_VISIBLE_RUNTIME === 'v4') return;
  window.PDV_COMANDA_VISIBLE_RUNTIME = 'v4';

  const STYLE_ID = 'pdv-comanda-visible-v4-style';
  const OLD_STYLE_IDS = ['pdv-comanda-visible-v2-style', 'pdv-comanda-visible-v3-style'];
  const OLD_PANEL_ID = 'pdv-comanda-visible-v2';
  const CACHE_KEY = 'mesas_abertas_caicara_cache';
  let ultimaAssinatura = '';
  let timer = null;

  function limparVersaoAnterior() {
    OLD_STYLE_IDS.forEach(id => {
      try { document.getElementById(id)?.remove(); } catch (_) {}
    });
    try { document.getElementById(OLD_PANEL_ID)?.remove(); } catch (_) {}
  }

  function instalarEstilo() {
    limparVersaoAnterior();
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .order-panel{min-height:0!important}
      .order-panel #order-items{
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
        flex:1 1 240px!important;
        min-height:220px!important;
        max-height:45vh!important;
        overflow-y:auto!important;
        overscroll-behavior:contain;
        padding:10px 14px!important;
        background:#fff!important;
        color:#25383d!important;
      }
      #order-items .pdv-cmd-title{
        position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;gap:8px;
        padding:8px 0 9px;margin-bottom:2px;background:#fff;border-bottom:1px solid #e0e7e4;
        font-size:.78rem;font-weight:900;color:var(--primary,#0F4C5C);text-transform:uppercase;letter-spacing:.05em
      }
      #order-items .pdv-cmd-empty{padding:24px 8px;text-align:center;color:#7a8587;font-size:.88rem}
      #order-items .pdv-cmd-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px 0;border-bottom:1px dashed #d8dfdc}
      #order-items .pdv-cmd-name{font-size:.92rem;font-weight:900;color:#22383e;line-height:1.25;overflow-wrap:anywhere}
      #order-items .pdv-cmd-meta{margin-top:4px;font-size:.76rem;color:#657477;display:flex;gap:7px;flex-wrap:wrap}
      #order-items .pdv-cmd-obs{margin-top:4px;font-size:.76rem;color:#a34731;font-weight:700;overflow-wrap:anywhere}
      #order-items .pdv-cmd-controls{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap;max-width:148px}
      #order-items .pdv-cmd-controls button{min-width:34px;min-height:34px;border:0;border-radius:9px;cursor:pointer;font-weight:900;background:#e8f0ed;color:var(--primary,#0F4C5C)}
      #order-items .pdv-cmd-controls button.pdv-cmd-edit{min-width:auto;padding:0 8px;background:#f2e6d5;color:#5d4933;font-size:.7rem}
      #order-items .pdv-cmd-qtd{min-width:28px;text-align:center;font-weight:900;color:#25383d}
      #order-items .pdv-cmd-sub{grid-column:1/-1;text-align:right;font-size:.8rem;font-weight:900;color:var(--success,#2A9D8F)}
      @media(max-width:1100px){.order-panel #order-items{min-height:260px!important;max-height:420px!important}}
      @media(max-height:720px) and (min-width:1101px){.order-panel #order-items{min-height:180px!important;max-height:36vh!important}}
    `;
    document.head.appendChild(style);
  }

  function numeroPeloTitulo() {
    const texto = document.getElementById('mesa-titulo')?.textContent || '';
    const achou = texto.match(/Mesa\s+(\d+)/i);
    return achou ? Number(achou[1]) : null;
  }

  function numeroAtual() {
    try {
      if (typeof mesaAtualSelecionada !== 'undefined' && mesaAtualSelecionada != null) {
        const numero = Number(mesaAtualSelecionada);
        if (Number.isFinite(numero) && numero > 0) return numero;
      }
    } catch (_) {}
    return numeroPeloTitulo();
  }

  function mesasDoRuntime() {
    try {
      if (typeof mesas !== 'undefined' && mesas && typeof mesas === 'object') return mesas;
    } catch (_) {}
    return null;
  }

  function mesasDoCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function itensBrutos(mesa) {
    if (!mesa || typeof mesa !== 'object') return [];
    if (Array.isArray(mesa.itens)) return mesa.itens.filter(Boolean);
    if (mesa.itens && typeof mesa.itens === 'object') return Object.values(mesa.itens).filter(Boolean);
    return [];
  }

  function mesaTemConteudo(mesa) {
    if (!mesa || typeof mesa !== 'object') return false;
    return Boolean(
      itensBrutos(mesa).length ||
      String(mesa.cliente || '').trim() ||
      mesa.abertura
    );
  }

  function dadosMesa(numero) {
    if (!numero) return null;
    const runtime = mesasDoRuntime();
    const cache = mesasDoCache();
    const mesaRuntime = runtime?.[numero] || runtime?.[String(numero)] || null;
    const mesaCache = cache?.[numero] || cache?.[String(numero)] || null;

    if (mesaTemConteudo(mesaRuntime)) return mesaRuntime;
    if (mesaTemConteudo(mesaCache)) return mesaCache;
    return mesaRuntime || mesaCache || null;
  }

  function normalizarItens(valor) {
    const itens = Array.isArray(valor)
      ? valor
      : (valor && typeof valor === 'object' ? Object.values(valor) : []);
    return itens.filter(Boolean).map(item => ({
      ...item,
      qtd: Number(item?.qtd ?? item?.quantidade ?? 0) || 0,
      preco: Number(item?.preco ?? item?.valor ?? 0) || 0,
      nome: String(item?.nome ?? item?.descricao ?? 'Item')
    })).filter(item => item.qtd > 0);
  }

  function formatar(valor) {
    try {
      if (typeof formatarMoeda === 'function') return formatarMoeda(Number(valor) || 0);
    } catch (_) {}
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function container() {
    const el = document.getElementById('order-items');
    if (!el) return null;
    el.style.setProperty('display', 'block', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('min-height', '220px', 'important');
    return el;
  }

  function funcaoGlobal(nome) {
    try {
      if (typeof window[nome] === 'function') return window[nome];
    } catch (_) {}
    return null;
  }

  function botao(texto, titulo, acao, classe = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = texto;
    b.title = titulo;
    if (classe) b.className = classe;
    b.addEventListener('click', acao);
    return b;
  }

  function assinatura(numero, itens) {
    return `${numero || ''}|${itens.map(item => [item.id, item.nome, item.qtd, item.preco, item.obs || '', item.enviado === true ? 1 : 0].join('~')).join('|')}`;
  }

  function renderizar(forcar = false) {
    instalarEstilo();
    const alvo = container();
    if (!alvo) return;

    const numero = numeroAtual();
    const mesa = dadosMesa(numero);
    const itens = normalizarItens(mesa?.itens);
    const atual = assinatura(numero, itens);
    if (!forcar && atual === ultimaAssinatura && alvo.querySelector('.pdv-cmd-title')) return;
    ultimaAssinatura = atual;

    alvo.replaceChildren();

    const titulo = document.createElement('div');
    titulo.className = 'pdv-cmd-title';
    const texto = document.createElement('span');
    texto.textContent = numero ? `Itens da Mesa ${numero}` : 'Itens da comanda';
    const contador = document.createElement('span');
    contador.textContent = `${itens.reduce((soma, item) => soma + item.qtd, 0)} un.`;
    titulo.append(texto, contador);
    alvo.appendChild(titulo);

    if (!numero) {
      const vazio = document.createElement('div');
      vazio.className = 'pdv-cmd-empty';
      vazio.textContent = 'Selecione uma mesa para visualizar os itens.';
      alvo.appendChild(vazio);
      return;
    }

    if (!itens.length) {
      const vazio = document.createElement('div');
      vazio.className = 'pdv-cmd-empty';
      vazio.textContent = 'Nenhum item encontrado nesta comanda. Se o total estiver diferente de zero, aguarde a sincronização por alguns segundos.';
      alvo.appendChild(vazio);
      return;
    }

    itens.forEach((item, index) => {
      const linha = document.createElement('div');
      linha.className = 'pdv-cmd-row';

      const info = document.createElement('div');
      const nome = document.createElement('div');
      nome.className = 'pdv-cmd-name';
      nome.textContent = `${item.qtd}x ${item.nome}`;
      info.appendChild(nome);

      const meta = document.createElement('div');
      meta.className = 'pdv-cmd-meta';
      const unitario = document.createElement('span');
      unitario.textContent = `Unit.: ${formatar(item.preco)}`;
      const status = document.createElement('span');
      status.textContent = item.enviado === true ? '✅ Enviado' : '🆕 Pendente';
      meta.append(unitario, status);
      info.appendChild(meta);

      if (item.obs) {
        const obs = document.createElement('div');
        obs.className = 'pdv-cmd-obs';
        obs.textContent = `Obs.: ${item.obs}`;
        info.appendChild(obs);
      }

      const controles = document.createElement('div');
      controles.className = 'pdv-cmd-controls';
      const alterar = funcaoGlobal('alterarQtdItem');
      const editarObs = funcaoGlobal('editarObsItem');
      const editarPreco = funcaoGlobal('editarPrecoItem');

      controles.appendChild(botao('−', `Reduzir ${item.nome}`, () => {
        try { if (alterar) alterar(item.id, index, -1); } catch (erro) { console.error('Falha ao reduzir item:', erro); }
        setTimeout(() => renderizar(true), 0);
      }));
      const qtd = document.createElement('span');
      qtd.className = 'pdv-cmd-qtd';
      qtd.textContent = String(item.qtd);
      controles.appendChild(qtd);
      controles.appendChild(botao('+', `Aumentar ${item.nome}`, () => {
        try { if (alterar) alterar(item.id, index, 1); } catch (erro) { console.error('Falha ao aumentar item:', erro); }
        setTimeout(() => renderizar(true), 0);
      }));
      controles.appendChild(botao('Obs.', `Editar observação de ${item.nome}`, () => {
        try { if (editarObs) editarObs(index); } catch (erro) { console.error('Falha ao editar observação:', erro); }
        setTimeout(() => renderizar(true), 0);
      }, 'pdv-cmd-edit'));
      controles.appendChild(botao('Valor', `Editar valor de ${item.nome}`, () => {
        try { if (editarPreco) editarPreco(index); } catch (erro) { console.error('Falha ao editar valor:', erro); }
        setTimeout(() => renderizar(true), 0);
      }, 'pdv-cmd-edit'));

      const subtotal = document.createElement('div');
      subtotal.className = 'pdv-cmd-sub';
      subtotal.textContent = `Subtotal: ${formatar(item.preco * item.qtd)}`;

      linha.append(info, controles, subtotal);
      alvo.appendChild(linha);
    });
  }

  function envolverRenderizacao() {
    try {
      if (typeof renderizarComanda !== 'function' || renderizarComanda.__comandaVisibleV4) return;
      const original = renderizarComanda;
      const envolvida = function(...args) {
        const resultado = original.apply(this, args);
        queueMicrotask(() => renderizar(true));
        return resultado;
      };
      envolvida.__comandaVisibleV4 = true;
      renderizarComanda = envolvida;
      window.renderizarComanda = envolvida;
    } catch (erro) {
      console.warn('Não foi possível envolver renderizarComanda:', erro);
    }
  }

  function observar() {
    const titulo = document.getElementById('mesa-titulo');
    const total = document.getElementById('total-valor');
    [titulo, total].filter(Boolean).forEach(el => {
      if (el.__pdvComandaVisibleV4Observer) return;
      const observer = new MutationObserver(() => queueMicrotask(() => renderizar(true)));
      observer.observe(el, { childList: true, characterData: true, subtree: true });
      el.__pdvComandaVisibleV4Observer = observer;
    });

    try {
      if (typeof db !== 'undefined' && db && !window.__PDV_COMANDA_VISIBLE_V4_DB__) {
        window.__PDV_COMANDA_VISIBLE_V4_DB__ = true;
        db.ref('mesas').on('value', () => setTimeout(() => renderizar(true), 0));
      }
    } catch (_) {}
  }

  function iniciar() {
    instalarEstilo();
    envolverRenderizacao();
    observar();
    renderizar(true);
    if (!timer) timer = setInterval(() => renderizar(false), 1000);
  }

  iniciar();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  window.addEventListener('load', iniciar, { once: true });

  window.PdvComandaVisibleV4 = Object.freeze({ renderizar });
})();
