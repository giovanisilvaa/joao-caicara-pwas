/* Divisão rápida de conta do PDV — camada visual sem alterar cozinha ou pedidos. */
(() => {
  const moeda = n => typeof formatarMoeda === 'function' ? formatarMoeda(Number(n) || 0) : `R$ ${(Number(n)||0).toFixed(2).replace('.', ',')}`;

  function dadosDivisao() {
    const qtd = Math.max(2, parseInt(document.getElementById('qtd-pessoas')?.value, 10) || 2);
    let subtotal = 0, taxa = 0, total = 0;
    try {
      const calc = calcularTotalComTaxa('chk-taxa-dividir') || {};
      subtotal = Number(calc.subtotal) || 0;
      taxa = Number(calc.taxa) || 0;
      total = Number(calc.total) || 0;
    } catch (_) {}
    return { qtd, subtotal, taxa, total, porPessoa: qtd ? total / qtd : total };
  }

  function garantirInterface() {
    const modal = document.querySelector('#modal-dividir .modal');
    if (!modal || document.getElementById('split-fast-pdv')) return;
    const input = document.getElementById('qtd-pessoas');
    const valorPessoa = document.getElementById('valor-por-pessoa');
    if (!input || !valorPessoa) return;

    const bloco = document.createElement('div');
    bloco.id = 'split-fast-pdv';
    bloco.innerHTML = `
      <div class="split-fast-title">⚡ Divisão rápida</div>
      <div class="split-fast-people" role="group" aria-label="Quantidade de pessoas">
        ${[2,3,4,5,6].map(n => `<button type="button" data-pessoas="${n}">${n} pessoas</button>`).join('')}
      </div>
      <div class="split-fast-summary">
        <div><span>Subtotal</span><strong id="split-subtotal">R$ 0,00</strong></div>
        <div><span>Taxa de serviço</span><strong id="split-taxa">R$ 0,00</strong></div>
        <div class="total"><span>Total da divisão</span><strong id="split-total">R$ 0,00</strong></div>
      </div>
      <div class="split-fast-note" id="split-fast-note"></div>
      <button type="button" class="split-go-checkout" id="split-go-checkout">💳 Ir para pagamento</button>`;

    input.insertAdjacentElement('afterend', bloco);
    bloco.querySelectorAll('[data-pessoas]').forEach(btn => btn.addEventListener('click', () => {
      input.value = btn.dataset.pessoas;
      input.dispatchEvent(new Event('input', { bubbles:true }));
      atualizarInterface();
    }));

    document.getElementById('chk-taxa-dividir')?.addEventListener('change', () => setTimeout(atualizarInterface, 0));
    input.addEventListener('input', () => setTimeout(atualizarInterface, 0));
    document.getElementById('split-go-checkout')?.addEventListener('click', () => {
      const { porPessoa, qtd } = dadosDivisao();
      try { sessionStorage.setItem('pdv_ultima_cota_divisao', JSON.stringify({ qtd, valor: porPessoa, criadoEm: Date.now() })); } catch (_) {}
      if (typeof fecharModais === 'function') fecharModais();
      if (typeof abrirModalFechar === 'function') {
        abrirModalFechar();
        setTimeout(() => {
          const aviso = document.getElementById('checkout-split-hint') || document.createElement('div');
          aviso.id = 'checkout-split-hint';
          aviso.className = 'checkout-split-hint';
          aviso.innerHTML = `Divisão anterior: <strong>${qtd} pessoas</strong> · cota aproximada <strong>${moeda(porPessoa)}</strong>`;
          const modalFechar = document.querySelector('#modal-fechar .modal');
          if (modalFechar && !aviso.parentNode) modalFechar.insertBefore(aviso, modalFechar.children[1] || null);
        }, 0);
      }
    });
    atualizarInterface();
  }

  function atualizarInterface() {
    const { qtd, subtotal, taxa, total, porPessoa } = dadosDivisao();
    document.querySelectorAll('#split-fast-pdv [data-pessoas]').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.pessoas) === qtd));
    const s = document.getElementById('split-subtotal'); if (s) s.textContent = moeda(subtotal);
    const t = document.getElementById('split-taxa'); if (t) t.textContent = moeda(taxa);
    const tt = document.getElementById('split-total'); if (tt) tt.textContent = moeda(total);
    const note = document.getElementById('split-fast-note');
    if (note) note.innerHTML = `<strong>${moeda(porPessoa)}</strong> por pessoa · ${qtd} cota(s)`;
  }

  const abrirOriginal = window.abrirModalDividir;
  if (typeof abrirOriginal === 'function') {
    window.abrirModalDividir = function abrirModalDividirRapido() {
      const retorno = abrirOriginal.apply(this, arguments);
      setTimeout(() => { garantirInterface(); atualizarInterface(); }, 0);
      return retorno;
    };
  }

  const calcularOriginal = window.calcularDivisao;
  if (typeof calcularOriginal === 'function') {
    window.calcularDivisao = function calcularDivisaoRapida() {
      const retorno = calcularOriginal.apply(this, arguments);
      setTimeout(atualizarInterface, 0);
      return retorno;
    };
  }

  document.addEventListener('DOMContentLoaded', garantirInterface, { once:true });
})();
