/* Taxa de serviço de 10% no fechamento feito pelo Garçom. */
(() => {
  const TAXA = 0.10;
  const moeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let taxaAtiva = true;

  function subtotalModal() {
    const texto = document.getElementById('subtotal-fechar-g')?.innerText || '0';
    const numero = Number(texto.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(numero) ? numero : 0;
  }

  function garantirUi() {
    const modal = document.querySelector('#modal-fechar-g .modal-g');
    if (!modal || document.getElementById('taxa-servico-g')) return;
    const botoes = modal.querySelector('.botoes-modal-g');
    if (!botoes) return;
    const bloco = document.createElement('div');
    bloco.id = 'taxa-servico-g';
    bloco.style.cssText = 'background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin:8px 0;color:#173d45;';
    bloco.innerHTML = `<label style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:800;cursor:pointer"><span>Adicionar 10% de serviço</span><input id="chk-taxa-servico-g" type="checkbox" checked style="width:22px;height:22px;margin:0"></label><div style="display:flex;justify-content:space-between;margin-top:8px;font-size:.9rem"><span>Taxa de serviço:</span><strong id="valor-taxa-servico-g">R$ 0,00</strong></div><div style="display:flex;justify-content:space-between;margin-top:5px;font-size:1rem;color:var(--primary)"><span><strong>Total com serviço:</strong></span><strong id="total-com-taxa-g">R$ 0,00</strong></div>`;
    modal.insertBefore(bloco, botoes);
    document.getElementById('chk-taxa-servico-g')?.addEventListener('change', atualizarValores);
  }

  function atualizarValores() {
    garantirUi();
    taxaAtiva = document.getElementById('chk-taxa-servico-g')?.checked !== false;
    const subtotal = subtotalModal();
    const taxa = taxaAtiva ? subtotal * TAXA : 0;
    const total = subtotal + taxa;
    const taxaEl = document.getElementById('valor-taxa-servico-g');
    const totalEl = document.getElementById('total-com-taxa-g');
    const recebido = document.getElementById('valor-recebido-g');
    if (taxaEl) taxaEl.innerText = moeda(taxa);
    if (totalEl) totalEl.innerText = moeda(total);
    if (recebido) recebido.value = total.toFixed(2);
  }

  function instalarFechamento() {
    const originalAbrir = window.abrirFechamentoG;
    if (typeof originalAbrir === 'function' && !originalAbrir.__taxa10) {
      const envolvida = function(...args) {
        const r = originalAbrir.apply(this, args);
        setTimeout(() => { garantirUi(); const chk=document.getElementById('chk-taxa-servico-g'); if(chk) chk.checked=true; taxaAtiva=true; atualizarValores(); }, 0);
        return r;
      };
      envolvida.__taxa10 = true;
      window.abrirFechamentoG = envolvida;
    }
  }

  function instalarInterceptadorVenda() {
    const refProto = window.firebase?.database?.Reference?.prototype;
    if (!refProto || refProto.__taxaGarcomInstalada) return;
    const setOriginal = refProto.set;
    refProto.set = function(payload, ...rest) {
      try {
        const caminho = String(this.toString?.() || '');
        if (payload && payload.origem === 'garcom' && caminho.includes('/vendas/')) {
          const subtotal = Number(payload.subtotal) || Number(payload.total) || 0;
          const taxa = taxaAtiva ? subtotal * TAXA : 0;
          const totalComTaxa = subtotal + taxa;
          const recebidoEl = document.getElementById('valor-recebido-g');
          const recebido = Number(recebidoEl?.value) || totalComTaxa;
          const pagamentos = payload.pagamentos || {};
          const forma = Object.keys(pagamentos).find(k => Number(pagamentos[k]) > 0);
          payload.taxa = taxa;
          payload.total = totalComTaxa;
          if (forma) pagamentos[forma] = totalComTaxa;
          payload.pagamentos = pagamentos;
          payload.troco = Math.max(0, recebido - totalComTaxa);
          payload.taxaServicoPercentual = taxaAtiva ? 10 : 0;
        }
      } catch (erro) { console.warn('Falha ao aplicar taxa de serviço do Garçom:', erro); }
      return setOriginal.call(this, payload, ...rest);
    };
    refProto.__taxaGarcomInstalada = true;
  }

  function iniciar() {
    garantirUi();
    instalarFechamento();
    instalarInterceptadorVenda();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true }); else iniciar();
  window.addEventListener('load', iniciar);
  window.GarcomTaxaServico = Object.freeze({ atualizarValores, get ativa(){ return taxaAtiva; } });
})();
