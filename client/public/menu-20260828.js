/* Ajustes de cardápio 28/08/2026 — categorias, fallback local e apresentação harmonizada. */
(() => {
  if (window.JOAO_CAICARA_MENU_20260828 === 'v1') return;
  window.JOAO_CAICARA_MENU_20260828 = 'v1';

  const NOVOS = [
    { id:115, nome:'Mandioca + Batata + Camarão', preco:110, categoria:'combos_praia', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:116, nome:'Mandioca + Batata + Peixe', preco:95, categoria:'combos_praia', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:117, nome:'Mandioca + Batata + Carne', preco:95, categoria:'combos_praia', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:118, nome:'Risoto de Palmito e Champignon', preco:65, categoria:'veganos_vegetarianos', setor:'cozinha', favorito:false, ativo:true, servePara2:false, individual:true },
    { id:119, nome:'Risoto de Shimeji', preco:69, categoria:'veganos_vegetarianos', setor:'cozinha', favorito:false, ativo:true, servePara2:false, individual:true },
    { id:120, nome:'Espaguete ao Molho Branco com Palmito', preco:65, categoria:'veganos_vegetarianos', setor:'cozinha', favorito:false, ativo:true, servePara2:false, individual:true },
    { id:121, nome:'Espaguete com Champignon, Alcaparras e Cebola Roxa, Puxado no Azeite', preco:69, categoria:'veganos_vegetarianos', setor:'cozinha', favorito:false, ativo:true, servePara2:false, individual:true },
    { id:122, nome:'Baiacu à Caiçara', preco:240, categoria:'peixes_camaroes', setor:'cozinha', favorito:false, ativo:true, servePara2:true },
    { id:123, nome:'Baiacu à La Meunière', preco:240, categoria:'peixes_camaroes', setor:'cozinha', favorito:false, ativo:true, servePara2:true },
    { id:124, nome:'Filé Mignon à Parmegiana', preco:210, categoria:'carnes', setor:'cozinha', favorito:false, ativo:true, servePara2:true },
    { id:125, nome:'Filé Mignon à Cubana', preco:210, categoria:'carnes', setor:'cozinha', favorito:false, ativo:true, servePara2:true },
    { id:126, nome:'Filé Mignon com Fritas', preco:195, categoria:'carnes', setor:'cozinha', favorito:false, ativo:true, servePara2:true }
  ];

  const SORVETES = [
    { id:400, nome:'Ovomaltine', preco:18.5, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:401, nome:'Pistache', preco:22, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:402, nome:'Brigadeiro', preco:18.5, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:403, nome:'Brownie', preco:18.5, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:404, nome:'Speculoos', preco:18.5, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:405, nome:'Dubai', preco:22, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:406, nome:'Avelã', preco:16, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:407, nome:'Maracujá', preco:16, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:408, nome:'Morango', preco:16, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:409, nome:'Açaí 90g', preco:16, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:410, nome:'7 Belo', preco:11, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:411, nome:'Doce de Leite Aviação', preco:11, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:412, nome:'Framboesa', preco:11, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:413, nome:'Limonada', preco:8.9, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false },
    { id:414, nome:'Uva', preco:8.9, categoria:'sorvetes', setor:'cozinha', favorito:false, ativo:true, servePara2:false }
  ];

  function itemId(lista, id) { return lista.find(item => Number(item?.id) === Number(id)); }
  function inserirAposCategoria(lista, categoria, registros) {
    let ultimo = -1;
    lista.forEach((item, indice) => { if (item?.categoria === categoria) ultimo = indice; });
    if (ultimo < 0) return;
    const ausentes = registros.filter(registro => !itemId(lista, registro.id));
    if (ausentes.length) lista.splice(ultimo + 1, 0, ...ausentes.map(item => ({ ...item })));
  }
  function inserirAusentesNoFim(lista, registros) {
    const ausentes = registros.filter(registro => !itemId(lista, registro.id));
    if (ausentes.length) lista.push(...ausentes.map(item => ({ ...item })));
  }

  function ajustarFallback(lista) {
    if (!Array.isArray(lista) || !lista.length) return;
    const alterar = (id, dados) => { const item = itemId(lista, id); if (item) Object.assign(item, dados); };
    alterar(16, { preco:75 });
    alterar(17, { preco:45 });
    alterar(38, { preco:145 });
    alterar(40, { preco:135 });
    alterar(41, { preco:220 });
    alterar(42, { preco:285 });
    alterar(51, { preco:265 });
    alterar(103, { nome:'Suco de Laranja · 400 ml', preco:20 });
    alterar(104, { preco:18 });
    alterar(105, { nome:'Suco de Laranja com Polpa · 400 ml', preco:22 });

    const heineken = lista.findIndex(item => Number(item?.id) === 75 && /heineken zero/i.test(String(item?.nome || '')));
    if (heineken >= 0) lista.splice(heineken, 1);

    inserirAposCategoria(lista, 'aperitivos', NOVOS.filter(item => item.categoria === 'combos_praia'));
    inserirAposCategoria(lista, 'saladas', NOVOS.filter(item => item.categoria === 'veganos_vegetarianos'));
    inserirAposCategoria(lista, 'peixes_camaroes', NOVOS.filter(item => item.id === 122 || item.id === 123));
    inserirAposCategoria(lista, 'carnes', NOVOS.filter(item => item.id >= 124));
    inserirAusentesNoFim(lista, SORVETES);
  }

  function garantirCategoria(chave, label, depoisDe) {
    try {
      if (typeof categoriasCardapio === 'undefined' || !Array.isArray(categoriasCardapio)) return;
      if (categoriasCardapio.some(item => item.key === chave)) return;
      const indice = categoriasCardapio.findIndex(item => item.key === depoisDe);
      const entrada = { key:chave, label };
      if (indice >= 0) categoriasCardapio.splice(indice + 1, 0, entrada);
      else categoriasCardapio.push(entrada);
    } catch (erro) { console.warn('Falha ao registrar categoria adicional:', erro); }
  }

  function criarTabPdv(chave, label, depoisDe) {
    const tabs = document.querySelector('.menu-panel .tabs');
    if (!tabs || tabs.querySelector(`[data-menu-20260828="${chave}"]`)) return;
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'tab';
    botao.dataset.menu20260828 = chave;
    botao.textContent = label;
    botao.addEventListener('click', () => {
      try { filtrarCardapio(chave); } catch (_) {}
    });
    const referencia = [...tabs.querySelectorAll('.tab')].find(item => (item.getAttribute('onclick') || '').includes(`'${depoisDe}'`)) ||
      tabs.querySelector(`[data-menu-20260828="${depoisDe}"]`);
    if (referencia) referencia.insertAdjacentElement('afterend', botao);
    else tabs.appendChild(botao);
  }

  function garantirEstilo() {
    if (document.getElementById('menu-harmonia-20260828')) return;
    const style = document.createElement('style');
    style.id = 'menu-harmonia-20260828';
    style.textContent = `
      .menu-panel{background:#F9F6F0!important;color:#133C4A}
      .menu-panel .tabs{background:#F9F6F0}
      .menu-panel .tab,.tabs-g .tab-g{font-family:Georgia,'Times New Roman',serif!important;font-weight:700!important;color:#133C4A;background:#FFFDF8;border-color:#E1D5C5}
      .menu-panel .tab.active,.tabs-g .tab-g.active{background:#0F4C5C!important;color:#fff!important;border-color:#D95D39!important;box-shadow:inset 0 -2px 0 #D95D39}
      .products-grid .product-card,#grid-produtos-g .prod-card-g{background:#FFFDF8!important;border-color:#E1D5C5!important;box-shadow:0 3px 10px rgba(19,60,74,.07)}
      .products-grid .product-card h4,#grid-produtos-g .prod-card-g h4{font-family:Georgia,'Times New Roman',serif!important;color:#133C4A!important;line-height:1.25}
      .products-grid .product-card p,#grid-produtos-g .prod-card-g p{color:#D95D39!important;font-weight:900!important}
      #grid-produtos-g{background:#F9F6F0}
      .tabs-g{background:#F9F6F0!important;border-color:#E1D5C5!important}
      .menu-individual-badge{display:block;margin-top:4px;color:#0F4C5C!important;font-size:.69rem;font-weight:900}
    `;
    document.head.appendChild(style);
  }

  function produtoPorId(id) {
    try { return Array.isArray(produtos) ? produtos.find(item => String(item?.id) === String(id)) : null; } catch (_) { return null; }
  }

  function decorarIndividuais() {
    const cards = document.querySelectorAll('.product-card,.prod-card-g');
    cards.forEach(card => {
      if (card.querySelector('.menu-individual-badge')) return;
      const onclick = card.getAttribute('onclick') || '';
      const match = onclick.match(/(?:adicionarProduto|adicionarItemG)\(([^)]+)\)/);
      const id = card.dataset.produtoId || (match ? String(match[1]).replace(/['"]/g, '').trim() : '');
      const produto = produtoPorId(id);
      if (!produto?.individual) return;
      const badge = document.createElement('small');
      badge.className = 'menu-individual-badge';
      badge.textContent = '🍽️ Prato individual';
      card.appendChild(badge);
    });
  }

  let agendado = false;
  function agendarDecoracao() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => { agendado = false; decorarIndividuais(); });
  }

  function iniciar() {
    garantirEstilo();
    try { if (typeof produtosPadrao !== 'undefined') ajustarFallback(produtosPadrao); } catch (erro) { console.warn('Falha ao atualizar fallback do cardápio:', erro); }
    try { if (typeof produtos !== 'undefined' && Array.isArray(produtos) && produtos.length) ajustarFallback(produtos); } catch (_) {}

    garantirCategoria('combos_praia', 'Combos Especiais Praia', 'aperitivos');
    garantirCategoria('veganos_vegetarianos', 'Veganos / Vegetarianos · Individuais', 'saladas');
    garantirCategoria('sorvetes', '🍨 Sorvetes', 'kids');

    if (location.pathname.startsWith('/pdv/')) {
      criarTabPdv('combos_praia', 'Combos Especiais Praia', 'aperitivos');
      criarTabPdv('veganos_vegetarianos', 'Veganos / Vegetarianos · Individuais', 'saladas');
      criarTabPdv('sorvetes', '🍨 Sorvetes', 'kids');
    } else if (location.pathname.startsWith('/garcom/')) {
      try {
        if (document.getElementById('tela-pedido')?.style.display === 'flex' && typeof renderizarTabsG === 'function') renderizarTabsG();
      } catch (_) {}
    }

    const observer = new MutationObserver(agendarDecoracao);
    observer.observe(document.documentElement, { childList:true, subtree:true });
    agendarDecoracao();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else iniciar();
})();
