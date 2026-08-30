/* Restrições operacionais do Garçom — cancelamento e limpeza ficam exclusivos do PDV. */
(() => {
  if (window.GARCOM_RESTRICOES_RUNTIME === 'v1') return;
  window.GARCOM_RESTRICOES_RUNTIME = 'v1';

  const MENSAGEM_CANCELAMENTO = 'Cancelamento ou redução de item deve ser feito pelo caixa/PDV.';
  const MENSAGEM_LIMPEZA = 'Limpar mesa é uma operação exclusiva do caixa/PDV.';

  function instalarEstilo() {
    if (document.getElementById('garcom-restricoes-style')) return;
    const style = document.createElement('style');
    style.id = 'garcom-restricoes-style';
    style.textContent = `
      .btn-limpar-g{display:none!important}
      .qty-ctrl-g button[onclick*="alterarQtdG"][onclick*="-1"]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function bloquearFuncoes() {
    const alterarOriginal = window.alterarQtdG;
    if (typeof alterarOriginal === 'function' && !alterarOriginal.__semCancelamentoGarcom) {
      const protegida = async function(index, delta, ...rest) {
        if (Number(delta) < 0) {
          alert(MENSAGEM_CANCELAMENTO);
          return false;
        }
        return alterarOriginal.call(this, index, delta, ...rest);
      };
      protegida.__semCancelamentoGarcom = true;
      window.alterarQtdG = protegida;
    }

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
    bloquearFuncoes();
  }

  iniciar();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  window.addEventListener('load', iniciar);

  window.GarcomRestricoesOperacionais = Object.freeze({
    runtime: 'v1',
    podeCancelarItem: false,
    podeLimparMesa: false
  });
})();
