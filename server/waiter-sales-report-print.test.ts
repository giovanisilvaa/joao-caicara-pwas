import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('impressao do relatorio de vendas por garcom', () => {
  it('adiciona botao de imprimir no modal do relatorio', () => {
    const report = read('client/public/pdv/waiter-sales-report.js');
    expect(report).toContain('relatorio-garcons-imprimir');
    expect(report).toContain('🖨️ Imprimir');
    expect(report).toContain("addEventListener('click', imprimirRelatorio)");
  });

  it('gera cupom termico de 80 mm e usa o fluxo de impressao do navegador', () => {
    const report = read('client/public/pdv/waiter-sales-report.js');
    expect(report).toContain('relatorio-garcons-print');
    expect(report).toContain('width:80mm');
    expect(report).toContain("document.body.classList.add('print-mode-relatorio-garcons')");
    expect(report).toContain('window.print()');
    expect(report).toContain('VENDAS POR GARÇOM');
    expect(report).toContain('Taxa de serviço não incluída');
  });

  it('mantem o calculo por autoria do item e expoe a impressao pela API do relatorio', () => {
    const report = read('client/public/pdv/waiter-sales-report.js');
    expect(report).toContain('garcomLancamento');
    expect(report).toContain('qtd * preco');
    expect(report).toContain('imprimir: imprimirRelatorio');
  });

  it('service worker força a versao nova do relatorio', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain('waiter-sales-report.js?v=28');
  });
});
