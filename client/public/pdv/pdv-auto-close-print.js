/* Impressão automática do fechamento feito pelo Garçom no PDV do caixa. */
(() => {
  if (window.PDV_AUTO_CLOSE_RUNTIME === 'v1') return;
  window.PDV_AUTO_CLOSE_RUNTIME = 'v1';

  const EMAIL_PDV = 'adm@acesso.joaocaicara.app';
  const CHECKPOINT_KEY = 'joao_caicara_auto_close_activation_v1';
  const RECLAIM_MS = 120000;
  const sessao = `pdv-close_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const fila = [];
  const emFila = new Set();
  const conhecidos = new Set();
  let processando = false;
  let refVendas = null;
  let onChildAdded = null;
  let conectadoUid = null;

  let ativadoEm = Number(localStorage.getItem(CHECKPOINT_KEY) || 0);
  if (!ativadoEm) {
    ativadoEm = Date.now();
    try { localStorage.setItem(CHECKPOINT_KEY, String(ativadoEm)); } catch (_) {}
  }

  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caractere]));

  const moeda = valor => {
    if (typeof formatarMoeda === 'function') return formatarMoeda(Number(valor) || 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
  };

  function vendaPendente(venda) {
    if (!venda || venda.origem !== 'garcom') return false;
    if (!Array.isArray(venda.itens) || !venda.itens.length) return false;
    if (!(Number(venda.total) >= 0)) return false;
    return venda.impressaoFechamentoPdv?.estado !== 'impresso' && !venda.fechamentoImpressoNoPdv;
  }

  function reivindicar(chave) {
    const ref = db.ref(`vendas/${chave}/impressaoFechamentoPdv`);
    return new Promise((resolve, reject) => {
      ref.transaction(atual => {
        const agora = Date.now();
        if (atual?.estado === 'impresso') return;
        if (atual?.estado === 'processando' && agora - Number(atual.iniciadoEm || 0) < RECLAIM_MS) return;
        return { estado: 'processando', sessao, iniciadoEm: agora };
      }, (erro, committed) => {
        if (erro) return reject(erro);
        resolve(Boolean(committed));
      }, false);
    });
  }

  function prepararCupom(venda) {
    const pagamentos = venda.pagamentos && typeof venda.pagamentos === 'object' ? venda.pagamentos : {};
    const garcomResponsavel = venda.garcomResponsavel && typeof venda.garcomResponsavel === 'object'
      ? venda.garcomResponsavel
      : null;
    const atendentes = Array.isArray(venda.garconsAtendimento) ? venda.garconsAtendimento.filter(Boolean) : [];
    const data = venda.dataHora || new Date(Number(venda.criadoEm) || Date.now()).toLocaleString('pt-BR');

    let detalhe = '';
    if (garcomResponsavel?.nome) detalhe += `Mesa aberta por: ${escapar(garcomResponsavel.nome)}<br>`;
    if (atendentes.length) detalhe += `Atendida por: ${atendentes.map(item => escapar(item?.nome || '')).filter(Boolean).join(', ')}<br>`;
    if (Number(pagamentos.dinheiro) > 0) detalhe += `Dinheiro: ${moeda(pagamentos.dinheiro)}<br>`;
    if (Number(pagamentos.pix) > 0) detalhe += `PIX: ${moeda(pagamentos.pix)}<br>`;
    if (Number(pagamentos.credito) > 0) detalhe += `Crédito: ${moeda(pagamentos.credito)}<br>`;
    if (Number(pagamentos.debito) > 0) detalhe += `Débito: ${moeda(pagamentos.debito)}<br>`;
    if (Number(venda.troco) > 0.01) detalhe += `Troco dado: ${moeda(venda.troco)}`;

    const mesaEl = document.getElementById('caixa-mesa');
    const clienteEl = document.getElementById('caixa-cliente');
    const dataEl = document.getElementById('caixa-data');
    const detalheEl = document.getElementById('caixa-detalhe-pgto');
    const subtotalEl = document.getElementById('caixa-subtotal-valor');
    const linhaTaxa = document.getElementById('caixa-linha-taxa');
    const taxaEl = document.getElementById('caixa-taxa-valor');
    const totalEl = document.getElementById('caixa-total-valor');
    const itensEl = document.getElementById('caixa-itens');

    if (!mesaEl || !clienteEl || !dataEl || !detalheEl || !subtotalEl || !linhaTaxa || !taxaEl || !totalEl || !itensEl) {
      throw new Error('Estrutura do cupom de fechamento não está disponível no PDV.');
    }

    mesaEl.innerText = venda.mesa ?? '-';
    clienteEl.innerText = venda.cliente || 'Não informado';
    dataEl.innerText = data;
    detalheEl.innerHTML = detalhe;
    subtotalEl.innerText = moeda(venda.subtotal);
    linhaTaxa.style.display = Number(venda.taxa) > 0 ? 'flex' : 'none';
    taxaEl.innerText = moeda(venda.taxa);
    totalEl.innerText = moeda(venda.total);
    itensEl.innerHTML = venda.itens.map(item => {
      const qtd = Number(item.qtd) || 0;
      const preco = Number(item.preco) || 0;
      return `<div class="t-item"><span class="t-item-name">${qtd}x ${escapar(item.nome)}</span><span>${moeda(qtd * preco)}</span></div>`;
    }).join('');
  }

  async function aguardarProducaoLivre() {
    const inicio = Date.now();
    while (
      document.body.classList.contains('print-mode-producao') ||
      document.body.classList.contains('print-mode-producao-lote')
    ) {
      if (Date.now() - inicio > 15000) break;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  async function imprimirFechamento(chave, venda) {
    const assumiu = await reivindicar(chave);
    if (!assumiu) return;

    try {
      await aguardarProducaoLivre();
      prepararCupom(venda);
      document.body.classList.add('print-mode-caixa');
      try {
        window.print();
      } finally {
        document.body.classList.remove('print-mode-caixa');
      }

      const agora = Date.now();
      await db.ref(`vendas/${chave}`).update({
        fechamentoImpressoNoPdv: true,
        fechamentoImpressoEm: agora,
        impressaoFechamentoPdv: {
          estado: 'impresso',
          sessao,
          iniciadoEm: agora,
          concluidoEm: agora
        }
      });

      try {
        if (typeof registrarAuditoriaPdv === 'function') {
          await Promise.resolve(registrarAuditoriaPdv('imprimir_fechamento_garcom_automatico', {
            venda: chave,
            mesa: venda.mesa,
            total: Number(venda.total) || 0
          }));
        }
      } catch (_) {}
    } catch (erro) {
      try {
        await db.ref(`vendas/${chave}/impressaoFechamentoPdv`).update({
          estado: 'falha', sessao, falhouEm: Date.now()
        });
      } catch (_) {}
      throw erro;
    }
  }

  async function processarFila() {
    if (processando) return;
    processando = true;
    try {
      while (fila.length) {
        const registro = fila.shift();
        try {
          await imprimirFechamento(registro.chave, registro.venda);
        } catch (erro) {
          console.error('Falha ao imprimir fechamento do Garçom no PDV:', erro);
        } finally {
          emFila.delete(registro.chave);
        }
      }
    } finally {
      processando = false;
      if (fila.length) setTimeout(processarFila, 300);
    }
  }

  function enfileirar(chave, venda) {
    if (!vendaPendente(venda) || emFila.has(chave)) return;
    emFila.add(chave);
    fila.push({ chave, venda });
    processarFila();
  }

  function desconectar() {
    if (refVendas && onChildAdded) {
      try { refVendas.off('child_added', onChildAdded); } catch (_) {}
    }
    refVendas = null;
    onChildAdded = null;
    conectadoUid = null;
    conhecidos.clear();
  }

  async function conectar(user) {
    const email = String(user?.email || '').toLowerCase();
    if (!user || email !== EMAIL_PDV) return desconectar();
    if (conectadoUid === user.uid && refVendas && onChildAdded) return;

    desconectar();
    conectadoUid = user.uid;
    refVendas = db.ref('vendas');

    const inicial = await refVendas.once('value');
    inicial.forEach(child => {
      conhecidos.add(child.key);
      const venda = child.val() || {};
      if (vendaPendente(venda) && Number(venda.criadoEm || 0) >= ativadoEm) {
        enfileirar(child.key, venda);
      }
    });

    onChildAdded = snap => {
      const chave = snap.key;
      const venda = snap.val() || {};
      if (conhecidos.has(chave)) return;
      conhecidos.add(chave);
      enfileirar(chave, venda);
    };
    refVendas.on('child_added', onChildAdded, erro => console.error('Falha na fila de fechamento automático:', erro));
  }

  function iniciar() {
    if (typeof firebase === 'undefined' || typeof db === 'undefined' || !db) return;
    firebase.auth().onAuthStateChanged(user => {
      conectar(user).catch(erro => console.error('Falha ao conectar impressão automática de fechamento:', erro));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.PdvFechamentoAutomatico = Object.freeze({ enfileirar, processarFila, reconectar: () => conectar(firebase.auth().currentUser), desconectar });
})();
