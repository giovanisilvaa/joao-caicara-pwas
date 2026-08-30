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

  function itemAtual(index) {
    try {
      const numero = typeof mesaSelecionada !== 'undefined' ? mesaSelecionada : null;
      return numero ? mesas?.[numero]?.itens?.[index] || null : null;
    } catch (_) {
      return null;
    }
  }

  function bloquearFuncoes() {
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
    runtime: 'v2',
    podeReduzirAntesEnvio: true,
    podeCancelarItemEnviado: false,
    podeLimparMesa: false
  });
})();
