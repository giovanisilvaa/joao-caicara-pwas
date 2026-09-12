import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Rodízio seletivo do Garçom', () => {
  it('cobra o Rodízio por pessoa sem enviar a cobrança para a produção', () => {
    const atomic = read('client/public/mesa-atomic.js');
    const fluxo = read('client/public/garcom/rodizio-seletivo-v1.js');

    expect(atomic).toContain('async function adicionarCobranca');
    expect(atomic).toContain('somenteCobranca: true');
    expect(atomic).toContain('enviado: true');
    expect(atomic).toContain('rascunho: false');
    expect(fluxo).toContain('RODIZIO_ID = 9301');
    expect(fluxo).toContain('somenteCobrancaRodizio: true');
    expect(fluxo).toContain('MesaAtomic.adicionarCobranca');
    expect(fluxo).toContain('precoUnitario');
  });

  it('oferece todos os itens da Sequência Caiçara sem cobrar cada escolha', () => {
    const fluxo = read('client/public/garcom/rodizio-seletivo-v1.js');
    for (const nome of [
      'Shimeji',
      'Harumaki Queijo',
      'Guioza',
      'Bolinho de Salmão',
      'Hot Roll Salmão',
      'Carpaccio Salmão',
      'Ceviche de Peixe Branco',
      'Sunomono',
      'Mini Temaki Salmão Completo',
      'Uramaki Salmão',
      'Hossomaki Salmão',
      'Niguiri Salmão',
      'Niguiri Salmão Maçaricado',
      'Joy Salmão',
      'Joy Geleia',
      'Joy Shimeji',
      'Joy Camarão',
      'Sashimi Salmão',
      'Sashimi Atum',
      'Sashimi Peixe Branco'
    ]) {
      expect(fluxo).toContain(nome);
    }
    expect(fluxo).toContain('preco: 0');
    expect(fluxo).toContain("tipo: 'rodizio_itens'");
  });

  it('só permite pedir itens quando a mesa possui Rodízio ativo e não está aguardando pagamento', () => {
    const fluxo = read('client/public/garcom/rodizio-seletivo-v1.js');
    expect(fluxo).toContain('quantidadePessoasRodizio');
    expect(fluxo).toContain("STATUS_CONFERENCIA = 'aguardando_pagamento'");
    expect(fluxo).toContain("if (!pessoas) throw new Error('O Rodízio não está mais ativo nesta mesa.')");
    expect(fluxo).toContain("tipo: 'pedido_rodizio'");
  });

  it('separa produção de cozinha e sushi e preserva o título na impressão automática', () => {
    const fluxo = read('client/public/garcom/rodizio-seletivo-v1.js');
    const auto = read('client/public/pdv/pdv-auto-production-print.js');

    expect(fluxo).toContain("titulo: destino === 'sushi' ? 'PEDIDO SUSHI' : 'PEDIDO COZINHA'");
    expect(fluxo).toContain("subSetor: destino");
    expect(fluxo).toContain("origem: 'garcom'");
    expect(auto).toContain("titulo: registro.pedido.titulo || ''");
    expect(auto).toContain("subSetor: registro.pedido.subSetor || ''");
  });

  it('impede o modal genérico de meio prato/observação de capturar o Rodízio', () => {
    const opcoes = read('client/public/menu-order-options.js');
    expect(opcoes).toContain('const RODIZIO_ID = 9301');
    expect(opcoes).toContain('if (ehRodizio(produto)) return false');
    expect(opcoes).toContain('if (ehRodizio(produto)) return;');
  });

  it('publica o runtime no PWA e verifica sua propagação antes de concluir o deploy', () => {
    const sw = read('client/public/garcom/service-worker.js');
    const workflow = read('.github/workflows/firebase-hosting-deploy.yml');

    expect(sw).toContain("RODIZIO_SELECT_ASSET = '/garcom/rodizio-seletivo-v1.js?v=1'");
    expect(sw).toContain('rodizio-select-v37');
    expect(sw).toContain('<script src="/garcom/rodizio-seletivo-v1.js?v=1"></script>');
    expect(workflow).toContain("verificar_arquivo '/garcom/rodizio-seletivo-v1.js' 'client/public/garcom/rodizio-seletivo-v1.js'");
  });
});
