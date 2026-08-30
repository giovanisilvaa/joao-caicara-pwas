/* Painel unificado e somente leitura para relatórios do PDV. */
(() => {
  const RUNTIME = 'v1';
  const numero = valor => Number(valor) || 0;
  const moeda = valor => (typeof formatarMoeda === 'function'
    ? formatarMoeda(numero(valor))
    : `R$ ${numero(valor).toFixed(2).replace('.', ',')}`);
  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caractere]));
  const normalizarNome = nome => String(nome || '').replace(/\s+/g, ' ').trim();
  const chaveNome = nome => normalizarNome(nome).toLocaleLowerCase('pt-BR');
  const pad = valor => String(valor).padStart(2, '0');

  function chaveLocal(data) {
    const d = data instanceof Date ? data : new Date(data);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function hoje() {
    return chaveLocal(new Date());
  }

  function ontem() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return chaveLocal(d);
  }

  function formatarData(chave) {
    const match = String(chave || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(chave || '');
  }

  function dataSelecionada() {
    return document.getElementById('rdu-data')?.value || hoje();
  }

  function vendasDaData(data = dataSelecionada()) {
    const api = window.PdvRelatorioFinanceiro;
    if (!api || typeof api.vendasDaData !== 'function') return [];
    const vendas = api.vendasDaData(data);
    return Array.isArray(vendas) ? vendas.filter(Boolean) : [];
  }

  function resumoFinanceiro(vendas) {
    const api = window.PdvRelatorioFinanceiro;
    if (api && typeof api.resumir === 'function') return api.resumir(vendas);
    return {
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
    };
  }

  function itensDaVenda(venda) {
    if (Array.isArray(venda?.itens)) return venda.itens.filter(Boolean);
    if (venda?.itens && typeof venda.itens === 'object') return Object.values(venda.itens).filter(Boolean);
    return [];
  }

  function nomeFallbackVenda(venda) {
    const atendentes = Array.isArray(venda?.garconsAtendimento)
      ? venda.garconsAtendimento
      : (venda?.garconsAtendimento && typeof venda.garconsAtendimento === 'object'
        ? Object.values(venda.garconsAtendimento)
        : []);
    return normalizarNome(
      venda?.garcomResponsavel?.nome ||
      venda?.garcomNome ||
      atendentes[0]?.nome ||
      'Não identificado'
    ) || 'Não identificado';
  }

  function resumoGarcons(vendas) {
    const mapa = new Map();
    let vendasComServico = 0;
    let vendasSemServico = 0;

    function obter(nome) {
      const limpo = normalizarNome(nome) || 'Não identificado';
      const chave = chaveNome(limpo) || 'nao-identificado';
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          nome: limpo,
          vendido: 0,
          servico: 0,
          itens: 0,
          mesas: new Set(),
          vendas: new Set()
        });
      }
      return mapa.get(chave);
    }

    vendas.forEach((venda, indiceVenda) => {
      const itens = itensDaVenda(venda);
      const fallback = nomeFallbackVenda(venda);
      const vendaId = String(venda?.id || `${venda?.mesa || 'mesa'}-${venda?.criadoEm || indiceVenda}`);
      const mesa = String(venda?.mesa || '');
      const taxa = Math.max(0, numero(venda?.taxa));
      if (taxa > 0.005) vendasComServico += 1;
      else vendasSemServico += 1;

      const contribuicoes = new Map();
      let somaItens = 0;

      itens.forEach(item => {
        const nome = normalizarNome(item?.garcomLancamento?.nome) || fallback;
        const qtd = Math.max(0, numero(item?.qtd));
        const valor = qtd * numero(item?.preco);
        somaItens += valor;
        const chave = chaveNome(nome) || 'nao-identificado';
        const atual = contribuicoes.get(chave) || { nome, valor: 0, itens: 0 };
        atual.valor += valor;
        atual.itens += qtd;
        contribuicoes.set(chave, atual);
      });

      const subtotalInformado = Number(venda?.subtotal);
      if (Number.isFinite(subtotalInformado) && subtotalInformado > somaItens + 0.01) {
        const diferenca = subtotalInformado - somaItens;
        const chave = chaveNome(fallback) || 'nao-identificado';
        const atual = contribuicoes.get(chave) || { nome: fallback, valor: 0, itens: 0 };
        atual.valor += diferenca;
        contribuicoes.set(chave, atual);
        somaItens += diferenca;
      }

      if (!contribuicoes.size) {
        const subtotal = Number.isFinite(subtotalInformado) ? Math.max(0, subtotalInformado) : Math.max(0, numero(venda?.total) - taxa);
        contribuicoes.set(chaveNome(fallback) || 'nao-identificado', { nome: fallback, valor: subtotal, itens: 0 });
        somaItens = subtotal;
      }

      const baseRateio = [...contribuicoes.values()].reduce((soma, item) => soma + Math.max(0, item.valor), 0);
      contribuicoes.forEach(contribuicao => {
        const linha = obter(contribuicao.nome);
        linha.vendido += contribuicao.valor;
        linha.itens += contribuicao.itens;
        if (mesa) linha.mesas.add(mesa);
        linha.vendas.add(vendaId);
        if (taxa > 0 && baseRateio > 0) linha.servico += taxa * (Math.max(0, contribuicao.valor) / baseRateio);
      });
    });

    const linhas = [...mapa.values()]
      .map(linha => ({
        nome: linha.nome,
        vendido: linha.vendido,
        servico: linha.servico,
        itens: linha.itens,
        mesas: linha.mesas.size,
        vendas: linha.vendas.size
      }))
      .sort((a, b) => b.vendido - a.vendido || a.nome.localeCompare(b.nome, 'pt-BR'));

    return {
      linhas,
      vendasComServico,
      vendasSemServico,
      totalVendido: linhas.reduce((soma, linha) => soma + linha.vendido, 0),
      totalServico: linhas.reduce((soma, linha) => soma + linha.servico, 0)
    };
  }

  function garantirEstilo() {
    if (document.getElementById('rdu-style')) return;
    const style = document.createElement('style');
    style.id = 'rdu-style';
    style.textContent = `
      #rdu-btn{grid-column:1/-1;border:0;border-radius:12px;padding:12px 16px;background:#173d45;color:#fff;font-weight:900;cursor:pointer;box-shadow:0 3px 0 rgba(23,61,69,.2)}
      #rdu-overlay{display:none;position:fixed;inset:0;z-index:2100;background:rgba(12,35,40,.84);align-items:center;justify-content:center;padding:16px}
      #rdu-modal{width:min(980px,100%);max-height:92vh;overflow:auto;background:#f7f5ef;border-radius:18px;padding:18px;box-shadow:0 18px 60px rgba(0,0,0,.35)}
      .rdu-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.rdu-head h2{margin:0;color:#173d45;font-family:Georgia,serif}.rdu-head p{margin:4px 0 0;color:#687678;font-size:.82rem}.rdu-close{border:0;border-radius:9px;padding:8px 12px;background:#e2e8e6;color:#173d45;font-weight:900;cursor:pointer}
      .rdu-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:14px 0;padding:10px;border:1px solid #d7e2df;background:#edf3f1;border-radius:12px}.rdu-controls label{display:flex;flex-direction:column;gap:4px;font-size:.75rem;font-weight:900;color:#234d56}.rdu-controls input{border:1px solid #b8c9c5;border-radius:8px;padding:8px;background:#fff}.rdu-chip,.rdu-action{border:0;border-radius:8px;padding:8px 11px;font-weight:900;cursor:pointer}.rdu-chip{background:#d9e5e2;color:#173d45}.rdu-action{background:#0f4c5c;color:#fff}.rdu-action.sec{background:#536b70}
      .rdu-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:0 0 12px}.rdu-tab{border:1px solid #c8d6d2;border-radius:10px;padding:10px;background:#fff;color:#35565d;font-weight:900;cursor:pointer}.rdu-tab.ativo{background:#173d45;color:#fff;border-color:#173d45}
      .rdu-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.rdu-card{background:#fff;border:1px solid #e0ddcf;border-radius:12px;padding:11px}.rdu-card small{display:block;color:#6b7779;font-weight:800;line-height:1.25}.rdu-card strong{display:block;color:#0f4c5c;font-size:1.16rem;margin-top:4px}.rdu-card.destaque{border-width:2px;border-color:#9bbab3}.rdu-card.alerta strong{color:#a54d2c}
      .rdu-section{margin-top:14px}.rdu-section h3{margin:0 0 8px;color:#173d45;font-size:1rem}.rdu-payments{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.rdu-payment{background:#fff;border:1px solid #e0ddcf;border-radius:10px;padding:10px}.rdu-payment span{display:block;color:#657174;font-size:.78rem;font-weight:800}.rdu-payment strong{display:block;margin-top:3px;color:#173d45}
      .rdu-table-wrap{overflow:auto;background:#fff;border:1px solid #e0ddcf;border-radius:12px}.rdu-table{width:100%;border-collapse:collapse;min-width:650px}.rdu-table th,.rdu-table td{padding:10px;border-bottom:1px solid #eee;text-align:left;font-size:.84rem}.rdu-table th{background:#edf3f1;color:#173d45}.rdu-table td.num,.rdu-table th.num{text-align:right}.rdu-name{font-weight:900;color:#173d45}.rdu-note{margin-top:10px;padding:10px;border-radius:10px;background:#fff;border:1px solid #e0ddcf;color:#657174;font-size:.77rem;line-height:1.45}.rdu-empty{padding:26px;text-align:center;background:#fff;border:1px dashed #c8d4d1;border-radius:12px;color:#657174}
      @media(max-width:760px){.rdu-grid{grid-template-columns:1fr 1fr}.rdu-payments{grid-template-columns:1fr 1fr}.rdu-tabs{grid-template-columns:1fr}.rdu-head{align-items:flex-start}}
      @media(max-width:420px){.rdu-grid,.rdu-payments{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function garantirInterface() {
    garantirEstilo();
    const painel = document.getElementById('painel-diario');
    if (painel && !document.getElementById('rdu-btn')) {
      const botao = document.createElement('button');
      botao.id = 'rdu-btn';
      botao.type = 'button';
      botao.textContent = '📊 Central de Relatórios';
      botao.addEventListener('click', abrir);
      painel.appendChild(botao);
    }

    if (document.getElementById('rdu-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'rdu-overlay';
    overlay.innerHTML = `
      <div id="rdu-modal" role="dialog" aria-modal="true" aria-labelledby="rdu-titulo">
        <div class="rdu-head">
          <div><h2 id="rdu-titulo">Central de Relatórios</h2><p>Resumo financeiro, vendas por garçom e serviço em uma única tela.</p></div>
          <button type="button" class="rdu-close" id="rdu-fechar">Fechar</button>
        </div>
        <div class="rdu-controls">
          <label>Data do relatório<input type="date" id="rdu-data" value="${hoje()}"></label>
          <button type="button" class="rdu-chip" data-rdu-data="hoje">Hoje</button>
          <button type="button" class="rdu-chip" data-rdu-data="ontem">Ontem</button>
          <button type="button" class="rdu-action" id="rdu-detalhes">🧾 Vendas detalhadas</button>
          <button type="button" class="rdu-action sec" id="rdu-imprimir">🖨️ Imprimir fechamento</button>
        </div>
        <div class="rdu-tabs" role="tablist">
          <button type="button" class="rdu-tab ativo" data-rdu-tab="resumo">Resumo do dia</button>
          <button type="button" class="rdu-tab" data-rdu-tab="garcons">Vendas por garçom</button>
          <button type="button" class="rdu-tab" data-rdu-tab="servico">10% / Serviço</button>
        </div>
        <div id="rdu-conteudo"></div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', event => { if (event.target === overlay) fechar(); });
    overlay.querySelector('#rdu-fechar')?.addEventListener('click', fechar);
    overlay.querySelector('#rdu-data')?.addEventListener('change', renderizar);
    overlay.querySelector('[data-rdu-data="hoje"]')?.addEventListener('click', () => definirData(hoje()));
    overlay.querySelector('[data-rdu-data="ontem"]')?.addEventListener('click', () => definirData(ontem()));
    overlay.querySelector('#rdu-detalhes')?.addEventListener('click', abrirDetalhes);
    overlay.querySelector('#rdu-imprimir')?.addEventListener('click', imprimirFechamento);
    overlay.querySelectorAll('[data-rdu-tab]').forEach(botao => botao.addEventListener('click', () => selecionarAba(botao.dataset.rduTab)));
  }

  function definirData(data) {
    const input = document.getElementById('rdu-data');
    if (input) input.value = data;
    renderizar();
  }

  function abaAtual() {
    return document.querySelector('.rdu-tab.ativo')?.dataset.rduTab || 'resumo';
  }

  function selecionarAba(aba) {
    document.querySelectorAll('[data-rdu-tab]').forEach(botao => botao.classList.toggle('ativo', botao.dataset.rduTab === aba));
    renderizar();
  }

  function renderResumo(vendas, resumo) {
    const divergente = Math.abs(numero(resumo.diferencaPagamentos)) > 0.02;
    return `
      <div class="rdu-grid">
        <div class="rdu-card destaque"><small>Total recebido nas vendas</small><strong>${moeda(resumo.total)}</strong></div>
        <div class="rdu-card"><small>Produtos / subtotal</small><strong>${moeda(resumo.subtotal)}</strong></div>
        <div class="rdu-card"><small>10% / serviço</small><strong>${moeda(resumo.taxa)}</strong></div>
        <div class="rdu-card"><small>Vendas finalizadas</small><strong>${vendas.length}</strong></div>
        <div class="rdu-card"><small>Ticket médio</small><strong>${moeda(resumo.ticketMedio)}</strong></div>
        <div class="rdu-card"><small>Dinheiro líquido</small><strong>${moeda(resumo.dinheiroLiquido)}</strong></div>
        <div class="rdu-card"><small>Trocos entregues</small><strong>${moeda(resumo.troco)}</strong></div>
        <div class="rdu-card ${divergente ? 'alerta' : ''}"><small>Conferência dos pagamentos</small><strong>${divergente ? `Dif. ${moeda(resumo.diferencaPagamentos)}` : 'OK'}</strong></div>
      </div>
      <div class="rdu-section"><h3>Formas de pagamento</h3><div class="rdu-payments">
        <div class="rdu-payment"><span>Dinheiro</span><strong>${moeda(resumo.dinheiroLiquido)}</strong></div>
        <div class="rdu-payment"><span>PIX</span><strong>${moeda(resumo.pix)}</strong></div>
        <div class="rdu-payment"><span>Débito</span><strong>${moeda(resumo.debito)}</strong></div>
        <div class="rdu-payment"><span>Crédito</span><strong>${moeda(resumo.credito)}</strong></div>
      </div></div>
      <div class="rdu-note">O total recebido é separado em <strong>produtos</strong> + <strong>serviço</strong>. Em dinheiro, o valor exibido é líquido dos trocos já entregues.</div>`;
  }

  function renderGarcons(resumoGarcom) {
    if (!resumoGarcom.linhas.length) return '<div class="rdu-empty">Nenhuma venda com dados de garçom encontrada nesta data.</div>';
    const linhas = resumoGarcom.linhas.map(item => `
      <tr>
        <td><span class="rdu-name">${escapar(item.nome)}</span></td>
        <td class="num">${item.itens}</td>
        <td class="num">${item.mesas}</td>
        <td class="num">${item.vendas}</td>
        <td class="num"><strong>${moeda(item.vendido)}</strong></td>
        <td class="num"><strong>${moeda(item.servico)}</strong></td>
      </tr>`).join('');
    return `
      <div class="rdu-grid">
        <div class="rdu-card destaque"><small>Produtos atribuídos</small><strong>${moeda(resumoGarcom.totalVendido)}</strong></div>
        <div class="rdu-card"><small>10% gerado</small><strong>${moeda(resumoGarcom.totalServico)}</strong></div>
        <div class="rdu-card"><small>Garçons identificados</small><strong>${resumoGarcom.linhas.filter(x => x.nome !== 'Não identificado').length}</strong></div>
        <div class="rdu-card"><small>Vendas com serviço</small><strong>${resumoGarcom.vendasComServico}</strong></div>
      </div>
      <div class="rdu-section"><div class="rdu-table-wrap"><table class="rdu-table">
        <thead><tr><th>Garçom</th><th class="num">Itens</th><th class="num">Mesas</th><th class="num">Vendas</th><th class="num">Vendido</th><th class="num">10% gerado</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div></div>
      <div class="rdu-note">“Vendido” considera os itens lançados por cada garçom. O <strong>10% gerado</strong> usa o valor real de serviço registrado em cada venda e, quando mais de um garçom participou da mesma mesa, é distribuído proporcionalmente ao valor dos itens de cada um. É um indicador de origem do serviço, não um registro de pagamento ao garçom.</div>`;
  }

  function renderServico(vendas, resumo, resumoGarcom) {
    const media = resumoGarcom.vendasComServico ? numero(resumo.taxa) / resumoGarcom.vendasComServico : 0;
    const percentualEfetivo = numero(resumo.subtotal) > 0 ? (numero(resumo.taxa) / numero(resumo.subtotal)) * 100 : 0;
    const linhas = resumoGarcom.linhas
      .filter(item => item.servico > 0.005)
      .sort((a, b) => b.servico - a.servico)
      .map(item => `<tr><td><span class="rdu-name">${escapar(item.nome)}</span></td><td class="num">${moeda(item.vendido)}</td><td class="num"><strong>${moeda(item.servico)}</strong></td></tr>`)
      .join('');
    return `
      <div class="rdu-grid">
        <div class="rdu-card destaque"><small>Total de serviço registrado</small><strong>${moeda(resumo.taxa)}</strong></div>
        <div class="rdu-card"><small>Vendas com serviço</small><strong>${resumoGarcom.vendasComServico}</strong></div>
        <div class="rdu-card"><small>Vendas sem serviço</small><strong>${resumoGarcom.vendasSemServico}</strong></div>
        <div class="rdu-card"><small>Média de serviço por venda</small><strong>${moeda(media)}</strong></div>
        <div class="rdu-card"><small>Base em produtos</small><strong>${moeda(resumo.subtotal)}</strong></div>
        <div class="rdu-card"><small>Percentual efetivo</small><strong>${percentualEfetivo.toFixed(1).replace('.', ',')}%</strong></div>
        <div class="rdu-card"><small>Total com serviço</small><strong>${moeda(resumo.total)}</strong></div>
        <div class="rdu-card"><small>Vendas da data</small><strong>${vendas.length}</strong></div>
      </div>
      <div class="rdu-section"><h3>Origem do serviço por garçom</h3>${linhas ? `<div class="rdu-table-wrap"><table class="rdu-table"><thead><tr><th>Garçom</th><th class="num">Produtos atribuídos</th><th class="num">Serviço gerado</th></tr></thead><tbody>${linhas}</tbody></table></div>` : '<div class="rdu-empty">Nenhum valor de serviço foi registrado nesta data.</div>'}</div>
      <div class="rdu-note">Esta tela usa a <strong>taxa realmente registrada nas vendas</strong>; não presume que toda venda tenha exatamente 10%. Assim, uma conta sem serviço ou com valor diferente aparece corretamente no total.</div>`;
  }

  function renderizar() {
    const conteudo = document.getElementById('rdu-conteudo');
    if (!conteudo) return;
    if (!window.PdvRelatorioFinanceiro) {
      conteudo.innerHTML = '<div class="rdu-empty">O relatório financeiro ainda está carregando. Feche e abra a Central de Relatórios novamente.</div>';
      return;
    }
    const vendas = vendasDaData();
    const resumo = resumoFinanceiro(vendas);
    const garcons = resumoGarcons(vendas);
    const aba = abaAtual();
    if (aba === 'garcons') conteudo.innerHTML = renderGarcons(garcons);
    else if (aba === 'servico') conteudo.innerHTML = renderServico(vendas, resumo, garcons);
    else conteudo.innerHTML = renderResumo(vendas, resumo);
  }

  function abrir() {
    garantirInterface();
    definirData(hoje());
    selecionarAba('resumo');
    const overlay = document.getElementById('rdu-overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  function fechar() {
    const overlay = document.getElementById('rdu-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function sincronizarDataRelatorioAntigo() {
    const input = document.getElementById('relatorio-financeiro-data');
    if (input) input.value = dataSelecionada();
  }

  function abrirDetalhes() {
    sincronizarDataRelatorioAntigo();
    fechar();
    if (typeof window.abrirModalHistorico === 'function') window.abrirModalHistorico();
    else alert('O histórico detalhado ainda não está disponível.');
  }

  function imprimirFechamento() {
    sincronizarDataRelatorioAntigo();
    if (typeof window.imprimirRelatorioCaixa === 'function') window.imprimirRelatorioCaixa();
    else alert('A impressão do relatório ainda não está disponível.');
  }

  window.PdvCentralRelatorios = Object.freeze({
    runtime: RUNTIME,
    abrir,
    fechar,
    vendasDaData,
    resumoGarcons,
    dataSelecionada
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', garantirInterface, { once: true });
  else garantirInterface();
})();
