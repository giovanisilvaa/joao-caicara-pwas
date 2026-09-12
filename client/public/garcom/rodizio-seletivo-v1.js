/* Rodízio seletivo do Garçom — cobra por pessoa e envia somente os itens solicitados à produção. */
(() => {
  if (window.GARCOM_RODIZIO_SELETIVO_RUNTIME === 'v2') return;
  window.GARCOM_RODIZIO_SELETIVO_RUNTIME = 'v2';

  const RODIZIO_ID = 9301;
  const STATUS_CONFERENCIA = 'aguardando_pagamento';
  const ITENS_RODIZIO = Object.freeze([
    { codigo: 'shimeji', nome: 'Shimeji', destino: 'cozinha' },
    { codigo: 'harumaki_queijo', nome: 'Harumaki Queijo', destino: 'cozinha' },
    { codigo: 'guioza', nome: 'Guioza', destino: 'cozinha' },
    { codigo: 'bolinho_salmao', nome: 'Bolinho de Salmão', destino: 'cozinha' },
    { codigo: 'casquinha_siri', nome: 'Casquinha de Siri', destino: 'cozinha' },
    { codigo: 'hot_roll_salmao', nome: 'Hot Roll Salmão', destino: 'sushi' },
    { codigo: 'carpaccio_salmao', nome: 'Carpaccio Salmão', destino: 'sushi' },
    { codigo: 'ceviche_peixe_branco', nome: 'Ceviche de Peixe Branco', destino: 'sushi' },
    { codigo: 'sunomono', nome: 'Sunomono', destino: 'sushi' },
    { codigo: 'mini_temaki_salmao_completo', nome: 'Mini Temaki Salmão Completo', destino: 'sushi' },
    { codigo: 'uramaki_salmao', nome: 'Uramaki Salmão', destino: 'sushi' },
    { codigo: 'hossomaki_salmao', nome: 'Hossomaki Salmão', destino: 'sushi' },
    { codigo: 'niguiri_salmao', nome: 'Niguiri Salmão', destino: 'sushi' },
    { codigo: 'niguiri_salmao_macaricado', nome: 'Niguiri Salmão Maçaricado', destino: 'sushi' },
    { codigo: 'joy_salmao', nome: 'Joy Salmão', destino: 'sushi' },
    { codigo: 'joy_geleia', nome: 'Joy Geleia', destino: 'sushi' },
    { codigo: 'joy_shimeji', nome: 'Joy Shimeji', destino: 'sushi' },
    { codigo: 'joy_camarao', nome: 'Joy Camarão', destino: 'sushi' },
    { codigo: 'sashimi_salmao', nome: 'Sashimi Salmão', destino: 'sushi' },
    { codigo: 'sashimi_atum', nome: 'Sashimi Atum', destino: 'sushi' },
    { codigo: 'sashimi_peixe_branco', nome: 'Sashimi Peixe Branco', destino: 'sushi' }
  ]);

  let modalModo = null;
  let selecao = {};
  let interfaceAgendada = false;
  const clone = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));
  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caractere]));
  const moeda = valor => {
    try { if (typeof formatarMoeda === 'function') return formatarMoeda(Number(valor) || 0); } catch (_) {}
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
  };

  function produtosAtuais() {
    try { return Array.isArray(produtos) ? produtos.filter(Boolean) : []; } catch (_) { return []; }
  }

  function produtoRodizio() {
    return produtosAtuais().find(item => Number(item?.id) === RODIZIO_ID) || null;
  }

  function numeroMesaAtual() {
    try { return Number(mesaSelecionada) || null; } catch (_) { return null; }
  }

  function mesaAtual(numero = numeroMesaAtual()) {
    try { return numero && mesas ? mesas[numero] : null; } catch (_) { return null; }
  }

  function idOriginal(item) {
    return Number(item?.produtoOriginalId ?? item?.id);
  }

  function quantidadePessoasRodizio(mesa) {
    const itens = Array.isArray(mesa?.itens) ? mesa.itens.filter(Boolean) : [];
    return itens.reduce((total, item) => idOriginal(item) === RODIZIO_ID ? total + Math.max(0, Number(item.qtd) || 0) : total, 0);
  }

  function contaPendente(mesa) {
    return mesa?.estadoConta === STATUS_CONFERENCIA;
  }

  function identidadeAtual() {
    try {
      if (window.GarcomAtribuicao?.identidadeAtual) return window.GarcomAtribuicao.identidadeAtual();
      const sessao = typeof window.sessaoGarcomAtual === 'function' ? window.sessaoGarcomAtual() : null;
      const nome = String(sessao?.nome || '').trim();
      if (!nome) return null;
      return { nome, login: sessao.login || 'garcom', uid: sessao.uid || sessao.funcionarioId || null, compartilhado: sessao.compartilhado === true };
    } catch (_) { return null; }
  }

  function usuarioGarcomValido() {
    try {
      const user = firebase.auth().currentUser;
      return Boolean(user && !user.isAnonymous && String(user.email || '').toLowerCase() === 'garcom@acesso.joaocaicara.app');
    } catch (_) { return false; }
  }

  function idProdutoDoCard(card) {
    if (card?.dataset?.produtoId) return Number(card.dataset.produtoId);
    const onclick = card?.getAttribute?.('onclick') || '';
    const match = onclick.match(/adicionarItemG\(([^)]+)\)/);
    return match ? Number(String(match[1]).replace(/['"]/g, '').trim()) : NaN;
  }

  function garantirEstilo() {
    if (document.getElementById('rodizio-seletivo-style')) return;
    const style = document.createElement('style');
    style.id = 'rodizio-seletivo-style';
    style.textContent = `
      #btn-rodizio-itens{display:none;background:linear-gradient(135deg,#7b3f98,#5f2d78)!important;color:#fff!important}
      #btn-rodizio-itens.open{display:block}
      #rodizio-seletivo-modal{display:none;position:fixed;inset:0;z-index:8200;background:rgba(8,45,51,.82);align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(4px)}
      #rodizio-seletivo-modal.open{display:flex}
      .rodizio-box{width:min(620px,100%);max-height:92vh;overflow:auto;background:#fffdf8;border-radius:18px;padding:16px;box-shadow:0 24px 60px rgba(0,0,0,.3);color:#18383f}
      .rodizio-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}.rodizio-head h3{margin:0;color:#123e48;font-family:Georgia,serif}.rodizio-close{width:38px;height:38px;border:0;border-radius:50%;background:#edf2f0;color:#123e48;font-size:1.25rem;cursor:pointer}
      .rodizio-note{margin:6px 0 12px;padding:9px 10px;border-radius:10px;background:#eef7f4;color:#23534f;font-size:.82rem;line-height:1.35}
      .rodizio-pessoas{display:flex;align-items:center;gap:10px;margin:12px 0}.rodizio-pessoas input{width:92px;min-height:44px;border:1px solid #ccd9d5;border-radius:10px;padding:7px 10px;font-size:1rem;text-align:center}
      .rodizio-grupo{margin:14px 0 7px;color:#0b5963;font-weight:900;font-size:.84rem;text-transform:uppercase;letter-spacing:.04em}
      .rodizio-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #eee1d4}.rodizio-item strong{font-size:.9rem}.rodizio-item small{display:block;color:#748184;margin-top:2px}
      .rodizio-qtd{display:flex;align-items:center;gap:7px}.rodizio-qtd button{width:36px;height:36px;border:0;border-radius:9px;background:#0b5963;color:#fff;font-size:1.15rem;font-weight:900;cursor:pointer}.rodizio-qtd span{min-width:26px;text-align:center;font-weight:900}
      .rodizio-footer{position:sticky;bottom:-16px;background:#fffdf8;padding:12px 0 2px;display:flex;gap:8px}.rodizio-footer button{flex:1;min-height:46px;border:0;border-radius:10px;font-weight:900;cursor:pointer}.rodizio-cancel{background:#e8eeec;color:#234d56}.rodizio-confirm{background:#2a9d8f;color:#fff}
      .rodizio-card-badge{display:block;margin-top:5px;color:#7b3f98;font-size:.69rem;font-weight:900}
    `;
    document.head.appendChild(style);
  }

  function garantirModal() {
    garantirEstilo();
    let modal = document.getElementById('rodizio-seletivo-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'rodizio-seletivo-modal';
    modal.innerHTML = '<div class="rodizio-box" role="dialog" aria-modal="true"><div class="rodizio-head"><div><h3 id="rodizio-titulo">Rodízio</h3><div id="rodizio-subtitulo"></div></div><button type="button" class="rodizio-close" aria-label="Fechar">×</button></div><div id="rodizio-conteudo"></div><div class="rodizio-footer"><button type="button" class="rodizio-cancel">Cancelar</button><button type="button" class="rodizio-confirm">Confirmar</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.rodizio-close') || event.target.closest('.rodizio-cancel')) return fecharModal();
      const ajuste = event.target.closest('[data-rodizio-ajuste]');
      if (ajuste && modalModo === 'itens') {
        const codigo = ajuste.dataset.rodizioCodigo;
        const delta = Number(ajuste.dataset.rodizioAjuste) || 0;
        selecao[codigo] = Math.max(0, Math.min(99, (Number(selecao[codigo]) || 0) + delta));
        renderizarSelecao();
        return;
      }
      if (event.target.closest('.rodizio-confirm')) confirmarModal();
    });
    return modal;
  }

  function fecharModal() {
    document.getElementById('rodizio-seletivo-modal')?.classList.remove('open');
    modalModo = null;
    selecao = {};
  }

  function abrirAdesao(produto) {
    const numero = numeroMesaAtual();
    if (!numero) return alert('Selecione uma mesa antes de lançar o Rodízio.');
    const mesa = mesaAtual(numero);
    if (contaPendente(mesa)) return alert('A conta está fechada e aguardando pagamento. Reabra a conta antes de alterar o Rodízio.');
    if (!produto) return alert('O Rodízio não está disponível no cardápio neste momento.');
    modalModo = 'adesao';
    const modal = garantirModal();
    modal.querySelector('#rodizio-titulo').textContent = 'Adicionar Rodízio';
    modal.querySelector('#rodizio-subtitulo').textContent = `${moeda(produto.preco)} por pessoa`;
    modal.querySelector('#rodizio-conteudo').innerHTML = `
      <div class="rodizio-note">Informe somente quantas pessoas desta mesa irão consumir o rodízio. Os pratos serão pedidos separadamente, conforme os clientes solicitarem.</div>
      <label class="rodizio-pessoas"><strong>Pessoas no rodízio:</strong><input id="rodizio-pessoas" type="number" min="1" max="30" step="1" value="1" inputmode="numeric"></label>`;
    modal.querySelector('.rodizio-confirm').textContent = 'Adicionar à comanda';
    modal.classList.add('open');
    setTimeout(() => modal.querySelector('#rodizio-pessoas')?.select(), 40);
  }

  function linhasGrupo(destino) {
    return ITENS_RODIZIO.filter(item => item.destino === destino).map(item => `
      <div class="rodizio-item">
        <div><strong>${escapar(item.nome)}</strong><small>${destino === 'sushi' ? 'Sushi' : 'Cozinha'}</small></div>
        <div class="rodizio-qtd">
          <button type="button" data-rodizio-ajuste="-1" data-rodizio-codigo="${escapar(item.codigo)}">−</button>
          <span data-rodizio-valor="${escapar(item.codigo)}">${Number(selecao[item.codigo]) || 0}</span>
          <button type="button" data-rodizio-ajuste="1" data-rodizio-codigo="${escapar(item.codigo)}">+</button>
        </div>
      </div>`).join('');
  }

  function renderizarSelecao() {
    const modal = garantirModal();
    if (modalModo !== 'itens') return;
    modal.querySelector('#rodizio-conteudo').innerHTML = `
      <div class="rodizio-note">Selecione somente o que a mesa pediu agora. Você pode abrir esta tela novamente quantas vezes for necessário durante o rodízio.</div>
      <div class="rodizio-grupo">Cozinha</div>${linhasGrupo('cozinha')}
      <div class="rodizio-grupo">Sushi</div>${linhasGrupo('sushi')}`;
  }

  function abrirItens() {
    const numero = numeroMesaAtual();
    const mesa = mesaAtual(numero);
    const pessoas = quantidadePessoasRodizio(mesa);
    if (!numero || !pessoas) return alert('Esta mesa não possui Rodízio ativo.');
    if (contaPendente(mesa)) return alert('A conta está fechada e aguardando pagamento. Reabra a conta antes de pedir novos itens.');
    modalModo = 'itens';
    selecao = Object.fromEntries(ITENS_RODIZIO.map(item => [item.codigo, 0]));
    const modal = garantirModal();
    modal.querySelector('#rodizio-titulo').textContent = 'Itens do Rodízio';
    modal.querySelector('#rodizio-subtitulo').textContent = `Mesa ${numero} · ${pessoas} pessoa${pessoas === 1 ? '' : 's'} no rodízio`;
    modal.querySelector('.rodizio-confirm').textContent = 'Enviar para produção';
    renderizarSelecao();
    modal.classList.add('open');
  }

  async function adicionarCobrancaRodizio() {
    const numero = numeroMesaAtual();
    const produto = produtoRodizio();
    const input = document.getElementById('rodizio-pessoas');
    const quantidade = Math.floor(Number(input?.value) || 0);
    if (!numero || !produto || !window.MesaAtomic?.adicionarCobranca) throw new Error('Mesa, Rodízio ou núcleo atômico indisponível.');
    if (!usuarioGarcomValido()) throw new Error('Aguarde a autenticação do Garçom antes de lançar o Rodízio.');
    if (quantidade < 1 || quantidade > 30) throw new Error('Informe uma quantidade entre 1 e 30 pessoas.');

    const cobranca = {
      ...produto,
      produtoOriginalId: RODIZIO_ID,
      nomeOriginal: produto.nome,
      somenteCobrancaRodizio: true
    };
    const resultado = await window.MesaAtomic.adicionarCobranca(numero, cobranca, quantidade, {
      identidade: identidadeAtual(),
      origem: 'garcom'
    });
    if (!resultado.committed) throw new Error(resultado.motivo === 'mesa_bloqueada' ? 'A mesa está concluindo outra operação. Tente novamente.' : 'Não foi possível lançar o Rodízio.');
    mesas[numero] = resultado.mesa;
    try { renderizarComandaG(); renderizarMesasG(); } catch (_) {}
    try {
      if (typeof registrarAuditoriaGarcom === 'function') {
        Promise.resolve(registrarAuditoriaGarcom('adicionar_rodizio', { mesa: numero, pessoas: quantidade, precoUnitario: Number(produto.preco) || 0 })).catch(() => {});
      }
    } catch (_) {}
    fecharModal();
    agendarInterface();
  }

  function itensSelecionados() {
    return ITENS_RODIZIO.map(item => ({ ...item, qtd: Number(selecao[item.codigo]) || 0 })).filter(item => item.qtd > 0);
  }

  async function enviarItensRodizio() {
    const numero = numeroMesaAtual();
    const escolhidos = itensSelecionados();
    if (!numero || !window.MesaAtomic) throw new Error('Mesa ou núcleo atômico indisponível.');
    if (!usuarioGarcomValido()) throw new Error('Aguarde a autenticação do Garçom antes de enviar o pedido.');
    if (!escolhidos.length) throw new Error('Selecione pelo menos um item do Rodízio.');

    let lock = null;
    try {
      lock = await window.MesaAtomic.bloquearMesa(numero, { tipo: 'pedido_rodizio', origem: 'garcom' });
      if (!lock.committed) throw new Error('A mesa está concluindo outra operação. Aguarde um instante e tente novamente.');
      const mesa = window.MesaAtomic.normalizarMesa(lock.mesa);
      if (contaPendente(mesa)) throw new Error('A conta está fechada e aguardando pagamento. Reabra a conta antes de pedir novos itens.');
      const pessoas = quantidadePessoasRodizio(mesa);
      if (!pessoas) throw new Error('O Rodízio não está mais ativo nesta mesa.');

      const agora = Date.now();
      const atualizacoes = {
        [`mesas/${numero}/bloqueioOperacional/ativo`]: false,
        [`mesas/${numero}/bloqueioOperacional/liberadoEm`]: agora,
        [`mesas/${numero}/bloqueioOperacional/motivoLiberacao`]: 'pedido_rodizio_confirmado'
      };
      const grupos = {
        cozinha: escolhidos.filter(item => item.destino === 'cozinha'),
        sushi: escolhidos.filter(item => item.destino === 'sushi')
      };

      Object.entries(grupos).forEach(([destino, lista]) => {
        if (!lista.length) return;
        const ref = db.ref('pedidosProducao').push();
        atualizacoes[`pedidosProducao/${ref.key}`] = {
          chave: ref.key,
          mesa: Number(numero),
          cliente: mesa.cliente || '',
          setor: 'cozinha',
          subSetor: destino,
          titulo: destino === 'sushi' ? 'PEDIDO SUSHI' : 'PEDIDO COZINHA',
          tipo: 'rodizio_itens',
          rodizio: true,
          rodizioPessoas: pessoas,
          itens: lista.map(item => ({
            id: `rodizio_${item.codigo}`,
            nome: item.nome,
            qtd: item.qtd,
            preco: 0,
            setor: 'cozinha',
            rodizioItem: true,
            rodizioOrigemId: RODIZIO_ID,
            rodizioDestino: destino
          })),
          status: 'recebido',
          origem: 'garcom',
          criadoEm: agora,
          atualizadoEm: agora
        };
      });

      await db.ref('/').update(atualizacoes);
      const local = clone(mesa);
      local.bloqueioOperacional = { ...(local.bloqueioOperacional || {}), ativo: false, liberadoEm: agora, motivoLiberacao: 'pedido_rodizio_confirmado' };
      mesas[numero] = local;
      try { renderizarComandaG(); renderizarMesasG(); } catch (_) {}
      try {
        if (typeof registrarAuditoriaGarcom === 'function') {
          Promise.resolve(registrarAuditoriaGarcom('pedido_rodizio', {
            mesa: numero,
            pessoas,
            itens: escolhidos.map(item => ({ nome: item.nome, qtd: item.qtd, destino: item.destino }))
          })).catch(() => {});
        }
      } catch (_) {}
      fecharModal();
      alert('Itens do Rodízio enviados para a produção.');
    } catch (erro) {
      if (lock?.id) {
        try { await window.MesaAtomic.cancelarBloqueio(numero, lock.id, 'falha_pedido_rodizio'); } catch (_) {}
      }
      throw erro;
    }
  }

  async function confirmarModal() {
    const botao = document.querySelector('#rodizio-seletivo-modal .rodizio-confirm');
    if (botao?.disabled) return;
    if (botao) { botao.disabled = true; botao.textContent = modalModo === 'itens' ? 'Enviando...' : 'Adicionando...'; }
    try {
      if (modalModo === 'adesao') await adicionarCobrancaRodizio();
      else if (modalModo === 'itens') await enviarItensRodizio();
    } catch (erro) {
      console.error('Falha no fluxo seletivo do Rodízio:', erro);
      alert(erro?.message || 'Não foi possível concluir a operação do Rodízio.');
    } finally {
      if (botao && document.body.contains(botao)) {
        botao.disabled = false;
        botao.textContent = modalModo === 'itens' ? 'Enviar para produção' : 'Adicionar à comanda';
      }
    }
  }

  function garantirBotao() {
    garantirEstilo();
    const area = document.querySelector('.acoes-comanda-g');
    if (!area) return null;
    let botao = document.getElementById('btn-rodizio-itens');
    if (!botao) {
      botao = document.createElement('button');
      botao.id = 'btn-rodizio-itens';
      botao.type = 'button';
      botao.textContent = '🍣 Pedir itens do Rodízio';
      botao.addEventListener('click', abrirItens);
      const referencia = document.getElementById('btn-enviar-g');
      if (referencia) area.insertBefore(botao, referencia);
      else area.appendChild(botao);
    }
    return botao;
  }

  function decorarCardRodizio() {
    document.querySelectorAll('#grid-produtos-g .prod-card-g').forEach(card => {
      if (idProdutoDoCard(card) !== RODIZIO_ID || card.querySelector('.rodizio-card-badge')) return;
      const badge = document.createElement('small');
      badge.className = 'rodizio-card-badge';
      badge.textContent = 'Cobrança por pessoa · itens pedidos separadamente';
      card.appendChild(badge);
    });
  }

  function atualizarInterface() {
    interfaceAgendada = false;
    const botao = garantirBotao();
    const mesa = mesaAtual();
    const pessoas = quantidadePessoasRodizio(mesa);
    if (botao) {
      botao.classList.toggle('open', pessoas > 0 && !contaPendente(mesa));
      const rotulo = pessoas > 0 ? `🍣 Rodízio: pedir itens (${pessoas})` : '🍣 Pedir itens do Rodízio';
      if (botao.textContent !== rotulo) botao.textContent = rotulo;
    }
    decorarCardRodizio();
  }

  function agendarInterface() {
    if (interfaceAgendada) return;
    interfaceAgendada = true;
    requestAnimationFrame(atualizarInterface);
  }

  document.addEventListener('click', event => {
    const card = event.target.closest('#grid-produtos-g .prod-card-g');
    if (!card || idProdutoDoCard(card) !== RODIZIO_ID) return;
    if (event.target.closest('[data-sushi-detail]')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    abrirAdesao(produtoRodizio());
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') fecharModal();
  });

  const observer = new MutationObserver(agendarInterface);
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', agendarInterface, { once: true });
  else agendarInterface();

  window.GarcomRodizioSeletivo = Object.freeze({
    RODIZIO_ID,
    itens: ITENS_RODIZIO,
    quantidadePessoasRodizio,
    abrirItens,
    abrirAdesao
  });
})();