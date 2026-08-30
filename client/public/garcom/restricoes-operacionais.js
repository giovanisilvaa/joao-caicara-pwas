/* Restrições operacionais do Garçom — ajustes antes do envio são permitidos; cancelamentos após envio e limpeza ficam exclusivos do PDV. */
(() => {
  if (window.GARCOM_RESTRICOES_RUNTIME === 'v2') return;
  window.GARCOM_RESTRICOES_RUNTIME = 'v2';

  const MENSAGEM_CANCELAMENTO = 'Depois de enviado à produção, a redução ou o cancelamento do item deve ser feito pelo caixa/PDV.';
  const MENSAGEM_LIMPEZA = 'Limpar mesa é uma operação exclusiva do caixa/PDV.';

  function instalarEstilo() {
    if (document.getElementById('garcom-restricoes-style')) return;
    const style = document.createElement('style');
    style.id = 'garcom-restricoes-style';
    style.textContent = `
      .btn-limpar-g{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function numeroAtual() {
    try { return typeof mesaSelecionada !== 'undefined' ? mesaSelecionada : null; } catch (_) { return null; }
  }

  function itemAtual(index) {
    try {
      const numero = numeroAtual();
      return numero ? mesas?.[numero]?.itens?.[index] || null : null;
    } catch (_) {
      return null;
    }
  }

  function instalarAjustesDeRascunho() {
    const alterarOriginal = window.alterarQtdG;
    if (typeof alterarOriginal === 'function' && !alterarOriginal.__restricaoGarcomV2) {
      const protegida = async function(index, delta, ...rest) {
        const item = itemAtual(index);
        if (Number(delta) < 0 && item?.enviado === true) {
          alert(MENSAGEM_CANCELAMENTO);
          return false;
        }
        return alterarOriginal.call(this, index, delta, ...rest);
      };
      protegida.__restricaoGarcomV2 = true;
      protegida.__original = alterarOriginal;
      window.alterarQtdG = protegida;
    }

    const adicionarOriginal = window.adicionarItemG;
    if (typeof adicionarOriginal === 'function' && !adicionarOriginal.__mesclarRascunhoGarcomV2) {
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
      adicionarProtegido.__mesclarRascunhoGarcomV2 = true;
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

  function iniciar() {
    instalarEstilo();
    instalarAjustesDeRascunho();
    bloquearLimpeza();
  }

  iniciar();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  window.addEventListener('load', iniciar);

  window.GarcomRestricoesOperacionais = Object.freeze({
    runtime: 'v2',
    podeReduzirAntesEnvio: true,
    podeSomarMesmoItemAntesEnvio: true,
    podeCancelarItemEnviado: false,
    podeLimparMesa: false
  });
})();
