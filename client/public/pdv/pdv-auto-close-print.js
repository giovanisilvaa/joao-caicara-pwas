/* Impressão automática no PDV das contas fechadas pelo Garçom: conferência + fechamento final. */
(() => {
  if (window.PDV_AUTO_CLOSE_RUNTIME === 'v3') return;
  window.PDV_AUTO_CLOSE_RUNTIME = 'v3';

  const EMAIL_PDV = 'adm@acesso.joaocaicara.app';
  const STATUS_CONFERENCIA = 'aguardando_pagamento';
  const CHECKPOINT_KEY = 'joao_caicara_auto_close_activation_v3';
  const CONFERENCE_CHECKPOINT_KEY = 'joao_caicara_auto_conference_activation_v1';
  const RECLAIM_MS = 120000;
  const sessao = `pdv-close_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const fila = [];
  const emFila = new Set();
  const conhecidosVendas = new Set();
  let processando = false;
  let refVendas = null;
  let refMesas = null;
  let onVendaAdded = null;
  let onVendasValue = null;
  let onMesaChanged = null;
  let onMesasValue = null;
  let conectadoUid = null;

  function checkpoint(chave) {
    let valor = Number(localStorage.getItem(chave) || 0);
    if (!valor) {
      valor = Date.now();
      try { localStorage.setItem(chave, String(valor)); } catch (_) {}
    }
    return valor;
  }

  const ativadoEm = checkpoint(CHECKPOINT_KEY);
  const conferenciaAtivadaEm = checkpoint(CONFERENCE_CHECKPOINT_KEY);

  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caractere]));

  const moeda = valor => {
    if (typeof formatarMoeda === 'function') return formatarMoeda(Number(valor) || 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
  };

  function lista(valor) {
    if (Array.isArray(valor)) return valor.filter(Boolean);
    if (valor && typeof valor === 'object') return Object.values(valor).filter(Boolean);
    return [];
  }

  function normalizarVenda(venda) {
    const origem = venda && typeof venda === 'object' ? venda : {};
    return {
      ...origem,
      itens: lista(origem.itens),
      garconsAtendimento: lista(origem.garconsAtendimento)
    };
  }

  function normalizarMesa(mesa) {
    const origem = mesa && typeof mesa === 'object' ? mesa : {};
    return { ...origem, itens: lista(origem.itens) };
  }

  function vendaPendente(valor) {
    const venda = normalizarVenda(valor);
    const origemGarcom = String(venda.origem || '').toLowerCase() === 'garcom';
    const solicitada = venda.imprimirFechamentoNoPdv === true;
    if (!origemGarcom && !solicitada) return false;
    if (!venda.itens.length) return false;
    if (!Number.isFinite(Number(venda.total)) || Number(venda.total) < 0) return false;
    return venda.impressaoFechamentoPdv?.estado !== 'impresso' && !venda.fechamentoImpressoNoPdv;
  }

  function vendaAposAtivacao(venda) {
    const criadoEm = Number(venda?.criadoEm || 0);
    return criadoEm > 0 && criadoEm >= ativadoEm;
  }

  function mesaConferenciaPendente(valor) {
    const mesa = normalizarMesa(valor);
    const fechadoEm = Number(mesa.contaFechadaEm || mesa.fechamentoPendente?.fechadoEm || 0);
    const origemGarcom = String(mesa.fechamentoPendente?.origem || '').toLowerCase() === 'garcom';
    if (mesa.estadoConta !== STATUS_CONFERENCIA || !origemGarcom || !mesa.itens.length || fechadoEm <= 0) return false;
    const marca = mesa.impressaoConferenciaPdv;
    return !(marca?.estado === 'impresso' && Number(marca.contaFechadaEm || 0) === fechadoEm);
  }

  function conferenciaAposAtivacao(mesa) {
    const fechadoEm = Number(mesa?.contaFechadaEm || mesa?.fechamentoPendente?.fechadoEm || 0);
    return fechadoEm > 0 && fechadoEm >= conferenciaAtivadaEm;
  }

  function reivindicarVenda(chave) {
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

  function reivindicarConferencia(numero, fechadoEm) {
    const ref = db.ref(`mesas/${numero}`);
    return new Promise((resolve, reject) => {
      ref.transaction(atual => {
        if (!atual || atual.estadoConta !== STATUS_CONFERENCIA) return;
        const atualFechadoEm = Number(atual.contaFechadaEm || atual.fechamentoPendente?.fechadoEm || 0);
        if (atualFechadoEm !== Number(fechadoEm)) return;
        const marca = atual.impressaoConferenciaPdv;
        const agora = Date.now();
        if (marca?.estado === 'impresso' && Number(marca.contaFechadaEm || 0) === atualFechadoEm) return;
        if (marca?.estado === 'processando' && Number(marca.contaFechadaEm || 0) === atualFechadoEm && agora - Number(marca.iniciadoEm || 0) < RECLAIM_MS) return;
        return {
          ...atual,
          impressaoConferenciaPdv: { estado: 'processando', sessao, contaFechadaEm: atualFechadoEm, iniciadoEm: agora }
        };
      }, (erro, committed, snapshot) => {
        if (erro) return reject(erro);
        resolve({ committed: Boolean(committed), mesa: snapshot?.val() || null });
      }, false);
    });
  }

  function marcarConferencia(numero, fechadoEm, sucesso) {
    const ref = db.ref(`mesas/${numero}`);
    return new Promise((resolve, reject) => {
      ref.transaction(atual => {
        if (!atual || atual.estadoConta !== STATUS_CONFERENCIA) return;
        const atualFechadoEm = Number(atual.contaFechadaEm || atual.fechamentoPendente?.fechadoEm || 0);
        if (atualFechadoEm !== Number(fechadoEm)) return;
        const agora = Date.now();
        return {
          ...atual,
          impressaoConferenciaPdv: sucesso
            ? { estado: 'impresso', sessao, contaFechadaEm: atualFechadoEm, concluidoEm: agora }
            : { estado: 'falha', sessao, contaFechadaEm: atualFechadoEm, falhouEm: agora }
        };
      }, (erro, committed) => {
        if (erro) return reject(erro);
        resolve(Boolean(committed));
      }, false);
    });
  }

  function elementosCupom() {
    const ids = ['caixa-mesa','caixa-cliente','caixa-data','caixa-detalhe-pgto','caixa-subtotal-valor','caixa-linha-taxa','caixa-taxa-valor','caixa-total-valor','caixa-itens'];
    const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
    if (ids.some(id => !el[id])) throw new Error('Estrutura do cupom de caixa não está disponível no PDV.');
    return el;
  }

  function preencherItens(itens, alvo) {
    alvo.innerHTML = lista(itens).map(item => {
      const qtd = Number(item.qtd) || 0;
      const preco = Number(item.preco) || 0;
      return `<div class="t-item"><span class="t-item-name">${qtd}x ${escapar(item.nome)}</span><span>${moeda(qtd * preco)}</span></div>`;
    }).join('');
  }

  function prepararConferencia(numero, valor) {
    const mesa = normalizarMesa(valor);
    const resumo = mesa.fechamentoPendente || {};
    const subtotalCalculado = mesa.itens.reduce((soma, item) => soma + (Number(item.preco) || 0) * (Number(item.qtd) || 0), 0);
    const subtotal = Number.isFinite(Number(resumo.subtotal)) ? Number(resumo.subtotal) : subtotalCalculado;
    const taxa = Number.isFinite(Number(resumo.taxa)) ? Number(resumo.taxa) : 0;
    const total = Number.isFinite(Number(resumo.total)) ? Number(resumo.total) : subtotal + taxa;
    const fechadoEm = Number(mesa.contaFechadaEm || resumo.fechadoEm || Date.now());
    const el = elementosCupom();

    el['caixa-mesa'].innerText = numero ?? '-';
    el['caixa-cliente'].innerText = mesa.cliente || 'Não informado';
    el['caixa-data'].innerText = new Date(fechadoEm).toLocaleString('pt-BR');
    el['caixa-detalhe-pgto'].innerHTML = '<strong>CONTA PARA CONFERÊNCIA</strong><br>Pagamento ainda não finalizado.<br>A mesa continua ocupada.';
    el['caixa-subtotal-valor'].innerText = moeda(subtotal);
    el['caixa-linha-taxa'].style.display = taxa > 0 ? 'flex' : 'none';
    el['caixa-taxa-valor'].innerText = moeda(taxa);
    el['caixa-total-valor'].innerText = moeda(total);
    preencherItens(mesa.itens, el['caixa-itens']);
  }

  function prepararCupom(valor) {
    const venda = normalizarVenda(valor);
    const pagamentos = venda.pagamentos && typeof venda.pagamentos === 'object' ? venda.pagamentos : {};
    const garcomResponsavel = venda.garcomResponsavel && typeof venda.garcomResponsavel === 'object' ? venda.garcomResponsavel : null;
    const atendentes = venda.garconsAtendimento;
    const data = venda.dataHora || new Date(Number(venda.criadoEm) || Date.now()).toLocaleString('pt-BR');

    let detalhe = '<strong>CONTA FINALIZADA</strong><br>';
    if (garcomResponsavel?.nome) detalhe += `Mesa aberta por: ${escapar(garcomResponsavel.nome)}<br>`;
    if (atendentes.length) detalhe += `Atendida por: ${atendentes.map(item => escapar(item?.nome || '')).filter(Boolean).join(', ')}<br>`;
    if (Number(pagamentos.dinheiro) > 0) detalhe += `Dinheiro: ${moeda(pagamentos.dinheiro)}<br>`;
    if (Number(pagamentos.pix) > 0) detalhe += `PIX: ${moeda(pagamentos.pix)}<br>`;
    if (Number(pagamentos.credito) > 0) detalhe += `Crédito: ${moeda(pagamentos.credito)}<br>`;
    if (Number(pagamentos.debito) > 0) detalhe += `Débito: ${moeda(pagamentos.debito)}<br>`;
    if (Number(venda.troco) > 0.01) detalhe += `Troco dado: ${moeda(venda.troco)}`;

    const el = elementosCupom();
    el['caixa-mesa'].innerText = venda.mesa ?? '-';
    el['caixa-cliente'].innerText = venda.cliente || 'Não informado';
    el['caixa-data'].innerText = data;
    el['caixa-detalhe-pgto'].innerHTML = detalhe;
    el['caixa-subtotal-valor'].innerText = moeda(venda.subtotal);
    el['caixa-linha-taxa'].style.display = Number(venda.taxa) > 0 ? 'flex' : 'none';
    el['caixa-taxa-valor'].innerText = moeda(venda.taxa);
    el['caixa-total-valor'].innerText = moeda(venda.total);
    preencherItens(venda.itens, el['caixa-itens']);
  }

  async function aguardarImpressaoLivre() {
    const inicio = Date.now();
    while (
      document.body.classList.contains('print-mode-producao') ||
      document.body.classList.contains('print-mode-producao-lote') ||
      document.body.classList.contains('print-mode-relatorio-garcons') ||
      document.body.classList.contains('print-mode-caixa')
    ) {
      if (Date.now() - inicio > 15000) break;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  async function imprimirConferencia(numero, valor) {
    const mesa = normalizarMesa(valor);
    const fechadoEm = Number(mesa.contaFechadaEm || mesa.fechamentoPendente?.fechadoEm || 0);
    const claim = await reivindicarConferencia(numero, fechadoEm);
    if (!claim.committed) return;

    try {
      await aguardarImpressaoLivre();
      prepararConferencia(numero, claim.mesa || mesa);
      document.body.classList.add('print-mode-caixa');
      try { window.print(); } finally { document.body.classList.remove('print-mode-caixa'); }
      await marcarConferencia(numero, fechadoEm, true);
      try {
        if (typeof registrarAuditoriaPdv === 'function') {
          await Promise.resolve(registrarAuditoriaPdv('imprimir_conferencia_garcom_automatico', { mesa: Number(numero), contaFechadaEm: fechadoEm }));
        }
      } catch (_) {}
    } catch (erro) {
      try { await marcarConferencia(numero, fechadoEm, false); } catch (_) {}
      throw erro;
    }
  }

  async function imprimirFechamento(chave, valor) {
    const venda = normalizarVenda(valor);
    const assumiu = await reivindicarVenda(chave);
    if (!assumiu) return;

    try {
      await aguardarImpressaoLivre();
      prepararCupom(venda);
      document.body.classList.add('print-mode-caixa');
      try { window.print(); } finally { document.body.classList.remove('print-mode-caixa'); }

      const agora = Date.now();
      await db.ref(`vendas/${chave}`).update({
        fechamentoImpressoNoPdv: true,
        fechamentoImpressoEm: agora,
        impressaoFechamentoPdv: { estado: 'impresso', sessao, iniciadoEm: agora, concluidoEm: agora }
      });

      try {
        if (typeof registrarAuditoriaPdv === 'function') {
          await Promise.resolve(registrarAuditoriaPdv('imprimir_fechamento_garcom_automatico', {
            venda: chave, mesa: venda.mesa, total: Number(venda.total) || 0
          }));
        }
      } catch (_) {}
    } catch (erro) {
      try { await db.ref(`vendas/${chave}/impressaoFechamentoPdv`).update({ estado: 'falha', sessao, falhouEm: Date.now() }); } catch (_) {}
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
          if (registro.tipo === 'conferencia') await imprimirConferencia(registro.numero, registro.mesa);
          else await imprimirFechamento(registro.chave, registro.venda);
        } catch (erro) {
          console.error(registro.tipo === 'conferencia' ? 'Falha ao imprimir conferência do Garçom no PDV:' : 'Falha ao imprimir fechamento do Garçom no PDV:', erro);
        } finally {
          emFila.delete(registro.filaKey);
        }
      }
    } finally {
      processando = false;
      if (fila.length) setTimeout(processarFila, 300);
    }
  }

  function enfileirarVenda(chave, valor) {
    const venda = normalizarVenda(valor);
    const filaKey = `venda:${chave}`;
    if (!chave || !vendaPendente(venda) || !vendaAposAtivacao(venda) || emFila.has(filaKey)) return;
    emFila.add(filaKey);
    fila.push({ tipo: 'final', filaKey, chave, venda });
    processarFila();
  }

  function enfileirarConferencia(numero, valor) {
    const mesa = normalizarMesa(valor);
    const fechadoEm = Number(mesa.contaFechadaEm || mesa.fechamentoPendente?.fechadoEm || 0);
    const filaKey = `conferencia:${numero}:${fechadoEm}`;
    if (!numero || !mesaConferenciaPendente(mesa) || !conferenciaAposAtivacao(mesa) || emFila.has(filaKey)) return;
    emFila.add(filaKey);
    fila.push({ tipo: 'conferencia', filaKey, numero, mesa });
    processarFila();
  }

  function varrerVendas(snapshot) {
    snapshot.forEach(child => {
      conhecidosVendas.add(child.key);
      enfileirarVenda(child.key, child.val() || {});
    });
  }

  function varrerMesas(snapshot) {
    snapshot.forEach(child => enfileirarConferencia(child.key, child.val() || {}));
  }

  function desconectar() {
    if (refVendas) {
      if (onVendaAdded) try { refVendas.off('child_added', onVendaAdded); } catch (_) {}
      if (onVendasValue) try { refVendas.off('value', onVendasValue); } catch (_) {}
    }
    if (refMesas) {
      if (onMesaChanged) try { refMesas.off('child_changed', onMesaChanged); } catch (_) {}
      if (onMesasValue) try { refMesas.off('value', onMesasValue); } catch (_) {}
    }
    refVendas = null;
    refMesas = null;
    onVendaAdded = null;
    onVendasValue = null;
    onMesaChanged = null;
    onMesasValue = null;
    conectadoUid = null;
    conhecidosVendas.clear();
  }

  async function conectar(user) {
    const email = String(user?.email || '').toLowerCase();
    if (!user || email !== EMAIL_PDV) return desconectar();
    if (conectadoUid === user.uid && refVendas && refMesas) return;

    desconectar();
    conectadoUid = user.uid;
    refVendas = db.ref('vendas');
    refMesas = db.ref('mesas');

    const [vendasIniciais, mesasIniciais] = await Promise.all([refVendas.once('value'), refMesas.once('value')]);
    varrerVendas(vendasIniciais);
    varrerMesas(mesasIniciais);

    onVendaAdded = snap => {
      const chave = snap.key;
      if (!conhecidosVendas.has(chave)) conhecidosVendas.add(chave);
      enfileirarVenda(chave, snap.val() || {});
    };
    onVendasValue = snap => varrerVendas(snap);
    onMesaChanged = snap => enfileirarConferencia(snap.key, snap.val() || {});
    onMesasValue = snap => varrerMesas(snap);

    refVendas.on('child_added', onVendaAdded, erro => console.error('Falha no evento de fechamento automático:', erro));
    refVendas.on('value', onVendasValue, erro => console.error('Falha na varredura de fechamentos do Garçom:', erro));
    refMesas.on('child_changed', onMesaChanged, erro => console.error('Falha no evento de conferência automática:', erro));
    refMesas.on('value', onMesasValue, erro => console.error('Falha na varredura de conferências do Garçom:', erro));
  }

  function iniciar() {
    if (typeof firebase === 'undefined' || typeof db === 'undefined' || !db) return;
    firebase.auth().onAuthStateChanged(user => {
      conectar(user).catch(erro => console.error('Falha ao conectar impressão automática de fechamento:', erro));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.PdvFechamentoAutomatico = Object.freeze({
    enfileirar: enfileirarVenda,
    enfileirarVenda,
    enfileirarConferencia,
    processarFila,
    reconectar: () => conectar(firebase.auth().currentUser),
    desconectar,
    normalizarVenda,
    normalizarMesa,
    vendaPendente,
    mesaConferenciaPendente
  });
})();
