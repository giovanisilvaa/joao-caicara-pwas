/* Zeragem operacional do caixa sem apagar vendas do Firebase. */
(() => {
  const CHAVE_CORTE = 'joao_caicara_caixa_zerado_em';
  const moeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const corteAtual = () => Number(localStorage.getItem(CHAVE_CORTE) || 0);
  const ehHoje = ts => {
    const d = new Date(Number(ts) || 0), h = new Date();
    return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth() && d.getDate() === h.getDate();
  };

  async function vendasDesdeZeragem() {
    const snap = await firebase.database().ref('vendas').once('value');
    const vendas = [];
    snap.forEach(child => { const v = child.val(); if (v) vendas.push(v); });
    const corte = corteAtual();
    return vendas.filter(v => {
      const ts = Number(v.criadoEm) || 0;
      return ehHoje(ts) && ts > corte;
    }).sort((a, b) => (Number(b.criadoEm) || 0) - (Number(a.criadoEm) || 0));
  }

  async function renderizarCaixaZeravel() {
    const lista = document.getElementById('lista-historico');
    if (!lista) return;
    const filtro = String(document.getElementById('filtro-historico')?.value || '').toLowerCase();
    const vendas = await vendasDesdeZeragem();
    const totais = vendas.reduce((a, v) => {
      const p = v.pagamentos || {};
      a.dinheiro += Number(p.dinheiro) || 0; a.pix += Number(p.pix) || 0;
      a.credito += Number(p.credito) || 0; a.debito += Number(p.debito) || 0;
      a.total += Number(v.total) || 0; a.troco += Number(v.troco) || 0; a.taxa += Number(v.taxa) || 0;
      return a;
    }, { dinheiro:0, pix:0, credito:0, debito:0, total:0, troco:0, taxa:0 });
    const ids = { 'rep-dinheiro':totais.dinheiro, 'rep-pix':totais.pix, 'rep-credito':totais.credito, 'rep-debito':totais.debito, 'rep-total':totais.total, 'rep-troco':totais.troco, 'rep-taxa-servico':totais.taxa };
    Object.entries(ids).forEach(([id, valor]) => { const el=document.getElementById(id); if(el) el.innerText=moeda(valor); });
    const filtradas = vendas.filter(v => !filtro || String(v.mesa || '').includes(filtro) || String(v.cliente || '').toLowerCase().includes(filtro));
    if (!filtradas.length) { lista.innerHTML='<p style="text-align:center;color:#777;padding:16px;">Nenhuma venda após a última zeragem do caixa.</p>'; return; }
    lista.innerHTML = filtradas.map(v => {
      const itens=(v.itens||[]).map(i=>`${Number(i.qtd)||0}x ${i.nome||''} (${moeda(i.preco)})`).join(', ');
      const p=v.pagamentos||{}, pg=[];
      if(Number(p.dinheiro)>0) pg.push(`Dinheiro: ${moeda(p.dinheiro)}`); if(Number(p.pix)>0) pg.push(`PIX: ${moeda(p.pix)}`);
      if(Number(p.credito)>0) pg.push(`Crédito: ${moeda(p.credito)}`); if(Number(p.debito)>0) pg.push(`Débito: ${moeda(p.debito)}`);
      return `<div class="history-card"><header><span>Mesa ${v.mesa} (${v.cliente||'Não informado'})</span><span>${v.dataHora||new Date(v.criadoEm||0).toLocaleString('pt-BR')}</span></header><div><strong>Itens:</strong> ${itens}</div><div style="color:#555"><strong>Pgto:</strong> ${pg.join(' | ')}</div>${Number(v.taxa)>0?`<div style="color:#555;font-size:.85rem">Subtotal: ${moeda(v.subtotal)} + Taxa 10%: ${moeda(v.taxa)}</div>`:''}<div style="display:flex;justify-content:space-between;font-weight:bold;color:var(--primary)"><span>Total: ${moeda(v.total)}</span><span>Troco: ${moeda(v.troco)}</span></div></div>`;
    }).join('');
  }

  async function zerarCaixa() {
    if (!confirm('Zerar o caixa a partir de agora? As vendas continuarão guardadas no Firebase para auditoria e backup.')) return;
    const agora = Date.now();
    localStorage.setItem(CHAVE_CORTE, String(agora));
    try { await firebase.database().ref('auditoria').push({ acao:'zerar_caixa', origem:'pdv', funcionario:'administrador', detalhes:{ corteEm:agora }, criadoEm:agora }); } catch (_) {}
    await renderizarCaixaZeravel();
    alert('Caixa zerado. As vendas anteriores continuam preservadas no histórico do Firebase.');
  }

  function instalar() {
    // Mantém a função legada disponível, mas não observa nem redesenha automaticamente
    // o modal de vendas. O relatório financeiro v29 é a fonte visual autoritativa.
    window.limparHistoricoGeral = zerarCaixa;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',instalar,{once:true}); else instalar();
  window.PdvCaixaZeravel = Object.freeze({ renderizar:renderizarCaixaZeravel, zerar:zerarCaixa, corteAtual });
})();
