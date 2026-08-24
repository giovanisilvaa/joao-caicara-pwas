/* Taxa de serviço por turno no relatório diário do PDV. Usa fechamentos de caixa como limites dos turnos. */
(() => {
  let fechamentosHoje = [];

  const moedaTurno = valor => (typeof formatarMoeda === 'function'
    ? formatarMoeda(Number(valor) || 0)
    : `R$ ${(Number(valor) || 0).toFixed(2).replace('.', ',')}`);

  const escaparTurno = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[caractere]));

  function inicioDoDia() {
    const data = new Date();
    data.setHours(0, 0, 0, 0);
    return data.getTime();
  }

  function fimDoDia() {
    const data = new Date();
    data.setHours(23, 59, 59, 999);
    return data.getTime();
  }

  function timestampVenda(venda) {
    const criado = Number(venda?.criadoEm);
    if (Number.isFinite(criado) && criado > 0) return criado;
    const texto = String(venda?.dataHora || '').trim();
    const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6] || 0)).getTime();
    const parsed = new Date(texto).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function vendasHoje() {
    try {
      if (typeof obterVendasDoDiaPdv === 'function') return obterVendasDoDiaPdv();
      const fonte = typeof vendasCacheDiario !== 'undefined' && Array.isArray(vendasCacheDiario) ? vendasCacheDiario : [];
      return typeof vendaEhDeHoje === 'function' ? fonte.filter(vendaEhDeHoje) : fonte;
    } catch (_) { return []; }
  }

  function gerarResumoTurnos() {
    const vendas = vendasHoje().slice().sort((a, b) => timestampVenda(a) - timestampVenda(b));
    const limites = fechamentosHoje
      .map(f => Number(f?.fechadoEm) || 0)
      .filter(ts => ts >= inicioDoDia() && ts <= fimDoDia())
      .sort((a, b) => a - b);

    const turnos = [];
    let inicio = inicioDoDia();

    limites.forEach((fim, indice) => {
      const vendasTurno = vendas.filter(v => {
        const ts = timestampVenda(v);
        return ts >= inicio && ts <= fim;
      });
      turnos.push({
        numero: indice + 1,
        aberto: false,
        inicio,
        fim,
        vendas: vendasTurno.length,
        subtotal: vendasTurno.reduce((soma, v) => soma + (Number(v?.subtotal) || 0), 0),
        taxa: vendasTurno.reduce((soma, v) => soma + (Number(v?.taxa) || 0), 0)
      });
      inicio = fim + 1;
    });

    const vendasAtuais = vendas.filter(v => timestampVenda(v) >= inicio && timestampVenda(v) <= fimDoDia());
    if (vendasAtuais.length || !turnos.length) {
      turnos.push({
        numero: turnos.length + 1,
        aberto: true,
        inicio,
        fim: Date.now(),
        vendas: vendasAtuais.length,
        subtotal: vendasAtuais.reduce((soma, v) => soma + (Number(v?.subtotal) || 0), 0),
        taxa: vendasAtuais.reduce((soma, v) => soma + (Number(v?.taxa) || 0), 0)
      });
    }

    return {
      turnos,
      totalTaxa: vendas.reduce((soma, v) => soma + (Number(v?.taxa) || 0), 0),
      totalSubtotal: vendas.reduce((soma, v) => soma + (Number(v?.subtotal) || 0), 0)
    };
  }

  function hora(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderizarTaxaTurnos() {
    const conteudo = document.getElementById('relatorio-garcons-conteudo');
    if (!conteudo) return;
    document.getElementById('rg-taxas-turno')?.remove();

    const resumo = gerarResumoTurnos();
    const secao = document.createElement('section');
    secao.id = 'rg-taxas-turno';
    secao.style.cssText = 'margin-top:14px;background:#fff;border:1px solid #e0ddcf;border-radius:10px;padding:12px;';

    const linhas = resumo.turnos.map(turno => `
      <tr>
        <td><strong>Turno ${turno.numero}${turno.aberto ? ' · atual' : ''}</strong></td>
        <td>${escaparTurno(hora(turno.inicio))}–${escaparTurno(hora(turno.fim))}</td>
        <td>${turno.vendas}</td>
        <td>${moedaTurno(turno.subtotal)}</td>
        <td><strong>${moedaTurno(turno.taxa)}</strong></td>
      </tr>`).join('');

    secao.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:end;gap:10px;margin-bottom:10px;">
        <div><strong style="color:#0f4c5c;font-family:Georgia,serif;font-size:1.05rem;">10% por turno</strong><div style="font-size:.74rem;color:#657174;margin-top:2px;">Fundo coletivo para divisão entre os garçons</div></div>
        <div style="text-align:right;"><small style="display:block;color:#657174;font-weight:700;">TOTAL 10% DO DIA</small><strong style="font-family:Georgia,serif;color:#2a9d8f;font-size:1.3rem;">${moedaTurno(resumo.totalTaxa)}</strong></div>
      </div>
      <div style="overflow:auto;">
        <table class="rg-table">
          <thead><tr><th>Turno</th><th>Horário</th><th>Vendas</th><th>Vendido</th><th>10%</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
      <div class="rg-note" style="margin-top:9px;">Os turnos são separados pelos fechamentos de caixa registrados no dia. O valor de 10% soma somente a taxa de serviço efetivamente cobrada em cada venda. O turno ainda não fechado aparece como <strong>atual</strong>.</div>`;

    conteudo.appendChild(secao);
  }

  function observarRelatorio() {
    document.addEventListener('click', event => {
      if (event.target?.id === 'btn-relatorio-garcons') setTimeout(renderizarTaxaTurnos, 0);
    });
  }

  function carregarFechamentos() {
    try {
      if (typeof db === 'undefined' || !db?.ref) return;
      db.ref('fechamentosCaixa').on('value', snapshot => {
        const hoje = typeof chaveDataPainel === 'function' ? chaveDataPainel(new Date()) : new Date().toISOString().slice(0, 10);
        const lista = [];
        snapshot.forEach(child => {
          const valor = child.val();
          if (!valor) return;
          const ts = Number(valor.fechadoEm) || 0;
          const ehHoje = valor.data === hoje || (ts >= inicioDoDia() && ts <= fimDoDia());
          if (ehHoje) lista.push(valor);
        });
        fechamentosHoje = lista.sort((a, b) => (Number(a.fechadoEm) || 0) - (Number(b.fechadoEm) || 0));
        if (document.getElementById('relatorio-garcons-overlay')?.style.display === 'flex') renderizarTaxaTurnos();
      });
    } catch (erro) {
      console.warn('Não foi possível carregar fechamentos para o relatório de 10%:', erro);
    }
  }

  window.RelatorioTaxaServicoTurnos = Object.freeze({ gerarResumo: gerarResumoTurnos, renderizar: renderizarTaxaTurnos });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { observarRelatorio(); carregarFechamentos(); }, { once: true });
  } else {
    observarRelatorio();
    carregarFechamentos();
  }
})();
