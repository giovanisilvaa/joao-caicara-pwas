import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('compatibilidade do fechamento em duas etapas com taxa do Garçom', () => {
  it('observa qualquer abertura do modal, inclusive pelo botão Finalizar pagamento', () => {
    const src = read('client/public/garcom/garcom-service-fee.js');
    expect(src).toContain('function observarAberturaModal()');
    expect(src).toContain("observer.observe(overlay, { attributes: true, attributeFilter: ['style', 'class'] })");
    expect(src).toContain('if (aberto && !estavaAberto) setTimeout(prepararModalPagamento, 0)');
  });

  it('recalcula os 10% e o valor recebido antes da confirmação', () => {
    const src = read('client/public/garcom/garcom-service-fee.js');
    expect(src).toContain('function prepararModalPagamento()');
    expect(src).toContain('taxaAtiva = true');
    expect(src).toContain('atualizarValores()');
    expect(src).toContain('recebido.value = total.toFixed(2)');
  });

  it('não toca em mesas, vendas ou Firebase para corrigir a abertura do modal', () => {
    const src = read('client/public/garcom/garcom-service-fee.js');
    expect(src).not.toContain("db.ref('mesas')");
    expect(src).not.toContain("db.ref('vendas')");
    expect(src).not.toContain("firebase.database().ref('mesas')");
  });
});
