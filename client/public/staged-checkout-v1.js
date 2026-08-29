/* Fechamento em duas etapas — preserva a mesa até a finalização do pagamento. */
(() => {
  if (window.STAGED_CHECKOUT_RUNTIME === 'v1') return;
  window.STAGED_CHECKOUT_RUNTIME = 'v1';

  const STATUS = 'aguardando_pagamento';
  const clone = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));
  const isGarcom = location.pathname.startsWith('/garcom/');
  const origem = isGarcom ? 'garcom' : 'pdv';
  const originals = {
    abrir: isGarcom ? window.abrirFechamentoG : window.abrirModalFechar,
    finalizar: isGarcom ? window.confirmarFechamentoG : window.imprimirCaixa
  };
  let interfaceAgendada = false;

  function numeroAtual() {
    try { return isGarcom ? mesaSelecionada : mesaAtualSelecionada; } catch (_) { return null; }
  }

  function mesaLocal(numero = numeroAtual()) {
    try { return numero != null && mesas ? mesas[numero] : null; } catch (_) { return null; }
  }

  function pendente(mesa) {
    return mesa?.estadoConta === STATUS;
  }

  function moeda(valor) {
    try { if (typeof formatarMoeda === 'function') return formatarMoeda(Number(valor) || 0); } catch (_) {}
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
  }

  function setTexto(elemento, texto) {
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
  }

  function taxaAtiva() {
    if (isGarcom) return window.GarcomTaxaServico?.ativa !== false;
    return true;
  }

  function totais(mesa, usarTaxa = taxaAtiva()) {
    const itens = Array.isArray(mesa?.itens) ? mesa.itens.filter(Boolean) : [];
    const subtotal = itens.reduce((soma, item) => soma + (Number(item?.preco) || 0) * (Number(item?.qtd) || 0), 0);
    const taxa = usarTaxa ? subtotal * 0.10 : 0;
    return { subtotal, taxa, total: subtotal + taxa, taxaAtiva: usarTaxa };
  }

  function atualizarLocal(numero, mesa) {
    try { mesas[numero] = clone(mesa); } catch (_) {}
    try {
      if (isGarcom) {
        renderizarComandaG();
        renderizarMesasG();
      } else {
        renderizarComanda();
        gerarMesas();
        atualizarPainelDiario();
      }
    } catch (_) {}
    agendarInterface();
  }

  function imprimirConferenciaPdv(numero, mesa, resumo) {
    if (isGarcom) return;
    const ids = ['caixa-mesa','caixa-cliente','caixa-data','caixa-detalhe-pgto','caixa-subtotal-valor','caixa-total-valor','caixa-itens'];
    if (!ids.every(id => document.getElementById(id))) return;
    try {
      setTexto(document.getElementById('caixa-mesa'), String(numero));
      setTexto(document.getElementById('caixa-cliente'), mesa.cliente || 'Não informado');
      setTexto(document.getElementById('caixa-data'), new Date().toLocaleString('pt-BR'));
      document.getElementById('caixa-detalhe-pgto').innerHTML = '<strong>CONTA PARA CONFERÊNCIA</strong><br>Pagamento ainda não finalizado.<br>A mesa continua ocupada.';
      setTexto(document.getElementById('caixa-subtotal-valor'), moeda(resumo.subtotal));
      const linhaTaxa = document.getElementById('caixa-linha-taxa');
      if (linhaTaxa) linhaTaxa.style.display = resumo.taxa > 0 ? 'flex' : 'none';
      setTexto(document.getElementById('caixa-taxa-valor'), moeda(resumo.taxa));
      setTexto(document.getElementById('caixa-total-valor'), moeda(resumo.total));
      document.getElementById('caixa-itens').innerHTML = (mesa.itens || []).map(item =>
        `<div class="t-item"><span class="t-item-name">${Number(item.qtd) || 0}x ${String(item.nome || '')}</span><span>${moeda((Number(item.preco) || 0) * (Number(item.qtd) || 0))}</span></div>`
      ).join('');
      document.body.classList.add('print-mode-caixa');
      try { window.print(); } finally { document.body.classList.remove('print-mode-caixa'); }
    } catch (erro) {
      console.warn('A conta foi fechada para conferência, mas a impressão não pôde ser iniciada:', erro);
    }
  }

  async function fecharParaConferencia() {
    const numero = numeroAtual();
    if (!numero || !window.MesaAtomic) return alert('Selecione uma mesa válida.');
    const atual = mesaLocal(numero);
    if (pendente(atual)) return abrirFinalizacao();
    if (!confirm(`Fechar a conta da Mesa ${numero} para conferência?\n\nA mesa continuará ocupada e poderá ser reaberta antes do pagamento.`)) return;

    let lock = null;
    try {
      lock = await window.MesaAtomic.bloquearMesa(numero, { tipo: 'fechar_conta_conferencia', origem });
      if (!lock.committed) return alert('A mesa está concluindo outra operação. Aguarde um instante e tente novamente.');
      const dados = window.MesaAtomic.normalizarMesa(lock.mesa);
      const resumo = totais(dados);
      if (resumo.subtotal <= 0) {
        await window.MesaAtomic.cancelarBloqueio(numero, lock.id, 'mesa_vazia');
        return alert('A comanda está vazia.');
      }
      if (pendente(dados)) {
        await window.MesaAtomic.cancelarBloqueio(numero, lock.id, 'conta_ja_fechada');
        atualizarLocal(numero, dados);
        return abrirFinalizacao();
      }

      const agora = Date.now();
      const final = clone(dados);
      final.estadoConta = STATUS;
      final.contaFechadaEm = agora;
      final.fechamentoPendente = {
        subtotal: resumo.subtotal,
        taxa: resumo.taxa,
        total: resumo.total,
        taxaAtiva: resumo.taxaAtiva,
        fechadoEm: agora,
        origem
      };
      window.MesaAtomic.marcarBloqueioInativo(final, lock.id, 'conta_fechada_para_conferencia');
      const auditRef = db.ref('auditoria').push();
      await db.ref('/').update({
        [`mesas/${numero}`]: final,
        [`auditoria/${auditRef.key}`]: {
          acao: 'fechar_conta_conferencia', mesa: Number(numero), origem,
          subtotal: resumo.subtotal, taxa: resumo.taxa, total: resumo.total, criadoEm: agora
        }
      });
      atualizarLocal(numero, final);
      imprimirConferenciaPdv(numero, final, resumo);
      alert(`Mesa ${numero}: conta fechada para conferência.\n\nA mesa NÃO foi liberada e a venda ainda NÃO foi registrada.`);
    } catch (erro) {
      console.error('Falha ao fechar conta para conferência:', erro);
      if (lock?.id) {
        try { await window.MesaAtomic.cancelarBloqueio(numero, lock.id, 'falha_fechar_conferencia'); } catch (_) {}
      }
      alert('Não foi possível fechar a conta para conferência. A mesa foi mantida como estava.');
    }
  }

  async function reabrirConta() {
    const numero = numeroAtual();
    if (!numero || !window.MesaAtomic) return;
    if (!pendente(mesaLocal(numero))) return alert('Esta conta não está fechada para conferência.');
    if (!confirm(`Reabrir a conta da Mesa ${numero}?\nOs lançamentos voltarão a ser permitidos.`)) return;

    let lock = null;
    try {
      lock = await window.MesaAtomic.bloquearMesa(numero, { tipo: 'reabrir_conta', origem });
      if (!lock.committed) return alert('A mesa está concluindo outra operação. Aguarde um instante e tente novamente.');
      const dados = window.MesaAtomic.normalizarMesa(lock.mesa);
      if (!pendente(dados)) {
        await window.MesaAtomic.cancelarBloqueio(numero, lock.id, 'conta_nao_fechada');
        atualizarLocal(numero, dados);
        return alert('A conta já foi reaberta em outro aparelho.');
      }
      const final = clone(dados);
      delete final.estadoConta;
      delete final.contaFechadaEm;
      delete final.fechamentoPendente;
      window.MesaAtomic.marcarBloqueioInativo(final, lock.id, 'conta_reaberta');
      const agora = Date.now();
      const auditRef = db.ref('auditoria').push();
      await db.ref('/').update({
        [`mesas/${numero}`]: final,
        [`auditoria/${auditRef.key}`]: { acao: 'reabrir_conta', mesa: Number(numero), origem, criadoEm: agora }
      });
      atualizarLocal(numero, final);
      alert(`Mesa ${numero} reaberta. A comanda pode ser ajustada novamente.`);
    } catch (erro) {
      console.error('Falha ao reabrir conta:', erro);
      if (lock?.id) {
        try { await window.MesaAtomic.cancelarBloqueio(numero, lock.id, 'falha_reabrir_conta'); } catch (_) {}
      }
      alert('Não foi possível reabrir a conta agora. Nenhum item foi alterado.');
    }
  }

  function abrirFinalizacao() {
    const numero = numeroAtual();
    if (!numero || !pendente(mesaLocal(numero))) return alert('Primeiro feche a conta para conferência.');
    if (typeof originals.abrir !== 'function') return alert('Tela de pagamento indisponível.');
    originals.abrir.call(window);
    setTimeout(() => {
      if (isGarcom) {
        const modal = document.getElementById('modal-fechar-g');
        const titulo = modal?.querySelector('h3,h2');
        setTexto(titulo, 'Finalizar pagamento e liberar mesa');
      } else {
        setTexto(document.getElementById('btn-confirmar-pagamento'), 'FINALIZAR PAGAMENTO E LIBERAR MESA');
      }
    }, 0);
  }

  async function finalizarProtegido(...args) {
    const numero = numeroAtual();
    if (!numero || !pendente(mesaLocal(numero))) {
      return alert('A venda só pode ser finalizada depois que a conta estiver fechada para conferência.');
    }
    if (typeof originals.finalizar !== 'function') return alert('Finalização de pagamento indisponível.');
    return originals.finalizar.apply(this, args);
  }

  function bloquearMutacao(nome, resolverNumero) {
    const original = window[nome];
    if (typeof original !== 'function') return;
    window[nome] = function (...args) {
      const numero = resolverNumero?.(...args) ?? numeroAtual();
      if (numero && pendente(mesaLocal(numero))) {
        alert('A conta está fechada e aguardando pagamento. Use “Reabrir conta” antes de alterar a comanda.');
        return;
      }
      return original.apply(this, args);
    };
  }

  function instalarProtecoes() {
    if (isGarcom) {
      ['adicionarItemG','alterarQtdG','editarObsG','limparComandaG','enviarProducaoG','atualizarNomeClienteG'].forEach(nome => bloquearMutacao(nome));
      window.abrirFechamentoG = fecharParaConferencia;
      window.confirmarFechamentoG = finalizarProtegido;
    } else {
      ['adicionarProduto','alterarQtdItem','editarObsItem','editarPrecoItem','limparMesa','transferirMesa','imprimirProducao','enviarProducaoCompletaPdv','atualizarNomeCliente'].forEach(nome => bloquearMutacao(nome));
      window.abrirModalFechar = fecharParaConferencia;
      window.imprimirCaixa = finalizarProtegido;
    }
  }

  function garantirEstilo() {
    if (document.getElementById('staged-checkout-style')) return;
    const style = document.createElement('style');
    style.id = 'staged-checkout-style';
    style.textContent = `
      .staged-account-banner{display:none;margin:8px 0;padding:10px;border:2px solid #d98b2b;border-radius:10px;background:#fff6e5;color:#74420c;font-weight:700;font-size:.84rem}
      .staged-account-banner.open{display:block}.staged-account-banner strong{display:block;margin-bottom:6px}
      .staged-account-actions{display:flex;gap:7px;flex-wrap:wrap}.staged-account-actions button{border:0;border-radius:7px;padding:8px 9px;font-weight:800;cursor:pointer;color:#fff}
      .staged-reopen{background:#457b9d}.staged-finalize{background:#2a9d8f}
      .btn-close.staged-pending,.btn-fechar-g.staged-pending{background:#d98b2b!important;color:#fff!important}
    `;
    document.head.appendChild(style);
  }

  function garantirBanner() {
    garantirEstilo();
    let banner = document.getElementById('staged-account-banner');
    if (banner) return banner;
    banner = document.createElement('div');
    banner.id = 'staged-account-banner';
    banner.className = 'staged-account-banner';
    banner.innerHTML = '<strong>🟠 CONTA FECHADA · AGUARDANDO PAGAMENTO</strong><span class="staged-account-text"></span><div class="staged-account-actions"><button type="button" class="staged-reopen">↩ Reabrir conta</button><button type="button" class="staged-finalize">✅ Finalizar pagamento</button></div>';
    banner.querySelector('.staged-reopen').onclick = reabrirConta;
    banner.querySelector('.staged-finalize').onclick = abrirFinalizacao;
    const alvo = isGarcom ? document.querySelector('.acoes-comanda-g') : document.querySelector('.order-footer');
    if (alvo) alvo.insertBefore(banner, alvo.firstChild);
    else document.body.appendChild(banner);
    return banner;
  }

  function atualizarInterface() {
    interfaceAgendada = false;
    const numero = numeroAtual();
    const mesa = mesaLocal(numero);
    const fechada = Boolean(numero && pendente(mesa));
    const banner = garantirBanner();
    banner.classList.toggle('open', fechada);
    if (fechada) {
      const resumo = mesa.fechamentoPendente || totais(mesa);
      const texto = `Mesa ${numero} · Total para conferência: ${moeda(resumo.total)}. A mesa continua ocupada e nenhum pagamento foi registrado ainda.`;
      setTexto(banner.querySelector('.staged-account-text'), texto);
    }
    const botao = isGarcom
      ? document.querySelector('.btn-fechar-g[onclick*="abrirFechamentoG"]')
      : document.querySelector('.btn-close[onclick*="abrirModalFechar"]');
    if (botao) {
      botao.classList.toggle('staged-pending', fechada);
      const rotulo = fechada ? 'FINALIZAR PAGAMENTO' : (isGarcom ? 'Fechar conta' : 'FECHAR CONTA (CONFERÊNCIA)');
      setTexto(botao, rotulo);
    }
  }

  function agendarInterface() {
    if (interfaceAgendada) return;
    interfaceAgendada = true;
    requestAnimationFrame(atualizarInterface);
  }

  instalarProtecoes();
  const observer = new MutationObserver(agendarInterface);
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', agendarInterface, { once: true });
  else agendarInterface();

  window.StagedCheckout = Object.freeze({ STATUS, pendente, fecharParaConferencia, reabrirConta, abrirFinalizacao, atualizarInterface: agendarInterface });
})();
