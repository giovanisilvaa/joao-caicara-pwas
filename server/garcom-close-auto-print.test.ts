import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('impressao automatica do fechamento feito pelo garcom', () => {
  it('garcom continua registrando a venda completa antes de liberar a mesa', () => {
    const garcom = read('client/public/garcom/mesa-concurrency.js');
    expect(garcom).toContain("origem: 'garcom'");
    expect(garcom).toContain('pagamentos');
    expect(garcom).toContain('troco');
    expect(garcom).toContain('vendas/${vendaRef.key}');
    expect(garcom).toContain('mesas/${numero}');
  });

  it('pdv observa vendas autenticado e imprime somente fechamentos do garcom', () => {
    const auto = read('client/public/pdv/pdv-auto-close-print.js');
    expect(auto).toContain("PDV_AUTO_CLOSE_RUNTIME === 'v1'");
    expect(auto).toContain("venda.origem !== 'garcom'");
    expect(auto).toContain("firebase.auth().onAuthStateChanged");
    expect(auto).toContain("db.ref('vendas')");
    expect(auto).toContain("refVendas.once('value')");
    expect(auto).toContain("refVendas.on('child_added'");
    expect(auto).toContain('impressaoFechamentoPdv');
    expect(auto).toContain('.transaction(atual =>');
    expect(auto).toContain("document.body.classList.add('print-mode-caixa')");
    expect(auto).toContain('window.print()');
    expect(auto).toContain('fechamentoImpressoNoPdv: true');
  });

  it('nao reimprime vendas antigas anteriores a ativacao da funcionalidade', () => {
    const auto = read('client/public/pdv/pdv-auto-close-print.js');
    expect(auto).toContain("CHECKPOINT_KEY = 'joao_caicara_auto_close_activation_v1'");
    expect(auto).toContain('Number(venda.criadoEm || 0) >= ativadoEm');
  });

  it('service worker carrega o fechamento automatico depois da producao automatica', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain('pdv-auto-close-print.js?v=1');
    expect(sw.indexOf('/pdv/pdv-auto-close-print.js')).toBeGreaterThan(sw.indexOf('/pdv/pdv-auto-production-print.js'));
  });
});
