/* Restrições operacionais do Garçom — ajustes antes do envio são permitidos; cancelamentos após envio, limpeza e finalização financeira ficam exclusivos do PDV. */
(() => {
  if (window.GARCOM_RESTRICOES_RUNTIME === 'v3') return;
  window.GARCOM_RESTRICOES_RUNTIME = 'v3';

  const MENSAGEM_CANCELAMENTO = 'Depois de enviado à produção, a redução ou o cancelamento do item deve ser feito pelo caixa/PDV.';
  const MENSAGEM_LIMPEZA = 'Limpar mesa é uma operação exclusiva do caixa/PDV.';
  const MENSAGEM_FINALIZACAO = 'O garçom pode fechar a mesa, mas somente o caixa/PDV pode finalizar o pagamento e liberar a mesa.';
  const MENSAGEM_AGUARDANDO_PDV = 'Esta mesa já está fechada e aguardando pagamento. Somente o caixa/PDV pode finalizar a conta e liberar a mesa.';

  function instalarEstilo() {
    if (document.getElementById('garcom-restricoes-style')) return;
    const style = document.createElement('style');
    style.id = 'garcom-restricoes-style';
    style.textContent = `
      .btn-limpar-g{display:none!important}
      .staged-finalize{display:none!important}
      .btn-fechar-g.staged-pending{font-size:0!important}
      .btn-fechar-g.staged-pending::after{content:'AGUARDANDO PDV';font-size:.78rem;font-weight:800}
      .garcom-pdv-only-note{display:block;margin-top:7px;font-size:.76rem;font-weight:800;color:#74420c}
    `;
    document.head.appendChild(style);
  }

  function numeroAtual() {
    try { return typeof mesaSelecionada !== 'undefined' ? mesaSelecionada : null; } catch (_) { return null; }
  }

  function mesaAtual() {
    try {
      const numero = numeroAtual();
      return numero ? mesas?.[numero] || null : null;
    } catch (_) {
      return null;
    }
  }

  function itemAtual(index) {
    try {
      const numero = numeroAtual();
      return numero ? mesas?.[numero]?.itens?.[index] || null : null;
    } catch (_) {
      return null;
    }
  }

  function contaAguardandoPagamento() {
    return mesaAtual()?.estadoConta === 'aguardando_pagamento';
  }

  function instalarAjustesDeRascunho() {
    const alterarOriginal = window.alterarQtdG;
    if (typeof alterarOriginal === 'function' && !alterarOriginal.__restricaoGarcomV3) {
      const protegida = async function(index, delta, ...rest) {
        const item = itemAtual(index);
        if (Number(delta) < 0 && item?.enviado === true) {
          alert(MENSAGEM_CANCELAMENTO);
          return false;
        }
        return alterarOriginal.call(this, index, delta, ...rest);
      };
      protegida.__restricaoGarcomV3 = true;
      protegida.__original = alterarOriginal;
      window.alterarQtdG = protegida;
    }

    const adicionarOriginal = window.adicionarItemG;
    if (typeof adicionarOriginal === 'function' && !adicionarOriginal.__mesclarRascunhoGarcomV3) {
      const adicionarProtegido = async function(produtoId, ...rest) {
        try {
          const numero = numeroAtual();
          const mesa = numero ? mesas?.[numero] : null;
          const produto = typeof produtos !== 'undefined' ? produtos.find(p => p.id === produtoId) : null;
          if (mesa && produto && Array.isArray(mesa.itens)) {
            const index = mesa.itens.findIndex(item =>
              item &&
              item.id === produtoId &&
              Number(item.preco) === Number(produto.preco) &&
              !item.obs &&
              item.enviado !== true &&
              !item.envioPendenteId
            );
            if (index >= 0 && typeof window.alterarQtdG === 'function') {
              return window.alterarQtdG(index, 1);
            }
          }
        } catch (_) {}
        return adicionarOriginal.call(this, produtoId, ...rest);
      };
      adicionarProtegido.__mesclarRascunhoGarcomV3 = true;
      adicionarProtegido.__original = adicionarOriginal;
      window.adicionarItemG = adicionarProtegido;
    }
  }

  function bloquearLimpeza() {
    const limparOriginal = window.limparComandaG;
    if (typeof limparOriginal === 'function' && !limparOriginal.__bloqueadaNoGarcom) {
      const protegidaLimpeza = function() {
        alert(MENSAGEM_LIMPEZA);
        return false;
      };
      protegidaLimpeza.__bloqueadaNoGarcom = true;
      protegidaLimpeza.__original = limparOriginal;
      window.limparComandaG = protegidaLimpeza;
    }
  }

  function instalarFechamentoSomenteOperacional() {
    const fecharAtual = window.abrirFechamentoG;
    if (typeof fecharAtual === 'function' && !fecharAtual.__fechamentoSomentePdvV3) {
      const fecharMesa = function(...args) {
        if (contaAguardandoPagamento()) {
          alert(MENSAGEM_AGUARDANDO_PDV);
          return false;
        }
        const staged = window.StagedCheckout;
        if (!staged || typeof staged.fecharParaConferencia !== 'function') {
          alert('A proteção do fechamento ainda está carregando. Aguarde um instante e tente novamente.');
          return false;
        }
        return staged.fecharParaConferencia.apply(this, args);
      };
      fecharMesa.__fechamentoSomentePdvV3 = true;
      fecharMesa.__original = fecharAtual;
      window.abrirFechamentoG = fecharMesa;
    }

    const finalizarAtual = window.confirmarFechamentoG;
    if (typeof finalizarAtual === 'function' && !finalizarAtual.__finalizacaoBloqueadaGarcomV3) {
      const bloquearFinalizacao = function() {
        alert(MENSAGEM_FINALIZACAO);
        return false;
      };
      bloquearFinalizacao.__finalizacaoBloqueadaGarcomV3 = true;
      bloquearFinalizacao.__original = finalizarAtual;
      window.confirmarFechamentoG = bloquearFinalizacao;
    }
  }

  function reforcarInterfaceFechamento() {
    const banner = document.getElementById('staged-account-banner');
    if (!banner || !contaAguardandoPagamento()) return;
    const acoes = banner.querySelector('.staged-account-actions');
    if (!acoes) return;
    let nota = banner.querySelector('.garcom-pdv-only-note');
    if (!nota) {
      nota = document.createElement('span');
      nota.className = 'garcom-pdv-only-note';
      acoes.parentNode?.insertBefore(nota, acoes);
    }
    nota.textContent = 'Pagamento e liberação da mesa: somente no PDV.';
  }

  function iniciar() {
    instalarEstilo();
    instalarAjustesDeRascunho();
    bloquearLimpeza();
    instalarFechamentoSomenteOperacional();
    reforcarInterfaceFechamento();
  }

  iniciar();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  window.addEventListener('load', iniciar);
  const observer = new MutationObserver(() => reforcarInterfaceFechamento());
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });

  window.GarcomRestricoesOperacionais = Object.freeze({
    runtime: 'v3',
    podeReduzirAntesEnvio: true,
    podeSomarMesmoItemAntesEnvio: true,
    podeCancelarItemEnviado: false,
    podeLimparMesa: false,
    podeFecharMesa: true,
    podeFinalizarPagamento: false,
    finalizacaoExclusivaPdv: true
  });
})();
