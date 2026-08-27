/* Relatório financeiro diário do PDV — caixa líquido, data selecionável e impressão térmica. */
(() => {
  const RUNTIME = 'v29';
  const numero = valor => Number(valor) || 0;
  const moeda = valor => (typeof formatarMoeda === 'function'
    ? formatarMoeda(numero(valor))
    : `R$ ${numero(valor).toFixed(2).replace('.', ',')}`);
  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caractere]));
  const pad = valor => String(valor).padStart(2, '0');

  function chaveLocal(data) {
    const d = data instanceof Date ? data : new Date(data);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function chaveVenda(venda) {
    const criadoEm = Number(venda?.criadoEm);
    if (Number.isFinite(criadoEm) && criadoEm > 0) return chaveLocal(new Date(criadoEm));
    const texto = String(venda?.dataHora || '');
    const match = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return `${match[3]}-${pad(match[2])}-${pad(match[1])}`;
    return chaveLocal(texto);
  }

  function fonteVendas() {
    try {
      if (typeof vendasCacheDiario !== 'undefined' && Array.isArray(vendasCacheDiario)) return vendasCacheDiario.filter(Boolean);
    } catch (_) {}
    try {
      const local = JSON.parse(localStorage.getItem('historico_vendas_caicara')) || [];
      return Array.isArray(local) ? local.filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function hoje() {
    return chaveLocal(new Date());
  }

  function dataSelecionada() {
    return document.getElementById('relatorio-financeiro-data')?.value || hoje();
  }

  function vendasDaData(data = dataSelecionada()) {
    return fonteVendas().filter(venda => chaveVenda(venda) === data);
  }

  function itensDaVenda(venda) {
    if (Array.isArray(venda?.itens)) return venda.itens.filter(Boolean);
    if (venda?.itens && typeof venda.itens === 'object') return Object.values(venda.itens).filter(Boolean);
    return [];
  }

  function resumir(vendas) {
    const resumo = vendas.reduce((acc, venda) => {
      const pagamentos = venda?.pagamentos || {};
      const taxa = numero(venda?.taxa);
      const total = numero(venda?.total);
      const subtotalInformado = Number(venda?.subtotal);
      const subtotal = Number.isFinite(subtotalInformado) ? subtotalInformado : Math.max(0, total - taxa);
      acc.dinheiroRecebido += numero(pagamentos.dinheiro);
      acc.pix += numero(pagamentos.pix);
      acc.credito += numero(pagamentos.credito);
      acc.debito += numero(pagamentos.debito);
      acc.troco += numero(venda?.troco);
      acc.taxa += taxa;
      acc.subtotal += subtotal;
      acc.total += total;
      return acc;
    }, {
      dinheiroRecebido: 0,
      dinheiroLiquido: 0,
      pix: 0,
      credito: 0,
      debito: 0,
      troco: 0,
      taxa: 0,
      subtotal: 0,
      total: 0,
      ticketMedio: 0,
      quantidadeVendas: vendas.length,
      diferencaPagamentos: 0
    });

    resumo.dinheiroLiquido = resumo.dinheiroRecebido - resumo.troco;
    resumo.ticketMedio = resumo.quantidadeVendas ? resumo.total / resumo.quantidadeVendas : 0;
    const pagamentosLiquidos = resumo.dinheiroRecebido + resumo.pix + resumo.credito + resumo.debito - resumo.troco;
    resumo.diferencaPagamentos = pagamentosLiquidos - resumo.total;
    return resumo;
  }

  function formatarDataChave(chave) {
    const match = String(chave || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(chave || '');
  }

  function garantirInterface() {
    if (!document.getElementById('relatorio-financeiro-style')) {
      const style = document.createElement('style');
      style.id = 'relatorio-financeiro-style';
      style.textContent = `
        #relatorio-financeiro-controles{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:10px 0 12px;padding:10px;background:#edf3f1;border:1px solid #d7e2df;border-radius:10px}
        #relatorio-financeiro-controles label{display:flex;flex-direction:column;gap:4px;font-size:.78rem;font-weight:800;color:#234d56}
        #relatorio-financeiro-data{border:1px solid #b8c9c5;border-radius:8px;padding:7px 9px;background:#fff;color:#173d45}
        .rfd-btn{border:0;border-radius:8px;padding:8px 10px;font-weight:800;cursor:pointer;background:#0f4c5c;color:#fff}.rfd-btn.sec{background:#536b70}
        #relatorio-financeiro-resumo{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0 12px}
        .rfd-kpi{background:#fff;border:1px solid #e0ddcf;border-radius:10px;padding:9px}.rfd-kpi small{display:block;color:#6b7779;font-weight:700;line-height:1.25}.rfd-kpi strong{display:block;color:#0f4c5c;font-size:1.08rem;margin-top:3px}.rfd-kpi.atencao strong{color:#a54d2c}
        #relatorio-financeiro-print{display:none}
        @media(max-width:650px){#relatorio-financeiro-resumo{grid-template-columns:1fr 1fr}}
        @media print{
          body.print-mode-relatorio-financeiro > *{display:none!important}
          body.print-mode-relatorio-financeiro #relatorio-financeiro-print{display:block!important;width:80mm!important;margin:0 auto!important;padding:4mm!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;font-family:'Courier New',monospace!important}
          #relatorio-financeiro-print .rfdp-title{text-align:center;font-size:16px;font-weight:900;border-bottom:1px dashed #000;padding-bottom:5px;margin-bottom:5px}
          #relatorio-financeiro-print .rfdp-meta{text-align:center;font-size:11px;margin-bottom:8px}
          #relatorio-financeiro-print .rfdp-row{display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:3px 0;border-bottom:1px dotted #aaa}
          #relatorio-financeiro-print .rfdp-row.total{font-weight:900;font-size:14px;border-top:2px solid #000;border-bottom:0;margin-top:6px;padding-top:6px}
          #relatorio-financeiro-print .rfdp-note{text-align:center;font-size:9px;margin-top:8px;border-top:1px dashed #000;padding-top:6px}
        }
      `;
      document.head.appendChild(style);
    }

    const lista = document.getElementById('lista-historico');
    if (lista?.parentElement && !document.getElementById('relatorio-financeiro-controles')) {
      const controles = document.createElement('div');
      controles.id = 'relatorio-financeiro-controles';
      controles.innerHTML = `
        <label>Data do relatório<input type="date" id="relatorio-financeiro-data" value="${hoje()}"></label>
        <button type="button" class="rfd-btn" id="relatorio-financeiro-imprimir">🖨️ Imprimir fechamento</button>
        <button type="button" class="rfd-btn sec" id="relatorio-financeiro-fechar-caixa">✅ Registrar fechamento</button>`;
      const resumo = document.createElement('div');
      resumo.id = 'relatorio-financeiro-resumo';
      lista.parentElement.insertBefore(controles, lista);
      lista.parentElement.insertBefore(resumo, lista);
      controles.querySelector('#relatorio-financeiro-data')?.addEventListener('change', () => window.renderizarHistorico?.());
      controles.querySelector('#relatorio-financeiro-imprimir')?.addEventListener('click', () => window.imprimirRelatorioCaixa?.());
      controles.querySelector('#relatorio-financeiro-fechar-caixa')?.addEventListener('click', () => window.registrarFechamentoCaixa?.());
    }

    let print = document.getElementById('relatorio-financeiro-print');
    if (!print) {
      print = document.createElement('div');
      print.id = 'relatorio-financeiro-print';
      document.body.appendChild(print);
    }

    document.querySelectorAll('[onclick*="limparHistoricoGeral"]').forEach(botao => {
      botao.textContent = '🔒 Histórico protegido';
      botao.setAttribute('title', 'As vendas oficiais ficam no Firebase e não são apagadas por este botão.');
    });
  }

  function preencherResumo(resumo) {
    const set = (id, valor) => {
      const el = document.getElementById(id);
      if (el) el.innerText = moeda(valor);
    };
    set('rep-dinheiro', resumo.dinheiroLiquido);
    set('rep-pix', resumo.pix);
    set('rep-credito', resumo.credito);
    set('rep-debito', resumo.debito);
    set('rep-taxa-servico', resumo.taxa);
    set('rep-total', resumo.total);
    set('rep-troco', resumo.troco);

    const extra = document.getElementById('relatorio-financeiro-resumo');
    if (!extra) return;
    const divergente = Math.abs(resumo.diferencaPagamentos) > 0.02;
    extra.innerHTML = `
      <div class="rfd-kpi"><small>Faturamento bruto</small><strong>${moeda(resumo.total)}</strong></div>
      <div class="rfd-kpi"><small>Produtos / subtotal</small><strong>${moeda(resumo.subtotal)}</strong></div>
      <div class="rfd-kpi"><small>Taxa de serviço</small><strong>${moeda(resumo.taxa)}</strong></div>
      <div class="rfd-kpi"><small>Vendas fechadas</small><strong>${resumo.quantidadeVendas}</strong></div>
      <div class="rfd-kpi"><small>Ticket médio</small><strong>${moeda(resumo.ticketMedio)}</strong></div>
      <div class="rfd-kpi"><small>Dinheiro recebido</small><strong>${moeda(resumo.dinheiroRecebido)}</strong></div>
      <div class="rfd-kpi"><small>Trocos entregues</small><strong>${moeda(resumo.troco)}</strong></div>
      <div class="rfd-kpi"><small>Dinheiro líquido esperado</small><strong>${moeda(resumo.dinheiroLiquido)}</strong></div>
      <div class="rfd-kpi ${divergente ? 'atencao' : ''}"><small>Conferência pagamentos</small><strong>${divergente ? `Dif. ${moeda(resumo.diferencaPagamentos)}` : 'OK'}</strong></div>`;
  }

  function renderizarHistoricoSeguro() {
    garantirInterface();
    const lista = document.getElementById('lista-historico');
    if (!lista) return;
    const data = dataSelecionada();
    const vendas = vendasDaData(data);
    const resumo = resumir(vendas);
    preencherResumo(resumo);

    const filtro = String(document.getElementById('filtro-historico')?.value || '').trim().toLocaleLowerCase('pt-BR');
    const filtradas = filtro ? vendas.filter(venda => {
      const mesa = String(venda?.mesa ?? '').toLocaleLowerCase('pt-BR');
      const cliente = String(venda?.cliente ?? '').toLocaleLowerCase('pt-BR');
      const garcom = String(venda?.garcomNome || venda?.garcomResponsavel?.nome || '').toLocaleLowerCase('pt-BR');
      return mesa.includes(filtro) || cliente.includes(filtro) || garcom.includes(filtro);
    }) : vendas;

    if (!filtradas.length) {
      lista.innerHTML = `<p style="text-align:center;color:#777;padding:14px;">Nenhuma venda encontrada em ${escapar(formatarDataChave(data))}.</p>`;
      return;
    }

    lista.innerHTML = filtradas
      .slice()
      .sort((a, b) => numero(b?.criadoEm) - numero(a?.criadoEm))
      .map(venda => {
        const itens = itensDaVenda(venda);
        const itensStr = itens.map(item => `${numero(item?.qtd)}x ${escapar(item?.nome)} (${moeda(item?.preco)})`).join(', ');
        const pagamentos = venda?.pagamentos || {};
        const partes = [];
        if (numero(pagamentos.dinheiro) > 0) partes.push(`Dinheiro: ${moeda(pagamentos.dinheiro)}`);
        if (numero(pagamentos.pix) > 0) partes.push(`PIX: ${moeda(pagamentos.pix)}`);
        if (numero(pagamentos.credito) > 0) partes.push(`Crédito: ${moeda(pagamentos.credito)}`);
        if (numero(pagamentos.debito) > 0) partes.push(`Débito: ${moeda(pagamentos.debito)}`);
        const garcom = venda?.garcomNome || venda?.garcomResponsavel?.nome || '';
        return `
          <div class="history-card">
            <header><span>Mesa ${escapar(venda?.mesa)} (${escapar(venda?.cliente || 'Não informado')})</span><span>${escapar(venda?.dataHora || '')}</span></header>
            ${garcom ? `<div style="margin-bottom:3px;"><strong>Garçom:</strong> ${escapar(garcom)}</div>` : ''}
            <div style="margin-bottom:3px;"><strong>Itens:</strong> ${itensStr || '—'}</div>
            <div style="margin-bottom:3px;color:#555;"><strong>Pgto:</strong> ${partes.join(' | ') || '—'}</div>
            ${numero(venda?.taxa) > 0 ? `<div style="margin-bottom:3px;color:#555;font-size:.85rem;">Subtotal: ${moeda(venda?.subtotal)} + Taxa: ${moeda(venda?.taxa)}</div>` : ''}
            <div style="display:flex;justify-content:space-between;font-weight:bold;color:var(--primary);"><span>Total: ${moeda(venda?.total)}</span><span>Troco: ${moeda(venda?.troco)}</span></div>
          </div>`;
      }).join('');
  }

  function abrirModalHistoricoSeguro() {
    garantirInterface();
    const input = document.getElementById('relatorio-financeiro-data');
    if (input && !input.value) input.value = hoje();
    renderizarHistoricoSeguro();
    const modal = document.getElementById('modal-historico');
    if (modal) modal.style.display = 'flex';
  }

  function imprimirRelatorioCaixaSeguro() {
    garantirInterface();
    const data = dataSelecionada();
    const vendas = vendasDaData(data);
    if (!vendas.length) return alert(`Não há vendas em ${formatarDataChave(data)} para imprimir.`);
    const resumo = resumir(vendas);
    const print = document.getElementById('relatorio-financeiro-print');
    if (!print) return;

    print.innerHTML = `
      <div class="rfdp-title">FECHAMENTO DE VENDAS</div>
      <div class="rfdp-meta">João Caiçara Tradição<br>${escapar(formatarDataChave(data))}<br>Impresso: ${escapar(new Date().toLocaleString('pt-BR'))}</div>
      <div class="rfdp-row"><span>Vendas fechadas</span><strong>${resumo.quantidadeVendas}</strong></div>
      <div class="rfdp-row"><span>Produtos / subtotal</span><strong>${moeda(resumo.subtotal)}</strong></div>
      <div class="rfdp-row"><span>Taxa de serviço</span><strong>${moeda(resumo.taxa)}</strong></div>
      <div class="rfdp-row total"><span>FATURAMENTO</span><strong>${moeda(resumo.total)}</strong></div>
      <div class="rfdp-row"><span>Ticket médio</span><strong>${moeda(resumo.ticketMedio)}</strong></div>
      <div class="rfdp-row"><span>Dinheiro recebido</span><strong>${moeda(resumo.dinheiroRecebido)}</strong></div>
      <div class="rfdp-row"><span>(-) Trocos</span><strong>${moeda(resumo.troco)}</strong></div>
      <div class="rfdp-row total"><span>DINHEIRO LÍQUIDO</span><strong>${moeda(resumo.dinheiroLiquido)}</strong></div>
      <div class="rfdp-row"><span>PIX</span><strong>${moeda(resumo.pix)}</strong></div>
      <div class="rfdp-row"><span>Débito</span><strong>${moeda(resumo.debito)}</strong></div>
      <div class="rfdp-row"><span>Crédito</span><strong>${moeda(resumo.credito)}</strong></div>
      <div class="rfdp-note">Dinheiro líquido = dinheiro recebido - trocos entregues. Histórico oficial preservado no Firebase.</div>`;

    document.body.classList.add('print-mode-relatorio-financeiro');
    try {
      window.print();
    } finally {
      document.body.classList.remove('print-mode-relatorio-financeiro');
    }
  }

  async function registrarFechamentoCaixaSeguro() {
    const data = hoje();
    const vendas = vendasDaData(data);
    if (!vendas.length) return alert('Não há vendas registradas hoje para fechar o caixa.');
    const resumo = resumir(vendas);
    const resposta = prompt(
      `Dinheiro recebido: ${moeda(resumo.dinheiroRecebido)}\n` +
      `Trocos entregues: ${moeda(resumo.troco)}\n` +
      `Dinheiro líquido esperado: ${moeda(resumo.dinheiroLiquido)}\n\n` +
      'Informe o dinheiro contado no caixa:'
    );
    if (resposta === null) return;
    const contado = Number(String(resposta).replace(',', '.'));
    if (!Number.isFinite(contado) || contado < 0) return alert('Informe um valor contado válido.');

    const fechamento = {
      id: `fechamento-${Date.now()}`,
      fechadoEm: Date.now(),
      data,
      funcionario: 'caixa',
      vendas: resumo.quantidadeVendas,
      totais: {
        dinheiroRecebido: resumo.dinheiroRecebido,
        troco: resumo.troco,
        dinheiroLiquido: resumo.dinheiroLiquido,
        pix: resumo.pix,
        credito: resumo.credito,
        debito: resumo.debito,
        subtotal: resumo.subtotal,
        taxa: resumo.taxa,
        total: resumo.total,
        ticketMedio: resumo.ticketMedio
      },
      dinheiroEsperado: resumo.dinheiroLiquido,
      dinheiroContado: contado,
      diferencaDinheiro: contado - resumo.dinheiroLiquido,
      calculoCaixa: 'dinheiro-recebido-menos-troco',
      versaoRelatorio: RUNTIME
    };

    try {
      await db.ref(`fechamentosCaixa/${fechamento.id}`).set(fechamento);
      if (typeof registrarAuditoriaPdv === 'function') {
        await registrarAuditoriaPdv('fechar_caixa', {
          id: fechamento.id,
          vendas: fechamento.vendas,
          dinheiroEsperado: fechamento.dinheiroEsperado,
          diferencaDinheiro: fechamento.diferencaDinheiro
        });
      }
      alert(`Fechamento registrado.\nDinheiro esperado: ${moeda(fechamento.dinheiroEsperado)}.\nDiferença: ${moeda(fechamento.diferencaDinheiro)}.`);
    } catch (erro) {
      console.error('Falha ao registrar fechamento financeiro:', erro);
      alert('Não foi possível registrar o fechamento. Nenhuma venda foi apagada ou alterada.');
    }
  }

  function limparHistoricoGeralSeguro() {
    alert('O histórico oficial de vendas é protegido e permanece no Firebase. Use o filtro de data para consultar outro dia ou registre o fechamento do caixa.');
  }

  window.renderizarHistorico = renderizarHistoricoSeguro;
  window.abrirModalHistorico = abrirModalHistoricoSeguro;
  window.imprimirRelatorioCaixa = imprimirRelatorioCaixaSeguro;
  window.registrarFechamentoCaixa = registrarFechamentoCaixaSeguro;
  window.limparHistoricoGeral = limparHistoricoGeralSeguro;
  window.PdvRelatorioFinanceiro = Object.freeze({
    runtime: RUNTIME,
    resumir,
    vendasDaData,
    imprimir: imprimirRelatorioCaixaSeguro
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', garantirInterface, { once: true });
  } else {
    garantirInterface();
  }
})();
