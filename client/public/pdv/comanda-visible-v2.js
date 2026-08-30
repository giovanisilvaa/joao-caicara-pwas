/* Comanda visível v2 — mantém os itens da mesa sempre acessíveis no painel do PDV. */
(() => {
  if (window.PDV_COMANDA_VISIBLE_RUNTIME === 'v2') return;
  window.PDV_COMANDA_VISIBLE_RUNTIME = 'v2';

  const STYLE_ID = 'pdv-comanda-visible-v2-style';
  const PANEL_ID = 'pdv-comanda-visible-v2';

  function instalarEstilo() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .order-panel #order-items{display:none!important}
      #${PANEL_ID}{
        display:block!important;
        flex:1 1 auto;
        min-height:180px;
        max-height:42vh;
        overflow-y:auto;
        padding:10px 14px;
        background:#fff;
        border-bottom:1px solid var(--border,#ddd);
        color:#25383d;
      }
      #${PANEL_ID} .pdv-cmd-title{
        position:sticky;
        top:0;
        z-index:2;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
        padding:7px 0 9px;
        margin-bottom:2px;
        background:#fff;
        border-bottom:1px solid #e7ece9;
        font-size:.78rem;
        font-weight:900;
        color:var(--primary,#0F4C5C);
        text-transform:uppercase;
        letter-spacing:.05em;
      }
      #${PANEL_ID} .pdv-cmd-empty{padding:22px 8px;text-align:center;color:#7a8587;font-size:.88rem}
      #${PANEL_ID} .pdv-cmd-row{
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        gap:8px;
        padding:10px 0;
        border-bottom:1px dashed #d8dfdc;
      }
      #${PANEL_ID} .pdv-cmd-name{font-size:.92rem;font-weight:900;color:#22383e;line-height:1.25;overflow-wrap:anywhere}
      #${PANEL_ID} .pdv-cmd-meta{margin-top:4px;font-size:.76rem;color:#657477;display:flex;gap:7px;flex-wrap:wrap}
      #${PANEL_ID} .pdv-cmd-obs{margin-top:4px;font-size:.76rem;color:#a34731;font-weight:700;overflow-wrap:anywhere}
      #${PANEL_ID} .pdv-cmd-controls{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap;max-width:148px}
      #${PANEL_ID} button{
        min-width:34px;
        min-height:34px;
        border:0;
        border-radius:9px;
        cursor:pointer;
        font-weight:900;
        background:#e8f0ed;
        color:var(--primary,#0F4C5C);
      }
      #${PANEL_ID} button.pdv-cmd-edit{min-width:auto;padding:0 8px;background:#f2e6d5;color:#5d4933;font-size:.7rem}
      #${PANEL_ID} .pdv-cmd-qtd{min-width:28px;text-align:center;font-weight:900;color:#25383d}
      #${PANEL_ID} .pdv-cmd-sub{grid-column:1/-1;text-align:right;font-size:.8rem;font-weight:900;color:var(--success,#2A9D8F)}
      @media(max-width:1100px){#${PANEL_ID}{min-height:220px;max-height:360px}}
      @media(max-height:720px) and (min-width:1101px){#${PANEL_ID}{min-height:150px;max-height:34vh}}
    `;
    document.head.appendChild(style);
  }

  function obterMesaAtual() {
    try {
      if (typeof mesaAtualSelecionada === 'undefined' || !mesaAtualSelecionada) return { numero: null, dados: null };
      const numero = mesaAtualSelecionada;
      const dados = typeof mesas !== 'undefined' && mesas ? mesas[numero] : null;
      return { numero, dados };
    } catch (_) {
      return { numero: null, dados: null };
    }
  }

  function formatar(valor) {
    try {
      if (typeof formatarMoeda === 'function') return formatarMoeda(Number(valor) || 0);
    } catch (_) {}
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function criarPainel() {
    let painel = document.getElementById(PANEL_ID);
    if (painel) return painel;
    const orderPanel = document.querySelector('.order-panel');
    const footer = orderPanel?.querySelector('.order-footer');
    if (!orderPanel || !footer) return null;
    painel = document.createElement('div');
    painel.id = PANEL_ID;
    painel.setAttribute('role', 'region');
    painel.setAttribute('aria-label', 'Itens da comanda da mesa selecionada');
    orderPanel.insertBefore(painel, footer);
    return painel;
  }

  function criarBotao(texto, titulo, onClick, classe = '') {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.textContent = texto;
    botao.title = titulo;
    if (classe) botao.className = classe;
    botao.addEventListener('click', onClick);
    return botao;
  }

  function renderizar() {
    instalarEstilo();
    const painel = criarPainel();
    if (!painel) return;

    const { numero, dados } = obterMesaAtual();
    const itens = Array.isArray(dados?.itens)
      ? dados.itens.filter(Boolean)
      : (dados?.itens && typeof dados.itens === 'object' ? Object.values(dados.itens).filter(Boolean) : []);

    painel.replaceChildren();

    const titulo = document.createElement('div');
    titulo.className = 'pdv-cmd-title';
    const tituloTexto = document.createElement('span');
    tituloTexto.textContent = numero ? `Itens da Mesa ${numero}` : 'Itens da comanda';
    const contador = document.createElement('span');
    const unidades = itens.reduce((soma, item) => soma + (Number(item?.qtd) || 0), 0);
    contador.textContent = `${unidades} un.`;
    titulo.append(tituloTexto, contador);
    painel.appendChild(titulo);

    if (!numero) {
      const vazio = document.createElement('div');
      vazio.className = 'pdv-cmd-empty';
      vazio.textContent = 'Selecione uma mesa para visualizar os itens.';
      painel.appendChild(vazio);
      return;
    }

    if (!itens.length) {
      const vazio = document.createElement('div');
      vazio.className = 'pdv-cmd-empty';
      vazio.textContent = 'Comanda vazia.';
      painel.appendChild(vazio);
      return;
    }

    itens.forEach((item, index) => {
      const qtd = Number(item.qtd) || 0;
      const preco = Number(item.preco) || 0;
      const linha = document.createElement('div');
      linha.className = 'pdv-cmd-row';

      const info = document.createElement('div');
      const nome = document.createElement('div');
      nome.className = 'pdv-cmd-name';
      nome.textContent = `${qtd}x ${String(item.nome || 'Item')}`;
      info.appendChild(nome);

      const meta = document.createElement('div');
      meta.className = 'pdv-cmd-meta';
      const unitario = document.createElement('span');
      unitario.textContent = `Unit.: ${formatar(preco)}`;
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
      controles.appendChild(criarBotao('−', `Reduzir ${item.nome || 'item'}`, () => {
        try { alterarQtdItem(item.id, index, -1); } catch (erro) { console.error('Falha ao reduzir item:', erro); }
      }));
      const qtdEl = document.createElement('span');
      qtdEl.className = 'pdv-cmd-qtd';
      qtdEl.textContent = String(qtd);
      controles.appendChild(qtdEl);
      controles.appendChild(criarBotao('+', `Aumentar ${item.nome || 'item'}`, () => {
        try { alterarQtdItem(item.id, index, 1); } catch (erro) { console.error('Falha ao aumentar item:', erro); }
      }));
      controles.appendChild(criarBotao('Obs.', `Editar observação de ${item.nome || 'item'}`, () => {
        try { editarObsItem(index); } catch (erro) { console.error('Falha ao editar observação:', erro); }
      }, 'pdv-cmd-edit'));
      controles.appendChild(criarBotao('Valor', `Editar valor de ${item.nome || 'item'}`, () => {
        try { editarPrecoItem(index); } catch (erro) { console.error('Falha ao editar valor:', erro); }
      }, 'pdv-cmd-edit'));

      const subtotal = document.createElement('div');
      subtotal.className = 'pdv-cmd-sub';
      subtotal.textContent = `Subtotal: ${formatar(preco * qtd)}`;

      linha.append(info, controles, subtotal);
      painel.appendChild(linha);
    });
  }

  function envolverRenderizacao() {
    try {
      if (typeof renderizarComanda !== 'function' || renderizarComanda.__comandaVisibleV2) return;
      const original = renderizarComanda;
      const envolvida = function(...args) {
        const resultado = original.apply(this, args);
        queueMicrotask(renderizar);
        return resultado;
      };
      envolvida.__comandaVisibleV2 = true;
      renderizarComanda = envolvida;
      window.renderizarComanda = envolvida;
    } catch (erro) {
      console.warn('Não foi possível envolver renderizarComanda:', erro);
    }
  }

  function iniciar() {
    instalarEstilo();
    criarPainel();
    envolverRenderizacao();
    renderizar();

    const total = document.getElementById('total-valor');
    if (total && !total.__comandaVisibleObserver) {
      const observer = new MutationObserver(() => queueMicrotask(renderizar));
      observer.observe(total, { childList: true, characterData: true, subtree: true });
      total.__comandaVisibleObserver = observer;
    }

    try {
      if (typeof db !== 'undefined' && db && !window.__PDV_COMANDA_VISIBLE_DB_LISTENER__) {
        window.__PDV_COMANDA_VISIBLE_DB_LISTENER__ = true;
        db.ref('mesas').on('value', () => setTimeout(renderizar, 0));
      }
    } catch (_) {}
  }

  iniciar();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  window.addEventListener('load', iniciar, { once: true });

  window.PdvComandaVisibleV2 = Object.freeze({ renderizar });
})();
