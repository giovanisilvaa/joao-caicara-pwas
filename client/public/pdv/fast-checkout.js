/* Fechamento rápido do PDV — camada adicional sem alterar o fluxo de produção. */
(() => {
  const IDS = ['pag-dinheiro','pag-pix','pag-credito','pag-debito'];
  const ROTULOS = { 'pag-dinheiro':'Dinheiro', 'pag-pix':'PIX', 'pag-credito':'Crédito', 'pag-debito':'Débito' };
  let campoAtivo = 'pag-dinheiro';

  const valor = id => parseFloat(document.getElementById(id)?.value) || 0;
  const totalPago = () => IDS.reduce((s,id) => s + valor(id), 0);
  const totalConta = () => {
    try { return Number(calcularTotalComTaxa('chk-taxa-servico')?.total) || 0; }
    catch (_) { return 0; }
  };
  const moeda = n => typeof formatarMoeda === 'function' ? formatarMoeda(Number(n)||0) : `R$ ${(Number(n)||0).toFixed(2).replace('.',',')}`;

  function garantirInterfaceRapida() {
    if (document.getElementById('checkout-rapido-pdv')) return;
    const modal = document.querySelector('#modal-fechar .modal');
    if (!modal) return;
    const resumo = document.getElementById('resumo-informado')?.closest('div[style*="background"]');
    const bloco = document.createElement('div');
    bloco.id = 'checkout-rapido-pdv';
    bloco.innerHTML = `
      <div class="checkout-fast-title"><strong>⚡ Pagamento rápido</strong><span id="checkout-campo-ativo">Dinheiro selecionado</span></div>
      <div class="checkout-fast-values" role="group" aria-label="Valores rápidos">
        <button type="button" data-fast="20">+ R$ 20</button>
        <button type="button" data-fast="50">+ R$ 50</button>
        <button type="button" data-fast="100">+ R$ 100</button>
        <button type="button" data-fast="restante" class="restante">Completar restante</button>
        <button type="button" data-fast="limpar" class="limpar">Limpar campo</button>
      </div>
      <div class="checkout-fast-status" id="checkout-fast-status"></div>`;
    if (resumo?.parentNode) resumo.parentNode.insertBefore(bloco, resumo);
    else modal.appendChild(bloco);

    IDS.forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('focus', () => selecionarCampo(id));
      input.addEventListener('click', () => selecionarCampo(id));
      const linha = input.closest('.payment-split-row');
      if (linha) linha.addEventListener('click', e => { if (e.target !== input) { selecionarCampo(id); input.focus(); } });
    });
    bloco.querySelectorAll('[data-fast]').forEach(btn => btn.addEventListener('click', () => aplicarRapido(btn.dataset.fast)));
    selecionarCampo(campoAtivo);
  }

  function selecionarCampo(id) {
    if (!IDS.includes(id)) return;
    campoAtivo = id;
    IDS.forEach(chave => document.getElementById(chave)?.closest('.payment-split-row')?.classList.toggle('payment-selected', chave === id));
    const label = document.getElementById('checkout-campo-ativo');
    if (label) label.textContent = `${ROTULOS[id]} selecionado`;
  }

  function aplicarRapido(acao) {
    const input = document.getElementById(campoAtivo);
    if (!input) return;
    const atual = parseFloat(input.value) || 0;
    if (acao === 'limpar') input.value = '0.00';
    else if (acao === 'restante') {
      const outros = IDS.filter(id => id !== campoAtivo).reduce((s,id) => s + valor(id), 0);
      input.value = Math.max(0, totalConta() - outros).toFixed(2);
    } else input.value = (atual + (parseFloat(acao) || 0)).toFixed(2);
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.focus(); input.select();
  }

  function atualizarStatusRapido() {
    garantirInterfaceRapida();
    const total = totalConta();
    const pago = totalPago();
    const diferenca = pago - total;
    const box = document.getElementById('checkout-fast-status');
    if (!box) return;
    box.className = 'checkout-fast-status ' + (diferenca >= -0.01 ? 'ok' : 'pendente');
    box.innerHTML = diferenca >= -0.01
      ? `<span>Pagamento completo</span><strong>${diferenca > 0.01 ? `Troco ${moeda(diferenca)}` : 'Valor exato'}</strong>`
      : `<span>Ainda falta</span><strong>${moeda(Math.abs(diferenca))}</strong>`;
  }

  const abrirOriginal = window.abrirModalFechar;
  if (typeof abrirOriginal === 'function') {
    window.abrirModalFechar = function abrirModalFecharRapido() {
      const retorno = abrirOriginal.apply(this, arguments);
      setTimeout(() => { garantirInterfaceRapida(); selecionarCampo('pag-dinheiro'); atualizarStatusRapido(); }, 0);
      return retorno;
    };
  }

  const calcularOriginal = window.atualizarCalculoPagamento;
  if (typeof calcularOriginal === 'function') {
    window.atualizarCalculoPagamento = function atualizarCalculoPagamentoRapido() {
      const retorno = calcularOriginal.apply(this, arguments);
      atualizarStatusRapido();
      return retorno;
    };
  }

  const taxaOriginal = window.toggleTaxaServico;
  if (typeof taxaOriginal === 'function') {
    window.toggleTaxaServico = function toggleTaxaServicoRapido() {
      const retorno = taxaOriginal.apply(this, arguments);
      atualizarStatusRapido();
      return retorno;
    };
  }

  window.solicitarFechamentoConta = function solicitarFechamentoContaRapido() {
    if (!mesaAtualSelecionada || !mesas[mesaAtualSelecionada]) return alert('Selecione uma mesa!');
    const total = totalConta();
    const pagamentos = IDS.map(id => [ROTULOS[id], valor(id)]).filter(([,v]) => v > 0.001);
    const pago = totalPago();
    if (pago < total - 0.01) return alert(`Ainda falta ${moeda(total - pago)} para completar o pagamento.`);
    const troco = Math.max(0, pago - total);
    const linhas = pagamentos.map(([nome,v]) => `<div class="confirm-payment-line"><span>${nome}</span><strong>${moeda(v)}</strong></div>`).join('');
    document.getElementById('texto-confirmar-fechamento').innerHTML = `
      <div class="confirm-checkout-summary">
        <div class="confirm-checkout-head"><span>Mesa ${mesaAtualSelecionada}</span><strong>${moeda(total)}</strong></div>
        ${linhas || '<div>Nenhuma forma de pagamento informada.</div>'}
        ${troco > 0.01 ? `<div class="confirm-payment-line troco"><span>Troco</span><strong>${moeda(troco)}</strong></div>` : ''}
        <small>Confira os valores antes de confirmar e imprimir.</small>
      </div>`;
    document.getElementById('modal-confirmar-fechamento').style.display = 'flex';
  };

  document.addEventListener('DOMContentLoaded', garantirInterfaceRapida, { once:true });
})();
