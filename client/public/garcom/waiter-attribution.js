/* Atribuição operacional do Garçom — nome da sessão acompanha mesa e itens sem alterar a produção. */
(() => {
  const sessaoAtual = () => {
    try { return typeof window.sessaoGarcomAtual === 'function' ? window.sessaoGarcomAtual() : null; }
    catch (_) { return null; }
  };

  const identidadeAtual = () => {
    const sessao = sessaoAtual() || {};
    const nome = String(sessao.nome || '').trim();
    if (!nome || nome === 'Acesso temporário') return null;
    return {
      nome,
      login: sessao.login || 'garcom',
      uid: sessao.uid || sessao.funcionarioId || null,
      compartilhado: sessao.compartilhado === true
    };
  };

  function aplicarResponsavelNaMesa(mesa) {
    const identidade = identidadeAtual();
    if (!mesa || !identidade) return mesa;
    if (!mesa.garcomResponsavel || !String(mesa.garcomResponsavel.nome || '').trim()) {
      mesa.garcomResponsavel = { ...identidade, atribuidoEm: Date.now() };
    }
    return mesa;
  }

  function registrarAtendimentoNaMesa(mesa, identidade = identidadeAtual()) {
    if (!mesa || !identidade) return mesa;
    const atuais = Array.isArray(mesa.garconsAtendimento) ? mesa.garconsAtendimento.filter(Boolean) : [];
    const chave = `${String(identidade.nome || '').trim().toLocaleLowerCase('pt-BR')}|${identidade.uid || ''}`;
    const existe = atuais.some(item => `${String(item?.nome || '').trim().toLocaleLowerCase('pt-BR')}|${item?.uid || ''}` === chave);
    if (!existe) atuais.push({ ...identidade, primeiroAtendimentoEm: Date.now() });
    mesa.garconsAtendimento = atuais;
    return mesa;
  }

  const adicionarOriginal = window.adicionarItemG;
  if (typeof adicionarOriginal === 'function') {
    window.adicionarItemG = function adicionarItemComGarcom(produtoId) {
      if (!mesaSelecionada || !mesas[mesaSelecionada]) return adicionarOriginal.apply(this, arguments);
      const identidade = identidadeAtual();
      aplicarResponsavelNaMesa(mesas[mesaSelecionada]);
      registrarAtendimentoNaMesa(mesas[mesaSelecionada], identidade);

      if (!identidade) return adicionarOriginal.apply(this, arguments);
      const produtoBase = produtos.find(p => p.id === produtoId);
      if (!produtoBase) return adicionarOriginal.apply(this, arguments);
      const dadosMesa = mesas[mesaSelecionada];
      if (dadosMesa.itens.length === 0) dadosMesa.abertura = Date.now();

      const itemJaExiste = dadosMesa.itens.find(it =>
        it.id === produtoId &&
        it.preco === produtoBase.preco &&
        !it.obs &&
        it.enviado === false &&
        String(it.garcomLancamento?.nome || '') === identidade.nome
      );

      if (itemJaExiste) {
        itemJaExiste.qtd++;
        itemJaExiste.garcomUltimoLancamento = { ...identidade, em: Date.now() };
      } else {
        dadosMesa.itens.push({
          ...produtoBase,
          qtd: 1,
          obs: '',
          enviado: false,
          rascunho: true,
          garcomLancamento: { ...identidade, em: Date.now() }
        });
      }
      salvarMesas();
      renderizarComandaG();
      if (!comandaAberta) {
        const toggle = document.getElementById('comanda-toggle');
        if (toggle) {
          toggle.style.background = 'var(--success)';
          setTimeout(() => { toggle.style.background = 'var(--accent)'; }, 400);
        }
      }
    };
  }

  const renderizarOriginal = window.renderizarComandaG;
  if (typeof renderizarOriginal === 'function') {
    window.renderizarComandaG = function renderizarComandaComAtendimento() {
      const retorno = renderizarOriginal.apply(this, arguments);
      const dadosMesa = mesaSelecionada ? mesas[mesaSelecionada] : null;
      const abriu = dadosMesa?.garcomResponsavel?.nome || '';
      const atendentesRegistrados = Array.isArray(dadosMesa?.garconsAtendimento)
        ? dadosMesa.garconsAtendimento.map(item => String(item?.nome || '').trim()).filter(Boolean)
        : [];
      const atendentesItens = Array.isArray(dadosMesa?.itens)
        ? dadosMesa.itens.map(item => String(item?.garcomLancamento?.nome || '').trim()).filter(Boolean)
        : [];
      const atendentes = [...new Set([...atendentesRegistrados, ...atendentesItens])];

      let faixa = document.getElementById('garcom-responsavel-comanda');
      if (!faixa) {
        const clienteRow = document.querySelector('#tela-pedido .cliente-row');
        if (clienteRow) {
          faixa = document.createElement('div');
          faixa.id = 'garcom-responsavel-comanda';
          faixa.style.cssText = 'padding:6px 12px;background:#eef5f2;border-bottom:1px solid #d8e2df;font-size:.78rem;font-weight:800;color:#123e48;line-height:1.45;';
          clienteRow.insertAdjacentElement('afterend', faixa);
        }
      }
      if (faixa) {
        const abertaPor = abriu || 'não identificado';
        const atendidaPor = atendentes.length ? atendentes.join(', ') : abertaPor;
        faixa.innerHTML = `<div>Mesa aberta por: ${abertaPor}</div><div>Atendida por: ${atendidaPor}</div>`;
      }
      return retorno;
    };
  }

  window.GarcomAtribuicao = Object.freeze({ identidadeAtual, aplicarResponsavelNaMesa, registrarAtendimentoNaMesa });
})();
