import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const hub = fs.readFileSync('client/public/pdv/management-hub-v1.js', 'utf8');
const sw = fs.readFileSync('client/public/pdv/service-worker.js', 'utf8');

describe('central compacta de Gestão do PDV', () => {
  it('cria um único acesso Gestão no resumo diário', () => {
    expect(hub).toContain("botao.id = 'pdv-gestao-btn'");
    expect(hub).toContain("botao.textContent = '☰ Gestão'");
    expect(hub).toContain("painel.classList.add('pdv-gestao-compacto')");
    expect(hub).toContain("titulo.appendChild(botao)");
  });

  it('retira os três atalhos grandes da tela principal sem remover suas funções', () => {
    expect(hub).toContain('#pdv-atalhos-gestao,');
    expect(hub).toContain('#painel-diario > #btn-relatorio-garcons,');
    expect(hub).toContain('#painel-diario > #rdu-btn,');
    expect(hub).toContain('#painel-diario > #pdv-caixa-btn{');
    expect(hub).toContain("abrirOriginal('rdu-btn', 'Relatórios')");
    expect(hub).toContain("abrirOriginal('btn-relatorio-garcons', 'Vendas por Garçom')");
    expect(hub).toContain("abrirOriginal('pdv-caixa-btn', 'Caixa')");
    expect(hub).toContain('original.click()');
    expect(hub).not.toContain('.remove()');
  });

  it('mantém Mesas abertas visível e compacta o painel em uma linha', () => {
    expect(hub).toContain("grid-template-columns:minmax(0,1fr) auto!important");
    expect(hub).toContain('#painel-diario.pdv-gestao-compacto .indicador-diario.mesas');
    expect(hub).toContain('display:inline-flex!important');
    expect(hub).toContain('border-radius:999px!important');
    expect(hub).not.toContain('.indicador-diario.mesas{display:none');
  });

  it('centraliza Relatórios, Vendas por Garçom e Caixa em um modal leve', () => {
    expect(hub).toContain('id="pdv-gestao-overlay"');
    expect(hub).toContain('id="pdv-gestao-relatorios"');
    expect(hub).toContain('id="pdv-gestao-garcons"');
    expect(hub).toContain('id="pdv-gestao-caixa"');
    expect(hub).toContain('Relatórios, vendas por garçom e caixa fora da área principal de atendimento.');
  });

  it('reflete o estado aberto do Caixa sem recriar a lógica financeira', () => {
    expect(hub).toContain("originalCaixa?.classList.contains('aberto')");
    expect(hub).toContain("'💰 Caixa · Aberto'");
    expect(hub).toContain('Sessão aberta · movimento e histórico.');
  });

  it('é apenas uma camada visual e não acessa Firebase nem dados operacionais', () => {
    expect(hub).not.toContain('firebase');
    expect(hub).not.toContain('database.ref');
    expect(hub).not.toContain('db.ref');
    expect(hub).not.toContain('pedidosProducao');
    expect(hub).not.toContain('vendas/');
    expect(hub).not.toContain('mesas/');
    expect(hub).not.toContain('window.print');
  });

  it('publica a camada pelo service worker com cache novo do PDV', () => {
    expect(sw).toContain('cashhub-v46-management-v47');
    expect(sw).toContain("const MANAGEMENT_HUB_ASSET = '/pdv/management-hub-v1.js?v=1'");
    expect(sw).toContain('MANAGEMENT_HUB_ASSET');
    expect(sw).toContain("if (!html.includes('/pdv/management-hub-v1.js'))");
    expect(sw).toContain('<script src="/pdv/management-hub-v1.js?v=1"></script>');
  });
});
