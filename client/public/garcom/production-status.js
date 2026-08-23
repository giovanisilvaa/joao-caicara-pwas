/* Acompanhamento de produção para o PWA do Garçom. */
(() => {
  const pedidosGarcom = {};
  let producaoInicialCarregada = false;
  let prontosConhecidos = new Set();

  const STATUS = {
    recebido: { label: 'Na produção', icon: '⏳', cls: 'production-waiting' },
    impresso: { label: 'Na produção', icon: '🧾', cls: 'production-waiting' },
    em_preparo: { label: 'Em preparo', icon: '🔥', cls: 'production-preparing' },
    pronto: { label: 'Pronto', icon: '✅', cls: 'production-ready' }
  };
  const textoTempo = ts => {
    const min = Math.max(0, Math.floor((Date.now() - (Number(ts) || Date.now())) / 60000));
    if (min < 1) return 'agora';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), r = min % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  };

  function ativosMesa(numero) {
    return Object.entries(pedidosGarcom)
      .filter(([, p]) => String(p?.mesa) === String(numero) && !['entregue', 'cancelado'].includes(p?.status))
      .sort((a,b) => (a[1].criadoEm || 0) - (b[1].criadoEm || 0));
  }

  function statusMesa(numero) {
    const ativos = ativosMesa(numero);
    if (!ativos.length) return null;
    const prontos = ativos.filter(([,p]) => p.status === 'pronto');
    if (prontos.length) return { ...STATUS.pronto, pedidos: prontos, tempo: prontos[0][1].prontoEm || prontos[0][1].criadoEm };
    const preparo = ativos.filter(([,p]) => p.status === 'em_preparo');
    if (preparo.length) return { ...STATUS.em_preparo, pedidos: preparo, tempo: preparo[0][1].emPreparoEm || preparo[0][1].criadoEm };
    return { ...STATUS.recebido, pedidos: ativos, tempo: ativos[0][1].criadoEm };
  }

  function decorarMesas() {
    const numeros = [...Array.from({length:25},(_,i)=>i+1), ...Array.from({length:16},(_,i)=>i+50)];
    numeros.forEach(numero => {
      const btn = document.getElementById(`mesa-btn-g-${numero}`);
      if (!btn) return;
      btn.classList.remove('production-waiting','production-preparing','production-ready');
      const status = statusMesa(numero);
      if (!status) return;
      btn.classList.add(status.cls);
      const state = btn.querySelector('.mesa-btn__state');
      const meta = btn.querySelector('.mesa-btn__meta');
      if (state) state.textContent = `${status.icon} ${status.label}`;
      if (meta) meta.textContent = `${status.pedidos.length} pedido(s) · ${textoTempo(status.tempo)}`;
      btn.title = `Mesa ${numero}: ${status.label}`;
      btn.setAttribute('aria-label', `Mesa ${numero}: ${status.label}`);
    });
  }

  function garantirBanner() {
    let banner = document.getElementById('garcom-production-banner');
    if (banner) return banner;
    const tela = document.getElementById('tela-pedido');
    if (!tela) return null;
    banner = document.createElement('div');
    banner.id = 'garcom-production-banner';
    banner.className = 'garcom-production-banner';
    banner.style.display = 'none';
    tela.prepend(banner);
    return banner;
  }

  function atualizarBannerMesa() {
    const banner = garantirBanner();
    if (!banner || !mesaSelecionada) {
      if (banner) banner.style.display = 'none';
      return;
    }
    const status = statusMesa(mesaSelecionada);
    if (!status) {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'flex';
    banner.className = `garcom-production-banner ${status.cls}`;
    banner.innerHTML = `
      <div class="garcom-production-banner__info">
        <strong>${status.icon} ${status.label}</strong>
        <span>${status.pedidos.length} pedido(s) · ${textoTempo(status.tempo)}</span>
      </div>
      ${status.cls === 'production-ready' ? `<button onclick="marcarPedidosEntreguesGarcom(${mesaSelecionada})">🍽️ Marcar entregue</button>` : ''}`;
  }

  function mostrarAvisoPronto(pedidosNovos) {
    if (!pedidosNovos.length) return;
    let toast = document.getElementById('garcom-production-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'garcom-production-toast';
      toast.className = 'garcom-production-toast';
      document.body.appendChild(toast);
    }
    const mesasProntas = [...new Set(pedidosNovos.map(([,p]) => p.mesa))];
    toast.innerHTML = `<strong>✅ Pedido pronto!</strong><span>Mesa${mesasProntas.length > 1 ? 's' : ''} ${mesasProntas.join(', ')}</span>`;
    toast.classList.add('show');
    try { if (navigator.vibrate) navigator.vibrate([180,90,180]); } catch (_) {}
    setTimeout(() => toast.classList.remove('show'), 6500);
  }

  window.marcarPedidosEntreguesGarcom = async function marcarPedidosEntreguesGarcom(numero) {
    const prontos = ativosMesa(numero).filter(([,p]) => p.status === 'pronto');
    if (!prontos.length) return;
    const ts = Date.now();
    const updates = {};
    prontos.forEach(([chave]) => {
      updates[`pedidosProducao/${chave}/status`] = 'entregue';
      updates[`pedidosProducao/${chave}/entregueEm`] = ts;
      updates[`pedidosProducao/${chave}/atualizadoEm`] = ts;
    });
    const banner = garantirBanner();
    const botao = banner?.querySelector('button');
    if (botao) { botao.disabled = true; botao.textContent = 'Confirmando...'; }
    try {
      await db.ref('/').update(updates);
      if (typeof registrarAuditoriaGarcom === 'function') registrarAuditoriaGarcom('entregar_pedido', { mesa: numero, quantidade: prontos.length });
    } catch (erro) {
      console.error('Falha ao confirmar entrega:', erro);
      alert('Não foi possível confirmar a entrega. Confira a conexão e tente novamente.');
      if (botao) { botao.disabled = false; botao.textContent = '🍽️ Marcar entregue'; }
    }
  };

  // Preserva a renderização original e apenas acrescenta os estados de produção.
  const renderOriginal = window.renderizarMesasG;
  if (typeof renderOriginal === 'function') {
    window.renderizarMesasG = function renderizarMesasComProducao() {
      const retorno = renderOriginal.apply(this, arguments);
      setTimeout(decorarMesas, 0);
      return retorno;
    };
  }

  const selecionarOriginal = window.selecionarMesaG;
  if (typeof selecionarOriginal === 'function') {
    window.selecionarMesaG = function selecionarMesaComStatus(numero) {
      const retorno = selecionarOriginal.apply(this, arguments);
      setTimeout(atualizarBannerMesa, 0);
      return retorno;
    };
  }

  const voltarOriginal = window.voltarParaMesas;
  if (typeof voltarOriginal === 'function') {
    window.voltarParaMesas = function voltarComStatus() {
      const retorno = voltarOriginal.apply(this, arguments);
      setTimeout(decorarMesas, 0);
      atualizarBannerMesa();
      return retorno;
    };
  }

  db.ref('pedidosProducao').on('value', snap => {
    const novoCache = {};
    snap.forEach(child => { novoCache[child.key] = child.val() || {}; });
    const prontosAgora = new Set(Object.entries(novoCache).filter(([,p]) => p.status === 'pronto').map(([chave]) => chave));
    if (producaoInicialCarregada) {
      const novos = Object.entries(novoCache).filter(([chave,p]) => p.status === 'pronto' && !prontosConhecidos.has(chave));
      mostrarAvisoPronto(novos);
    }
    Object.keys(pedidosGarcom).forEach(chave => delete pedidosGarcom[chave]);
    Object.assign(pedidosGarcom, novoCache);
    prontosConhecidos = prontosAgora;
    producaoInicialCarregada = true;
    decorarMesas();
    atualizarBannerMesa();
  });

  setInterval(() => {
    decorarMesas();
    atualizarBannerMesa();
  }, 30000);
})();
