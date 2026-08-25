/* Relatório diário de vendas por garçom — calcula autoria por item lançado e imprime em 80 mm. */
(() => {
  const moeda = valor => (typeof formatarMoeda === 'function'
    ? formatarMoeda(Number(valor) || 0)
    : `R$ ${(Number(valor) || 0).toFixed(2).replace('.', ',')}`);

  const normalizarNome = nome => String(nome || '').replace(/\s+/g, ' ').trim();
  const chaveNome = nome => normalizarNome(nome).toLocaleLowerCase('pt-BR');
  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caractere]));

  function vendasDoDia() {
    try {
      if (typeof obterVendasDoDiaPdv === 'function') return obterVendasDoDiaPdv();
      const fonte = typeof vendasCacheDiario !== 'undefined' && Array.isArray(vendasCacheDiario)
        ? vendasCacheDiario
        : [];
      return typeof vendaEhDeHoje === 'function' ? fonte.filter(vendaEhDeHoje) : fonte;
    } catch (_) {
      return [];
    }
  }

  function itensDaVenda(venda) {
    if (Array.isArray(venda?.itens)) return venda.itens.filter(Boolean);
    if (venda?.itens && typeof venda.itens === 'object') return Object.values(venda.itens).filter(Boolean);
    return [];
  }

  function nomeFallbackVenda(venda) {
    const atendentes = Array.isArray(venda?.garconsAtendimento)
      ? venda.garconsAtendimento
      : (venda?.garconsAtendimento && typeof venda.garconsAtendimento === 'object' ? Object.values(venda.garconsAtendimento) : []);
    return normalizarNome(
      venda?.garcomResponsavel?.nome ||
      venda?.garcomNome ||
      atendentes[0]?.nome ||
      ''
    );
  }

  function gerarResumo() {
    const mapa = new Map();
    let totalItensIdentificados = 0;
    let totalLegado = 0;
    let vendasLegadas = 0;
    const vendas = vendasDoDia();

    function obter(nome) {
      const limpo = normalizarNome(nome) || 'Não identificado';
      const chave = chaveNome(limpo) || 'nao-identificado';
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          nome: limpo,
          total: 0,
          itens: 0,
          mesas: new Set(),
          vendas: new Set(),
          legado: 0
        });
      }
      return mapa.get(chave);
    }

    vendas.forEach((venda, indiceVenda) => {
      const itens = itensDaVenda(venda);
      const vendaId = String(venda?.id || `${venda?.mesa || 'mesa'}-${venda?.criadoEm || indiceVenda}`);
      const mesa = String(venda?.mesa || '');
      let houveAutoriaItem = false;
      let subtotalComAutoria = 0;

      itens.forEach(item => {
        const nome = normalizarNome(item?.garcomLancamento?.nome);
        if (!nome) return;
        const qtd = Number(item?.qtd) || 0;
        const preco = Number(item?.preco) || 0;
        const valor = qtd * preco;
        const linha = obter(nome);
        linha.total += valor;
        linha.itens += qtd;
        if (mesa) linha.mesas.add(mesa);
        linha.vendas.add(vendaId);
        subtotalComAutoria += valor;
        totalItensIdentificados += valor;
        houveAutoriaItem = true;
      });

      if (!houveAutoriaItem) {
        const nome = nomeFallbackVenda(venda);
        const subtotal = Number(venda?.subtotal);
        const valorLegado = Number.isFinite(subtotal) ? subtotal : itens.reduce(
          (soma, item) => soma + ((Number(item?.qtd) || 0) * (Number(item?.preco) || 0)),
          0
        );
        const linha = obter(nome || 'Não identificado');
        linha.total += valorLegado;
        linha.itens += itens.reduce((soma, item) => soma + (Number(item?.qtd) || 0), 0);
        if (mesa) linha.mesas.add(mesa);
        linha.vendas.add(vendaId);
        linha.legado += valorLegado;
        totalLegado += valorLegado;
        vendasLegadas += 1;
      } else {
        const subtotal = Number(venda?.subtotal);
        if (Number.isFinite(subtotal) && subtotal > subtotalComAutoria + 0.01) {
          const diferenca = subtotal - subtotalComAutoria;
          const linha = obter('Não identificado');
          linha.total += diferenca;
          linha.legado += diferenca;
          if (mesa) linha.mesas.add(mesa);
          linha.vendas.add(vendaId);
          totalLegado += diferenca;
        }
      }
    });

    const linhas = [...mapa.values()]
      .map(item => ({
        ...item,
        mesas: item.mesas.size,
        vendas: item.vendas.size
      }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));

    return {
      linhas,
      total: linhas.reduce((soma, item) => soma + item.total, 0),
      totalItensIdentificados,
      totalLegado,
      vendasLegadas,
      quantidadeVendas: vendas.length
    };
  }

  function garantirInterface() {
    if (!document.getElementById('relatorio-garcons-style')) {
      const style = document.createElement('style');
      style.id = 'relatorio-garcons-style';
      style.textContent = `
        #btn-relatorio-garcons{grid-column:1/-1;border:0;border-radius:10px;padding:10px 14px;background:#0f4c5c;color:#fff;font-weight:800;cursor:pointer;box-shadow:0 3px 0 rgba(15,76,92,.18)}
        #relatorio-garcons-overlay{display:none;position:fixed;inset:0;z-index:1800;background:rgba(15,76,92,.82);align-items:center;justify-content:center;padding:18px}
        #relatorio-garcons-modal{width:min(760px,100%);max-height:88vh;overflow:auto;background:#f9f6f0;border-radius:16px;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.3)}
        .rg-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.rg-head h3{font-family:Georgia,serif;color:#0f4c5c;margin:0}.rg-actions{display:flex;gap:8px;align-items:center}.rg-close,.rg-print{border:0;border-radius:9px;padding:8px 11px;font-weight:800;cursor:pointer}.rg-close{background:#e7ecea;color:#234d56}.rg-print{background:#0f4c5c;color:#fff}
        .rg-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}.rg-kpi{background:#fff;border:1px solid #e0ddcf;border-radius:10px;padding:10px}.rg-kpi small{display:block;color:#6b7779;font-weight:700}.rg-kpi strong{display:block;color:#0f4c5c;font-family:Georgia,serif;font-size:1.25rem;margin-top:3px}
        .rg-table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden}.rg-table th,.rg-table td{padding:10px;border-bottom:1px solid #eee;text-align:left;font-size:.88rem}.rg-table th{background:#edf3f1;color:#123e48}.rg-table td:last-child,.rg-table th:last-child{text-align:right}.rg-name{font-weight:800;color:#173d45}.rg-note{margin-top:12px;font-size:.78rem;line-height:1.45;color:#657174;background:#fff;border:1px solid #e0ddcf;border-radius:9px;padding:10px}.rg-legacy{font-size:.7rem;color:#a65833;font-weight:800;margin-left:5px}
        .rg-empty{background:#fff;border:1px dashed #c8d4d1;border-radius:10px;padding:24px;text-align:center;color:#657174}
        #relatorio-garcons-print{display:none}
        @media print{
          body.print-mode-relatorio-garcons #relatorio-garcons-print{display:block!important;width:80mm!important;padding:4mm!important;margin:0 auto!important;box-sizing:border-box;font-family:'Courier New',monospace;color:#000;background:#fff}
          body.print-mode-relatorio-garcons #relatorio-garcons-print .rgp-title{text-align:center;font-weight:900;font-size:16px;border-bottom:1px dashed #000;padding-bottom:5px;margin-bottom:5px}
          body.print-mode-relatorio-garcons #relatorio-garcons-print .rgp-meta{text-align:center;font-size:11px;margin-bottom:8px}
          body.print-mode-relatorio-garcons #relatorio-garcons-print .rgp-row{border-bottom:1px dashed #000;padding:6px 0;font-size:12px}
          body.print-mode-relatorio-garcons #relatorio-garcons-print .rgp-row strong{display:block;font-size:13px}
          body.print-mode-relatorio-garcons #relatorio-garcons-print .rgp-total{font-weight:900;font-size:14px;border-top:2px solid #000;margin-top:8px;padding-top:6px;text-align:right}
        }
        @media(max-width:600px){.rg-summary{grid-template-columns:1fr}.rg-table{font-size:.8rem}.rg-table th,.rg-table td{padding:8px 6px}.rg-head{align-items:flex-start}.rg-actions{flex-direction:column}}
      `;
      document.head.appendChild(style);
    }

    const painel = document.getElementById('painel-diario');
    if (painel && !document.getElementById('btn-relatorio-garcons')) {
      const botao = document.createElement('button');
      botao.id = 'btn-relatorio-garcons';
      botao.type = 'button';
      botao.textContent = '👥 Vendas por Garçom';
      botao.addEventListener('click', abrirRelatorio);
      painel.appendChild(botao);
    }

    if (!document.getElementById('relatorio-garcons-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'relatorio-garcons-overlay';
      overlay.innerHTML = `
        <div id="relatorio-garcons-modal" role="dialog" aria-modal="true" aria-labelledby="relatorio-garcons-titulo">
          <div class="rg-head">
            <div><h3 id="relatorio-garcons-titulo">Vendas por Garçom</h3><small id="relatorio-garcons-data"></small></div>
            <div class="rg-actions">
              <button type="button" class="rg-print" id="relatorio-garcons-imprimir">🖨️ Imprimir</button>
              <button type="button" class="rg-close" id="relatorio-garcons-fechar">Fechar</button>
            </div>
          </div>
          <div id="relatorio-garcons-conteudo"></div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', event => { if (event.target === overlay) fecharRelatorio(); });
      overlay.querySelector('#relatorio-garcons-fechar')?.addEventListener('click', fecharRelatorio);
      overlay.querySelector('#relatorio-garcons-imprimir')?.addEventListener('click', imprimirRelatorio);
    }

    if (!document.getElementById('relatorio-garcons-print')) {
      const print = document.createElement('div');
      print.id = 'relatorio-garcons-print';
      print.className = 'print-container';
      document.body.appendChild(print);
    }
  }

  function dataRelatorio() {
    return typeof formatarDataPainel === 'function'
      ? formatarDataPainel(new Date())
      : new Date().toLocaleDateString('pt-BR');
  }

  function abrirRelatorio() {
    garantirInterface();
    const resumo = gerarResumo();
    const conteudo = document.getElementById('relatorio-garcons-conteudo');
    const data = document.getElementById('relatorio-garcons-data');
    if (data) data.textContent = dataRelatorio();

    if (!conteudo) return;
    if (!resumo.linhas.length) {
      conteudo.innerHTML = '<div class="rg-empty">Nenhuma venda fechada hoje com dados disponíveis para o relatório.</div>';
    } else {
      const linhas = resumo.linhas.map(item => `
        <tr>
          <td><span class="rg-name">${escapar(item.nome)}</span>${item.legado > 0 ? '<span class="rg-legacy">dados antigos</span>' : ''}</td>
          <td>${item.itens}</td>
          <td>${item.mesas}</td>
          <td>${item.vendas}</td>
          <td><strong>${moeda(item.total)}</strong></td>
        </tr>`).join('');
      conteudo.innerHTML = `
        <div class="rg-summary">
          <div class="rg-kpi"><small>Total em itens</small><strong>${moeda(resumo.total)}</strong></div>
          <div class="rg-kpi"><small>Garçons identificados</small><strong>${resumo.linhas.filter(x => x.nome !== 'Não identificado').length}</strong></div>
          <div class="rg-kpi"><small>Vendas fechadas hoje</small><strong>${resumo.quantidadeVendas}</strong></div>
        </div>
        <table class="rg-table">
          <thead><tr><th>Garçom</th><th>Itens</th><th>Mesas</th><th>Vendas</th><th>Vendido</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
        <div class="rg-note">O valor por garçom considera os itens lançados por cada nome. A taxa de serviço não é dividida entre os garçons. ${resumo.vendasLegadas ? `${resumo.vendasLegadas} venda(s) antiga(s) não tinham autoria por item e foram atribuídas pelo nome registrado na venda.` : 'As vendas novas usam autoria individual por item.'}</div>`;
    }
    const overlay = document.getElementById('relatorio-garcons-overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  function imprimirRelatorio() {
    garantirInterface();
    const resumo = gerarResumo();
    if (!resumo.linhas.length) return alert('Não há vendas por garçom para imprimir hoje.');
    const print = document.getElementById('relatorio-garcons-print');
    if (!print) return;

    const linhas = resumo.linhas.map(item => `
      <div class="rgp-row">
        <strong>${escapar(item.nome)}</strong>
        <div>Itens: ${item.itens} | Mesas: ${item.mesas} | Vendas: ${item.vendas}</div>
        <div>Vendido: ${moeda(item.total)}</div>
      </div>`).join('');

    print.innerHTML = `
      <div class="rgp-title">VENDAS POR GARÇOM</div>
      <div class="rgp-meta">João Caiçara Tradição<br>${escapar(dataRelatorio())}</div>
      ${linhas}
      <div class="rgp-total">TOTAL: ${moeda(resumo.total)}</div>
      <div style="text-align:center;font-size:10px;margin-top:8px;">Taxa de serviço não incluída no valor por garçom.</div>`;

    document.body.classList.add('print-mode-relatorio-garcons');
    try {
      window.print();
    } finally {
      document.body.classList.remove('print-mode-relatorio-garcons');
    }
  }

  function fecharRelatorio() {
    const overlay = document.getElementById('relatorio-garcons-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  window.RelatorioVendasGarcom = Object.freeze({ gerarResumo, abrir: abrirRelatorio, fechar: fecharRelatorio, imprimir: imprimirRelatorio });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', garantirInterface, { once: true });
  else garantirInterface();
})();
