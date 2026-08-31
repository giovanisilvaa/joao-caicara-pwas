import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('restrições operacionais do Garçom', () => {
  it('permite reduzir quantidade antes do envio e bloqueia somente item já enviado', () => {
    const src = read('client/public/garcom/restricoes-operacionais.js');
    expect(src).toContain("item?.enviado === true");
    expect(src).toContain('Number(delta) < 0');
    expect(src).toContain('Depois de enviado à produção');
    expect(src).toContain('podeReduzirAntesEnvio: true');
  });

  it('permite somar o mesmo item pendente na mesma linha antes do envio', () => {
    const src = read('client/public/garcom/restricoes-operacionais.js');
    expect(src).toContain('item.enviado !== true');
    expect(src).toContain('!item.envioPendenteId');
    expect(src).toContain('window.alterarQtdG(index, 1)');
    expect(src).toContain('podeSomarMesmoItemAntesEnvio: true');
  });

  it('bloqueia limpeza de comanda no Garçom', () => {
    const src = read('client/public/garcom/restricoes-operacionais.js');
    expect(src).toContain('window.limparComandaG = protegidaLimpeza');
    expect(src).toContain('Limpar mesa é uma operação exclusiva do caixa/PDV.');
  });

  it('permite fechar a mesa operacionalmente usando o fechamento em duas etapas', () => {
    const src = read('client/public/garcom/restricoes-operacionais.js');
    expect(src).toContain("mesaAtual()?.estadoConta === 'aguardando_pagamento'");
    expect(src).toContain("typeof staged.fecharParaConferencia !== 'function'");
    expect(src).toContain('return staged.fecharParaConferencia.apply(this, args)');
    expect(src).toContain('podeFecharMesa: true');
  });

  it('impede o Garçom de finalizar pagamento e liberar a mesa', () => {
    const src = read('client/public/garcom/restricoes-operacionais.js');
    expect(src).toContain('window.confirmarFechamentoG = bloquearFinalizacao');
    expect(src).toContain('somente o caixa/PDV pode finalizar o pagamento e liberar a mesa');
    expect(src).toContain('podeFinalizarPagamento: false');
    expect(src).toContain('finalizacaoExclusivaPdv: true');
  });

  it('remove a ação de finalizar do Garçom quando a mesa aguarda o PDV', () => {
    const src = read('client/public/garcom/restricoes-operacionais.js');
    expect(src).toContain('.staged-finalize{display:none!important}');
    expect(src).toContain("content:'AGUARDANDO PDV'");
    expect(src).toContain('Pagamento e liberação da mesa: somente no PDV.');
    expect(src).toContain('Esta mesa já está fechada e aguardando pagamento.');
  });

  it('mantém os botões de quantidade visíveis e oculta apenas ações proibidas', () => {
    const src = read('client/public/garcom/restricoes-operacionais.js');
    expect(src).toContain('.btn-limpar-g{display:none!important}');
    expect(src).not.toContain('button[onclick*="alterarQtdG"][onclick*="-1"]{display:none');
  });

  it('não toca diretamente em Firebase, mesas ou vendas', () => {
    const src = read('client/public/garcom/restricoes-operacionais.js');
    expect(src).not.toContain('db.ref(');
    expect(src).not.toContain('firebase.database');
    expect(src).not.toContain('/vendas');
    expect(src).not.toContain('/mesas');
  });
});
