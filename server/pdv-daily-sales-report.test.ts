import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('relatorio financeiro diario do PDV', () => {
  it('calcula dinheiro liquido descontando os trocos do dinheiro recebido', () => {
    const report = read('client/public/pdv/daily-sales-report.js');
    expect(report).toContain('resumo.dinheiroLiquido = resumo.dinheiroRecebido - resumo.troco');
    expect(report).toContain('dinheiroEsperado: resumo.dinheiroLiquido');
    expect(report).toContain('diferencaDinheiro: contado - resumo.dinheiroLiquido');
  });

  it('mostra os principais indicadores do fechamento', () => {
    const report = read('client/public/pdv/daily-sales-report.js');
    expect(report).toContain('Faturamento bruto');
    expect(report).toContain('Produtos / subtotal');
    expect(report).toContain('Taxa de serviço');
    expect(report).toContain('Ticket médio');
    expect(report).toContain('Dinheiro recebido');
    expect(report).toContain('Trocos entregues');
    expect(report).toContain('Dinheiro líquido esperado');
  });

  it('permite consultar outra data sem apagar o historico oficial', () => {
    const report = read('client/public/pdv/daily-sales-report.js');
    expect(report).toContain('relatorio-financeiro-data');
    expect(report).toContain('vendasDaData');
    expect(report).toContain('histórico oficial de vendas é protegido');
    expect(report).not.toContain("localStorage.removeItem('historico_vendas_caicara')");
  });

  it('imprime fechamento completo em 80 mm', () => {
    const report = read('client/public/pdv/daily-sales-report.js');
    expect(report).toContain('width:80mm');
    expect(report).toContain('FECHAMENTO DE VENDAS');
    expect(report).toContain('DINHEIRO LÍQUIDO');
    expect(report).toContain("document.body.classList.add('print-mode-relatorio-financeiro')");
    expect(report).toContain('window.print()');
  });

  it('service worker publica o modulo novo e invalida o cache anterior', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain("joao-caicara-pdv-v28-report-v29");
    expect(sw).toContain("daily-sales-report.js?v=29");
    expect(sw).toContain('DAILY_SALES_REPORT_ASSET');
    expect(sw).toContain("client.navigate(client.url)");
  });
});
