/* Sorvetes João Caiçara — categoria compartilhada entre PDV e Garçom. */
(() => {
  if (window.JOAO_CAICARA_SORVETES_RUNTIME === 'v1') return;
  window.JOAO_CAICARA_SORVETES_RUNTIME = 'v1';

  const CATALOGO_URL = '/sorvetes-menu-20260905.json?v=1';
  const CATEGORIA = 'sorvetes';
  const ehPdv = location.pathname.startsWith('/pdv/');
  const ehGarcom = location.pathname.startsWith('/garcom/');
  let catalogo = null;
  let agendado = false;

  function registrarCategoria() {
    try {
      if (!Array.isArray(categoriasCardapio) || !catalogo) return;
      if (categoriasCardapio.some(item => item.key === CATEGORIA)) return;
      const entrada = { key:CATEGORIA, label:catalogo.category.label };
      const indiceSushi = categoriasCardapio.findIndex(item => item.key === 'sushi');
      if (indiceSushi >= 0) categoriasCardapio.splice(indiceSushi + 1, 0, entrada);
      else categoriasCardapio.push(entrada);
    } catch (_) {}
  }

  function aplicarFallback(lista) {
    if (!Array.isArray(lista) || !catalogo?.items?.length) return;
    const ids = new Set(lista.map(item => Number(item?.id)).filter(Number.isFinite));
    for (const item of catalogo.items) {
      if (ids.has(Number(item.id))) continue;
      lista.push(JSON.parse(JSON.stringify(item)));
      ids.add(Number(item.id));
    }
  }

  function garantirFallbacks() {
    try { if (typeof produtosPadrao !== 'undefined' && Array.isArray(produtosPadrao)) aplicarFallback(produtosPadrao); } catch (_) {}
    try { if (typeof produtos !== 'undefined' && Array.isArray(produtos)) aplicarFallback(produtos); } catch (_) {}
  }

  function encontrarTabPdv() {
    const raiz = document.querySelector('.menu-panel .tabs');
    if (!raiz) return { raiz:null, tab:null };
    const tab = raiz.querySelector('[data-sorvetes-main-tab]') || [...raiz.querySelectorAll('button')].find(botao => {
      const onclick = botao.getAttribute('onclick') || '';
      return onclick.includes("'sorvetes'") || onclick.includes('"sorvetes"') || String(botao.textContent || '').trim() === catalogo?.category?.label;
    });
    return { raiz, tab:tab || null };
  }

  function garantirTabPdv() {
    if (!ehPdv || !catalogo) return;
    let { raiz, tab } = encontrarTabPdv();
    if (!raiz) return;
    if (!tab) {
      tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab';
      tab.textContent = catalogo.category.label;
      tab.dataset.sorvetesMainTab = '1';
      const sushi = [...raiz.querySelectorAll('button')].find(botao => {
        const onclick = botao.getAttribute('onclick') || '';
        return onclick.includes("'sushi'") || onclick.includes('"sushi"') || /sushi/i.test(String(botao.textContent || ''));
      });
      if (sushi) sushi.insertAdjacentElement('afterend', tab);
      else raiz.appendChild(tab);
    }
    tab.dataset.sorvetesMainTab = '1';
    if (tab.dataset.sorvetesBound !== '1') {
      tab.dataset.sorvetesBound = '1';
      tab.addEventListener('click', event => {
        event.preventDefault();
        try { if (typeof filtrarCardapio === 'function') filtrarCardapio(CATEGORIA); } catch (erro) { console.warn('Falha ao abrir Sorvetes no PDV:', erro); }
      });
    }
  }

  function atualizarGarcom() {
    if (!ehGarcom) return;
    try {
      if (document.getElementById('tela-pedido')?.style.display === 'flex' && typeof renderizarTabsG === 'function') renderizarTabsG();
    } catch (_) {}
  }

  function sincronizar() {
    agendado = false;
    if (!catalogo) return;
    registrarCategoria();
    garantirFallbacks();
    garantirTabPdv();
    atualizarGarcom();
  }

  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(sincronizar);
  }

  const observer = new MutationObserver(agendar);
  if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true });

  async function iniciar() {
    try {
      const resposta = await fetch(CATALOGO_URL, { cache:'no-store' });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const recebido = await resposta.json();
      if (!recebido || recebido.version !== '2026-09-05-v1' || recebido.category?.key !== CATEGORIA || !Array.isArray(recebido.items) || recebido.items.length !== 15) {
        throw new Error('Catálogo Sorvetes inválido ou incompleto.');
      }
      catalogo = recebido;
      sincronizar();
    } catch (erro) {
      console.error('Falha ao carregar categoria Sorvetes:', erro);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else iniciar();

  window.JoaoCaicaraSorvetes = Object.freeze({
    categoria:CATEGORIA,
    catalogo:() => catalogo,
    sincronizar
  });
})();
