/* Painel administrativo externo — somente leitura. */
(() => {
  if (!location.pathname.startsWith('/gestao/')) return;
  if (window.GESTAO_JOAO_CAICARA_RUNTIME === 'v1') return;
  window.GESTAO_JOAO_CAICARA_RUNTIME = 'v1';

  const EMAIL_ADMIN = 'adm@acesso.joaocaicara.app';
  const AUTO_LOCK_MS = 10 * 60 * 1000;
  const numero = valor => Number(valor) || 0;
  const pad = valor => String(valor).padStart(2, '0');
  const moeda = valor => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero(valor));
  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caractere]));
  const normalizarNome = nome => String(nome || '').replace(/\s+/g, ' ').trim();
  const chaveNome = nome => normalizarNome(nome).toLocaleLowerCase('pt-BR');

  let vendas = [];
  let sessaoCaixaAtual = null;
  let conectado = false;
  let vendasRef = null;
  let sessaoRef = null;
  let timerBloqueio = null;
  let listenersAtivos = false;

  function auth() { return window.firebase?.auth?.(); }
  function db() { return window.firebase?.database?.(); }
  function usuarioEhAdmin(user) {
    return Boolean(user && !user.isAnonymous && String(user.email || '').toLowerCase() === EMAIL_ADMIN);
  }

  function chaveLocal(data) {
    const d = data instanceof Date ? data : new Date(data);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function chaveVenda(venda) {
    const criadoEm = Number(venda?.criadoEm);
    if (Number.isFinite(criadoEm) && criadoEm > 0) return chaveLocal(new Date(criadoEm));
    const texto = String(venda?.dataHora || '');
    const match = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return `${match[3]}-${pad(match[2])}-${pad(match[1])}`;
    return chaveLocal(texto);
  }

  function hoje() { return chaveLocal(new Date()); }
  function ontem() {
    const data = new Date();
    data.setDate(data.getDate() - 1);
    return chaveLocal(data);
  }
  function dataSelecionada() { return document.getElementById('gestao-data')?.value || hoje(); }
  function formatarData(chave) {
    const match = String(chave || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(chave || '');
  }
  function formatarHora(timestamp) {
    const valor = Number(timestamp);
    if (!Number.isFinite(valor) || valor <= 0) return '—';
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(valor));
  }
  function formatarDataHora(timestamp) {
    const valor = Number(timestamp);
    if (!Number.isFinite(valor) || valor <= 0) return '—';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));
  }

  function itensDaVenda(venda) {
    if (Array.isArray(venda?.itens)) return venda.itens.filter(Boolean);
    if (venda?.itens && typeof venda.itens === 'object') return Object.values(venda.itens).filter(Boolean);
    return [];
  }

  function vendasDaData(data = dataSelecionada()) {
    return vendas.filter(venda => chaveVenda(venda) === data);
  }

  function resumir(lista) {
    const resumo = lista.reduce((acc, venda) => {
      const pagamentos = venda?.pagamentos || {};
      const taxa = numero(venda?.taxa);
      const total = numero(venda?.total);
      const subtotalInformado = Number(venda?.subtotal);
      const subtotal = Number.isFinite(subtotalInformado) ? subtotalInformado : Math.max(0, total - taxa);
      acc.dinheiroRecebido += numero(pagamentos.dinheiro);
      acc.pix += numero(pagamentos.pix);
      acc.credito += numero(pagamentos.credito);
      acc.debito += numero(pagamentos.debito);
      acc.troco += numero(venda?.troco);
      acc.taxa += taxa;
      acc.subtotal += subtotal;
      acc.total += total;
      return acc;
    }, {
      dinheiroRecebido: 0,
      dinheiroLiquido: 0,
      pix: 0,
      credito: 0,
      debito: 0,
      troco: 0,
      taxa: 0,
      subtotal: 0,
      total: 0,
      ticketMedio: 0,
      quantidadeVendas: lista.length,
      diferencaPagamentos: 0
    });

    resumo.dinheiroLiquido = resumo.dinheiroRecebido - resumo.troco;
    resumo.ticketMedio = resumo.quantidadeVendas ? resumo.total / resumo.quantidadeVendas : 0;
    const pagamentosLiquidos = resumo.dinheiroRecebido + resumo.pix + resumo.credito + resumo.debito - resumo.troco;
    resumo.diferencaPagamentos = pagamentosLiquidos - resumo.total;
    return resumo;
  }

  function nomeFallbackVenda(venda) {
    const atendentes = Array.isArray(venda?.garconsAtendimento)
      ? venda.garconsAtendimento
      : (venda?.garconsAtendimento && typeof venda.garconsAtendimento === 'object'
        ? Object.values(venda.garconsAtendimento)
        : []);
    return normalizarNome(
      venda?.garcomResponsavel?.nome ||
      venda?.garcomNome ||
      atendentes[0]?.nome ||
      'Não identificado'
    ) || 'Não identificado';
  }

  function resumoGarcons(lista) {
    const mapa = new Map();
    function obter(nome) {
      const limpo = normalizarNome(nome) || 'Não identificado';
      const chave = chaveNome(limpo) || 'nao-identificado';
      if (!mapa.has(chave)) {
        mapa.set(chave, { nome: limpo, vendido: 0, servico: 0, itens: 0, mesas: new Set(), vendas: new Set() });
      }
      return mapa.get(chave);
    }

    lista.forEach((venda, indiceVenda) => {
      const itens = itensDaVenda(venda);
      const fallback = nomeFallbackVenda(venda);
      const vendaId = String(venda?.id || `${venda?.mesa || 'mesa'}-${venda?.criadoEm || indiceVenda}`);
      const mesa = String(venda?.mesa || '');
      const taxa = Math.max(0, numero(venda?.taxa));
      const contribuicoes = new Map();
      let somaItens = 0;

      itens.forEach(item => {
        const nome = normalizarNome(item?.garcomLancamento?.nome) || fallback;
        const qtd = Math.max(0, numero(item?.qtd));
        const valor = qtd * numero(item?.preco);
        somaItens += valor;
        const chave = chaveNome(nome) || 'nao-identificado';
        const atual = contribuicoes.get(chave) || { nome, valor: 0, itens: 0 };
        atual.valor += valor;
        atual.itens += qtd;
        contribuicoes.set(chave, atual);
      });

      const subtotalInformado = Number(venda?.subtotal);
      if (Number.isFinite(subtotalInformado) && subtotalInformado > somaItens + 0.01) {
        const diferenca = subtotalInformado - somaItens;
        const chave = chaveNome(fallback) || 'nao-identificado';
        const atual = contribuicoes.get(chave) || { nome: fallback, valor: 0, itens: 0 };
        atual.valor += diferenca;
        contribuicoes.set(chave, atual);
        somaItens += diferenca;
      }

      if (!contribuicoes.size) {
        const subtotal = Number.isFinite(subtotalInformado)
          ? Math.max(0, subtotalInformado)
          : Math.max(0, numero(venda?.total) - taxa);
        contribuicoes.set(chaveNome(fallback) || 'nao-identificado', { nome: fallback, valor: subtotal, itens: 0 });
      }

      const baseRateio = [...contribuicoes.values()].reduce((soma, item) => soma + Math.max(0, item.valor), 0);
      contribuicoes.forEach(contribuicao => {
        const linha = obter(contribuicao.nome);
        linha.vendido += contribuicao.valor;
        linha.itens += contribuicao.itens;
        if (mesa) linha.mesas.add(mesa);
        linha.vendas.add(vendaId);
        if (taxa > 0 && baseRateio > 0) linha.servico += taxa * (Math.max(0, contribuicao.valor) / baseRateio);
      });
    });

    return [...mapa.values()]
      .map(linha => ({ nome: linha.nome, vendido: linha.vendido, servico: linha.servico, itens: linha.itens, mesas: linha.mesas.size, vendas: linha.vendas.size }))
      .sort((a, b) => b.vendido - a.vendido || a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function setTexto(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  }

  function renderizarResumo(lista) {
    const resumo = resumir(lista);
    setTexto('kpi-total', moeda(resumo.total));
    setTexto('kpi-vendas', String(resumo.quantidadeVendas));
    setTexto('kpi-ticket', moeda(resumo.ticketMedio));
    setTexto('kpi-subtotal', moeda(resumo.subtotal));
    setTexto('kpi-taxa', moeda(resumo.taxa));
    setTexto('pay-dinheiro', moeda(resumo.dinheiroLiquido));
    setTexto('pay-dinheiro-recebido', moeda(resumo.dinheiroRecebido));
    setTexto('pay-pix', moeda(resumo.pix));
    setTexto('pay-credito', moeda(resumo.credito));
    setTexto('pay-debito', moeda(resumo.debito));
    setTexto('pay-troco', moeda(resumo.troco));
    const conf = document.getElementById('kpi-conferencia');
    if (conf) {
      const divergente = Math.abs(resumo.diferencaPagamentos) > 0.02;
      conf.textContent = divergente ? `Dif. ${moeda(resumo.diferencaPagamentos)}` : 'OK';
      conf.classList.toggle('alert', divergente);
    }
  }

  function renderizarGarcons(lista) {
    const linhas = resumoGarcons(lista);
    const body = document.getElementById('garcons-body');
    if (!body) return;
    setTexto('garcons-total', linhas.length ? `${linhas.length} atendente(s)` : 'Sem vendas');
    if (!linhas.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty-cell">Nenhuma venda encontrada nesta data.</td></tr>';
      return;
    }
    body.innerHTML = linhas.map(linha => `
      <tr>
        <td class="waiter-name">${escapar(linha.nome)}</td>
        <td class="num">${moeda(linha.vendido)}</td>
        <td class="num">${moeda(linha.servico)}</td>
        <td class="num">${linha.mesas}</td>
        <td class="num">${linha.itens}</td>
      </tr>`).join('');
  }

  function descricaoPagamento(venda) {
    const p = venda?.pagamentos || {};
    const partes = [];
    if (numero(p.dinheiro) > 0) partes.push('Dinheiro');
    if (numero(p.pix) > 0) partes.push('PIX');
    if (numero(p.credito) > 0) partes.push('Crédito');
    if (numero(p.debito) > 0) partes.push('Débito');
    return partes.join(' + ') || 'Pagamento não informado';
  }

  function renderizarVendasRecentes(lista) {
    const container = document.getElementById('vendas-recentes');
    if (!container) return;
    const ordenadas = lista.slice().sort((a, b) => numero(b?.criadoEm) - numero(a?.criadoEm));
    setTexto('vendas-lista-total', `${ordenadas.length} venda(s) em ${formatarData(dataSelecionada())}`);
    if (!ordenadas.length) {
      container.innerHTML = '<p class="empty-cell">Nenhuma venda encontrada nesta data.</p>';
      return;
    }
    container.innerHTML = ordenadas.slice(0, 20).map(venda => {
      const garcom = nomeFallbackVenda(venda);
      const hora = formatarHora(venda?.criadoEm);
      return `
        <article class="sale-card">
          <div class="sale-table">${escapar(venda?.mesa ?? '—')}</div>
          <div class="sale-main">
            <strong>Mesa ${escapar(venda?.mesa ?? '—')} · ${escapar(venda?.cliente || 'Cliente não informado')}</strong>
            <small>${escapar(garcom)} · ${escapar(descricaoPagamento(venda))}</small>
          </div>
          <div class="sale-total">${moeda(venda?.total)}<small>${escapar(hora)}</small></div>
        </article>`;
    }).join('');
  }

  function renderizarCaixa() {
    const container = document.getElementById('caixa-atual');
    if (!container) return;
    const sessao = sessaoCaixaAtual;
    if (!sessao || String(sessao.status || '').toLowerCase() !== 'aberto') {
      container.className = 'cash-state empty';
      container.textContent = 'Nenhuma sessão de caixa aberta neste momento.';
      return;
    }
    container.className = 'cash-state';
    container.innerHTML = `
      <div class="cash-row"><span>Status</span><strong>🟢 Aberto</strong></div>
      <div class="cash-row"><span>Código</span><strong>${escapar(sessao.codigo || sessao.id || '—')}</strong></div>
      <div class="cash-row"><span>Fundo inicial</span><strong>${moeda(sessao.fundoInicial)}</strong></div>
      <div class="cash-row"><span>Aberto em</span><strong>${escapar(formatarDataHora(sessao.abertoEm))}</strong></div>`;
  }

  function renderizarTudo() {
    const lista = vendasDaData();
    renderizarResumo(lista);
    renderizarGarcons(lista);
    renderizarVendasRecentes(lista);
    renderizarCaixa();
    setTexto('gestao-atualizado', `Atualizado às ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())}`);
  }

  function atualizarStatus(texto, tipo = '') {
    const el = document.getElementById('gestao-sync');
    if (!el) return;
    el.textContent = texto;
    el.classList.remove('ok', 'error');
    if (tipo) el.classList.add(tipo);
  }

  function dadosVendas(snapshot) {
    const valor = snapshot?.val?.();
    if (!valor || typeof valor !== 'object') return [];
    return Object.entries(valor).map(([id, venda]) => ({ ...(venda || {}), id })).filter(Boolean);
  }

  function desconectarLeituras() {
    if (vendasRef) vendasRef.off('value');
    if (sessaoRef) sessaoRef.off('value');
    vendasRef = null;
    sessaoRef = null;
    listenersAtivos = false;
    vendas = [];
    sessaoCaixaAtual = null;
  }

  function conectarLeituras() {
    if (listenersAtivos || !usuarioEhAdmin(auth()?.currentUser)) return;
    const database = db();
    if (!database) return;
    listenersAtivos = true;
    atualizarStatus('Sincronizando…');

    vendasRef = database.ref('vendas');
    vendasRef.on('value', snapshot => {
      vendas = dadosVendas(snapshot);
      conectado = true;
      atualizarStatus('🟢 Dados ao vivo', 'ok');
      renderizarTudo();
    }, erro => {
      console.error('Falha ao ler vendas na Gestão:', erro);
      conectado = false;
      atualizarStatus('🔴 Falha nas vendas', 'error');
    });

    sessaoRef = database.ref('sessoesCaixa/atual');
    sessaoRef.on('value', snapshot => {
      sessaoCaixaAtual = snapshot.val() || null;
      renderizarCaixa();
    }, erro => {
      console.error('Falha ao ler sessão do caixa na Gestão:', erro);
      sessaoCaixaAtual = null;
      renderizarCaixa();
    });
  }

  function mostrarApp() {
    document.getElementById('gestao-login')?.setAttribute('hidden', '');
    const app = document.getElementById('gestao-app');
    if (app) app.hidden = false;
    conectarLeituras();
    rearmarBloqueio();
  }

  function mostrarLogin(mensagem = '') {
    desconectarLeituras();
    const login = document.getElementById('gestao-login');
    login?.removeAttribute('hidden');
    const app = document.getElementById('gestao-app');
    if (app) app.hidden = true;
    const msg = document.getElementById('gestao-login-msg');
    if (msg) msg.textContent = mensagem;
    const senha = document.getElementById('gestao-login-password');
    if (senha) senha.value = '';
    setTimeout(() => senha?.focus(), 50);
  }

  function mensagemErroLogin(erro) {
    const codigo = String(erro?.code || '');
    if (codigo.includes('wrong-password') || codigo.includes('invalid-credential') || codigo.includes('invalid-login-credentials') || codigo.includes('user-not-found')) return 'Usuário ou senha incorretos.';
    if (codigo.includes('too-many-requests')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
    if (codigo.includes('network-request-failed')) return 'Sem conexão com o Firebase. Verifique a internet.';
    return `Não foi possível entrar (${codigo || 'erro de autenticação'}).`;
  }

  async function entrar() {
    const submit = document.getElementById('gestao-login-submit');
    const senhaEl = document.getElementById('gestao-login-password');
    const msg = document.getElementById('gestao-login-msg');
    const senha = String(senhaEl?.value || '');
    if (senha.length < 6) {
      if (msg) msg.textContent = 'Digite a senha administrativa.';
      senhaEl?.focus();
      return;
    }
    if (submit) { submit.disabled = true; submit.textContent = 'Entrando…'; }
    if (msg) msg.textContent = '';
    try {
      if (window.FirebaseAuthSessionIsolationReady?.then) await window.FirebaseAuthSessionIsolationReady;
      const firebaseAuth = auth();
      if (!firebaseAuth) throw new Error('Firebase Auth indisponível');
      const credencial = await firebaseAuth.signInWithEmailAndPassword(EMAIL_ADMIN, senha);
      if (!usuarioEhAdmin(credencial?.user)) {
        await firebaseAuth.signOut();
        throw new Error('Conta autenticada não é administrativa');
      }
      mostrarApp();
    } catch (erro) {
      console.warn('Falha no login da Gestão:', erro);
      if (msg) msg.textContent = mensagemErroLogin(erro);
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = 'Entrar'; }
    }
  }

  async function sair(motivo = '') {
    if (timerBloqueio) clearTimeout(timerBloqueio);
    timerBloqueio = null;
    desconectarLeituras();
    try { await auth()?.signOut?.(); } catch (_) {}
    mostrarLogin(motivo);
  }

  function rearmarBloqueio() {
    if (!usuarioEhAdmin(auth()?.currentUser)) return;
    if (timerBloqueio) clearTimeout(timerBloqueio);
    timerBloqueio = setTimeout(() => sair('Sessão bloqueada após 10 minutos sem uso.'), AUTO_LOCK_MS);
  }

  function instalarEventos() {
    document.getElementById('gestao-login-submit')?.addEventListener('click', entrar);
    document.getElementById('gestao-login-password')?.addEventListener('keydown', event => { if (event.key === 'Enter') entrar(); });
    document.getElementById('gestao-sair')?.addEventListener('click', () => sair());
    document.getElementById('gestao-data')?.addEventListener('change', renderizarTudo);
    document.getElementById('gestao-hoje')?.addEventListener('click', () => { document.getElementById('gestao-data').value = hoje(); renderizarTudo(); });
    document.getElementById('gestao-ontem')?.addEventListener('click', () => { document.getElementById('gestao-data').value = ontem(); renderizarTudo(); });
    document.getElementById('gestao-atualizar')?.addEventListener('click', () => { renderizarTudo(); atualizarStatus(conectado ? '🟢 Dados ao vivo' : 'Sincronizando…', conectado ? 'ok' : ''); });
    ['pointerdown', 'keydown', 'touchstart'].forEach(evento => document.addEventListener(evento, rearmarBloqueio, { passive: true }));
    window.addEventListener('online', () => atualizarStatus('Reconectando…'));
    window.addEventListener('offline', () => atualizarStatus('🔴 Sem internet', 'error'));
  }

  async function iniciar() {
    const data = document.getElementById('gestao-data');
    if (data) data.value = hoje();
    instalarEventos();
    if (window.FirebaseAuthSessionIsolationReady?.then) await window.FirebaseAuthSessionIsolationReady;
    const firebaseAuth = auth();
    if (!firebaseAuth || typeof firebaseAuth.onAuthStateChanged !== 'function') {
      mostrarLogin('Firebase Auth indisponível. Recarregue a página.');
      return;
    }
    firebaseAuth.onAuthStateChanged(user => {
      if (usuarioEhAdmin(user)) mostrarApp();
      else mostrarLogin();
    });
    if (usuarioEhAdmin(firebaseAuth.currentUser)) mostrarApp();
    else mostrarLogin();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.GestaoJoaoCaicara = Object.freeze({
    runtime: 'v1',
    resumir,
    resumoGarcons,
    chaveVenda,
    vendasDaData,
    renderizarTudo,
    get somenteLeitura() { return true; }
  });
})();
