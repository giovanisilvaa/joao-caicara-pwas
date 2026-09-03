import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const hub = fs.readFileSync('client/public/pdv/cash-hub-v1.js', 'utf8');
const sw = fs.readFileSync('client/public/pdv/service-worker.js', 'utf8');

describe('central visual do caixa no PDV', () => {
  it('cria atalhos compactos de Relatórios e Caixa', () => {
    expect(hub).toContain("barra.id = 'pdv-atalhos-gestao'");
    expect(hub).toContain("caixa.id = 'pdv-caixa-btn'");
    expect(hub).toContain("relatorios.textContent = '📊 Relatórios'");
    expect(hub).toContain("'💰 Caixa · Aberto'");
  });

  it('retira da tela principal somente componentes visuais do caixa', () => {
    expect(hub).toContain("mover(conteudo, '#painel-diario .indicador-diario.vendas')");
    expect(hub).toContain("mover(conteudo, '#pdv-cash-session')");
    expect(hub).toContain("mover(conteudo, '#pdv-cash-session-totals')");
    expect(hub).toContain("mover(conteudo, '#pcsh-btn')");
    expect(hub).not.toContain("indicador-diario.mesas'");
  });

  it('preserva os componentes originais em vez de duplicar cálculos financeiros', () => {
    expect(hub).toContain('conteudo.appendChild(elemento)');
    expect(hub).not.toContain("firebase.database");
    expect(hub).not.toContain("database.ref(");
    expect(hub).not.toContain("transaction(");
  });

  it('mantém acessível o histórico pelo botão original dentro da central', () => {
    expect(hub).toContain("mover(conteudo, '#pcsh-btn')");
    expect(hub).toContain('Sessão atual, vendas, movimento financeiro e histórico em uma única tela.');
  });

  it('é publicado pelo service worker do PDV com cache próprio', () => {
    expect(sw).toContain("CASH_HUB_ASSET = '/pdv/cash-hub-v1.js?v=1'");
    expect(sw).toContain('CASH_HUB_ASSET');
    expect(sw).toContain('<script src="/pdv/cash-hub-v1.js?v=1"></script>');
  });
});
