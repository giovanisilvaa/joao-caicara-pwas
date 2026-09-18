(() => {
  'use strict';

  const CACHE_KEY = 'joao_caicara_cardapio_publico_v1';
  const CONFIG = {
    apiKey: 'AIzaSyB7hHYHFZ3L-z-sPmgKbJI75eaWHlSGI3A',
    authDomain: 'joaocaicaratradicao.firebaseapp.com',
    databaseURL: 'https://joaocaicaratradicao-default-rtdb.firebaseio.com',
    projectId: 'joaocaicaratradicao',
    storageBucket: 'joaocaicaratradicao.firebasestorage.app',
    messagingSenderId: '777982220663',
    appId: '1:777982220663:web:0af4e9bcbaaec847122972'
  };

  const CATEGORIAS = {
    aperitivos: 'Aperitivos',
    saladas: 'Saladas',
    peixe_epoca: 'Peixe da Época',
    file_badejo: 'Filé de Badejo',
    salmao: 'Salmão',
    peixes_camaroes: 'Peixes e Camarões',
    massas_risotos: 'Massas, Risotos, Polvos e Lulas',
    carnes: 'Carnes',
    frango: 'Frango',
    acompanhamentos: 'Acompanhamentos',
    combos_praia: 'Combos de Praia',
    veganos_vegetarianos: 'Veganos e Vegetarianos',
    kids: 'Menu Infantil',
    sushi: 'Sushi',
    rodizio: 'Rodízio',
    sorvetes: 'Sorvetes e Sobremesas',
    cervejas: 'Cervejas',
    caipirinhas: 'Caipirinhas e Drinks',
    destilados: 'Destilados',
    aguas_refrigerantes: 'Águas e Refrigerantes',
    sucos: 'Sucos'
  };

  const ORDEM = Object.keys(CATEGORIAS);
  const IMAGENS_POR_ID = {
    41: '/cardapio/imagens/41-moqueca-de-peixe.webp',
    43: '/cardapio/imagens/43-azul-marinho.webp',
    44: '/cardapio/imagens/44-camarao-na-moranga.webp',
    45: '/cardapio/imagens/45-camarao-a-grega.webp',
    46: '/cardapio/imagens/46-camarao-a-baiana.webp',
    47: '/cardapio/imagens/47-moqueca-camarao-grande.webp',
    48: '/cardapio/imagens/48-bobo-camarao-grande.webp',
    111: '/cardapio/imagens/referencias/frango.webp',
    112: '/cardapio/imagens/referencias/frutos-do-mar.webp',
    113: '/cardapio/imagens/referencias/frutos-do-mar.webp',
    114: '/cardapio/imagens/referencias/massa.webp',
    122: '/cardapio/imagens/122-baiacu-a-caicara.webp',
    9301: '/cardapio/imagens/9301-rodizio-sushi.webp'
  };
  const IMAGENS_POR_CATEGORIA = {
    aperitivos: '/cardapio/imagens/referencias/frutos-do-mar.webp',
    saladas: '/cardapio/imagens/referencias/salada.webp',
    peixe_epoca: '/cardapio/imagens/referencias/frutos-do-mar.webp',
    file_badejo: '/cardapio/imagens/referencias/frutos-do-mar.webp',
    salmao: '/cardapio/imagens/referencias/frutos-do-mar.webp',
    peixes_camaroes: '/cardapio/imagens/referencias/frutos-do-mar.webp',
    massas_risotos: '/cardapio/imagens/referencias/massa.webp',
    carnes: '/cardapio/imagens/referencias/carne.webp',
    frango: '/cardapio/imagens/referencias/frango.webp',
    acompanhamentos: '/cardapio/imagens/referencias/arroz.webp',
    combos_praia: '/cardapio/imagens/referencias/frutos-do-mar.webp',
    veganos_vegetarianos: '/cardapio/imagens/referencias/salada.webp',
    kids: '/cardapio/imagens/referencias/frango.webp',
    sushi: '/cardapio/imagens/referencias/sushi.webp',
    rodizio: '/cardapio/imagens/referencias/sushi.webp',
    sorvetes: '/cardapio/imagens/referencias/sorvete.webp',
    cervejas: '/cardapio/imagens/referencias/cerveja.webp',
    caipirinhas: '/cardapio/imagens/referencias/caipirinha.webp',
    destilados: '/cardapio/imagens/referencias/destilado.webp',
    aguas_refrigerantes: '/cardapio/imagens/referencias/agua.webp',
    sucos: '/cardapio/imagens/referencias/suco.webp'
  };
  const elementos = {
    busca: document.getElementById('busca-cardapio'),
    categorias: document.getElementById('categorias'),
    conteudo: document.getElementById('conteudo-cardapio'),
    status: document.getElementById('status'),
    vazio: document.getElementById('estado-vazio'),
    limpar: document.getElementById('limpar-filtros')
  };

  let itens = [];
  let categoriaAtual = 'todos';
  let buscaAtual = '';

  const normalizarTexto = valor => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const escapar = valor => String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[caractere]);

  const formatarMoeda = valor => Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  function nomeCategoria(chave) {
    if (CATEGORIAS[chave]) return CATEGORIAS[chave];
    return String(chave || 'outros')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, letra => letra.toUpperCase());
  }

  function normalizarLista(valor) {
    const lista = Array.isArray(valor)
      ? valor
      : (valor && typeof valor === 'object' ? Object.values(valor) : []);

    return lista
      .filter(item => item && typeof item === 'object')
      .filter(item => item.ativo !== false && item.disponivel !== false)
      .filter(item => String(item.nome || '').trim() && Number.isFinite(Number(item.preco)))
      .map(item => ({
        id: item.id ?? '',
        nome: String(item.nome).trim(),
        preco: Number(item.preco),
        categoria: String(item.categoria || 'outros'),
        descricao: String(item.descricao || item.detalhes || '').trim(),
        imagem: String(
          item.imagem ||
          item.foto ||
          item.imagemUrl ||
          IMAGENS_POR_ID[Number(item.id)] ||
          IMAGENS_POR_CATEGORIA[String(item.categoria || 'outros')] ||
          ''
        ).trim(),
        servePara2: item.servePara2 === true,
        individual: item.individual === true
      }));
  }

  function categoriasDisponiveis() {
    const presentes = [...new Set(itens.map(item => item.categoria))];
    return presentes.sort((a, b) => {
      const indiceA = ORDEM.indexOf(a);
      const indiceB = ORDEM.indexOf(b);
      if (indiceA === -1 && indiceB === -1) return nomeCategoria(a).localeCompare(nomeCategoria(b), 'pt-BR');
      if (indiceA === -1) return 1;
      if (indiceB === -1) return -1;
      return indiceA - indiceB;
    });
  }

  function renderizarCategorias() {
    const botoes = [
      { chave: 'todos', nome: 'Todos' },
      ...categoriasDisponiveis().map(chave => ({ chave, nome: nomeCategoria(chave) }))
    ];
    elementos.categorias.innerHTML = botoes.map(({ chave, nome }) => `
      <button class="category-button" type="button" data-categoria="${escapar(chave)}" aria-pressed="${chave === categoriaAtual}">${escapar(nome)}</button>
    `).join('');
  }

  function imagemSegura(url) {
    if (!url) return '';
    if (url.startsWith('/')) return url;
    try {
      const destino = new URL(url, window.location.origin);
      return destino.protocol === 'https:' ? destino.href : '';
    } catch (_) {
      return '';
    }
  }

  function cardItem(item) {
    const imagem = imagemSegura(item.imagem);
    const tags = [
      item.servePara2 ? 'Serve 2 pessoas' : '',
      item.individual ? 'Individual' : ''
    ].filter(Boolean);
    return `
      <article class="menu-item${imagem ? ' has-image' : ''}">
        ${imagem ? `<img class="item-image" src="${escapar(imagem)}" alt="" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.remove('has-image')">` : ''}
        <div class="item-info">
          <h3 class="item-name">${escapar(item.nome)}</h3>
          ${item.descricao ? `<p class="item-description">${escapar(item.descricao)}</p>` : ''}
          ${tags.length ? `<div class="item-tags">${tags.map(tag => `<span class="item-tag">${tag}</span>`).join('')}</div>` : ''}
        </div>
        <strong class="item-price">${formatarMoeda(item.preco)}</strong>
      </article>
    `;
  }

  function itensFiltrados() {
    const termo = normalizarTexto(buscaAtual);
    return itens.filter(item => {
      const correspondeCategoria = categoriaAtual === 'todos' || item.categoria === categoriaAtual;
      const texto = normalizarTexto(`${item.nome} ${item.descricao} ${nomeCategoria(item.categoria)}`);
      return correspondeCategoria && (!termo || texto.includes(termo));
    });
  }

  function renderizar() {
    const filtrados = itensFiltrados();
    const grupos = new Map();
    filtrados.forEach(item => {
      if (!grupos.has(item.categoria)) grupos.set(item.categoria, []);
      grupos.get(item.categoria).push(item);
    });

    const categorias = categoriasDisponiveis().filter(chave => grupos.has(chave));
    elementos.conteudo.innerHTML = categorias.map(chave => {
      const lista = grupos.get(chave).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      return `
        <section class="menu-section" id="categoria-${escapar(chave)}">
          <div class="section-heading">
            <h2>${escapar(nomeCategoria(chave))}</h2>
            <span>${lista.length} ${lista.length === 1 ? 'item' : 'itens'}</span>
          </div>
          <div class="item-grid">${lista.map(cardItem).join('')}</div>
        </section>
      `;
    }).join('');

    elementos.vazio.hidden = filtrados.length > 0;
    elementos.conteudo.hidden = filtrados.length === 0;
  }

  function aplicarCardapio(lista, origemCache = false) {
    itens = normalizarLista(lista);
    renderizarCategorias();
    renderizar();
    if (!itens.length) {
      elementos.status.className = 'status error';
      elementos.status.textContent = 'O cardápio está temporariamente indisponível. Fale com nossa equipe.';
      elementos.status.hidden = false;
      elementos.conteudo.hidden = true;
      elementos.vazio.hidden = true;
      return;
    }
    elementos.status.hidden = true;
    if (!origemCache) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(itens)); } catch (_) {}
    }
  }

  function carregarCache() {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
      if (Array.isArray(cache) && cache.length) aplicarCardapio(cache, true);
    } catch (_) {}
  }

  function mostrarErro() {
    if (itens.length) return;
    elementos.status.className = 'status error';
    elementos.status.textContent = 'Não foi possível carregar o cardápio agora. Verifique sua conexão ou fale com nossa equipe.';
    elementos.status.hidden = false;
  }

  elementos.busca.addEventListener('input', evento => {
    buscaAtual = evento.target.value;
    renderizar();
  });

  elementos.categorias.addEventListener('click', evento => {
    const botao = evento.target.closest('[data-categoria]');
    if (!botao) return;
    categoriaAtual = botao.dataset.categoria;
    elementos.categorias.querySelectorAll('[data-categoria]').forEach(item => {
      item.setAttribute('aria-pressed', String(item === botao));
    });
    renderizar();
    window.scrollTo({ top: document.querySelector('.menu-tools').offsetTop, behavior: 'smooth' });
  });

  elementos.limpar.addEventListener('click', () => {
    categoriaAtual = 'todos';
    buscaAtual = '';
    elementos.busca.value = '';
    renderizarCategorias();
    renderizar();
    elementos.busca.focus();
  });

  carregarCache();

  try {
    if (!window.firebase) throw new Error('Firebase não carregado');
    if (!firebase.apps.length) firebase.initializeApp(CONFIG);
    firebase.database().ref('cardapio').on('value', snapshot => {
      aplicarCardapio(snapshot.val());
    }, erro => {
      console.error('Falha ao consultar o cardápio público:', erro);
      mostrarErro();
    });
  } catch (erro) {
    console.error('Falha ao iniciar o cardápio público:', erro);
    mostrarErro();
  }
})();
