import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('scripts/production-health-audit.mjs');

const esperados = [
  [16,'Ostras · 12 unid.',75],[17,'Ostras · 6 unid.',45],[38,'Peixe com Molho de Camarão',145],
  [40,'Filé de Peixe com Legumes',135],[41,'Moqueca de Peixe',220],[42,'Caldeirada',285],
  [51,'Macarrão ao Fundo do Mar',265],[103,'Suco de Laranja · 400 ml',20],
  [104,'Suco de Polpa · 400 ml',18],[105,'Suco de Laranja com Polpa · 400 ml',22],
  [115,'Mandioca + Batata + Camarão',110],[116,'Mandioca + Batata + Peixe',95],
  [117,'Mandioca + Batata + Carne',95],[118,'Risoto de Palmito e Champignon',65],
  [119,'Risoto de Shimeji',69],[120,'Espaguete ao Molho Branco com Palmito',65],
  [121,'Espaguete com Champignon, Alcaparras e Cebola Roxa, Puxado no Azeite',69],
  [122,'Baiacu à Caiçara',240],[123,'Baiacu à La Meunière',240],
  [124,'Filé Mignon à Parmegiana',210],[125,'Filé Mignon à Cubana',210],[126,'Filé Mignon com Fritas',195]
] as const;

function catalogoComAdicoes() {
  const base = esperados.map(([id, nome, preco]) => ({ id, nome, preco, categoria: 'Teste', setor: 'cozinha' }));
  base.push(
    { id: 1001, nome: 'Produto incluído pelo PDV A', preco: 10, categoria: 'Teste', setor: 'cozinha' },
    { id: 1002, nome: 'Produto incluído pelo PDV B', preco: 12, categoria: 'Teste', setor: 'bar' }
  );
  return base;
}

function executar({ mesas = {}, pedidos = {}, vendas = {}, cardapio = catalogoComAdicoes() }: any = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'joao-health-audit-'));
  try {
    const arquivos = {
      cardapio: path.join(dir, 'cardapio.json'),
      mesas: path.join(dir, 'mesas.json'),
      pedidos: path.join(dir, 'pedidos.json'),
      vendas: path.join(dir, 'vendas.json')
    };
    fs.writeFileSync(arquivos.cardapio, JSON.stringify(cardapio));
    fs.writeFileSync(arquivos.mesas, JSON.stringify(mesas));
    fs.writeFileSync(arquivos.pedidos, JSON.stringify(pedidos));
    fs.writeFileSync(arquivos.vendas, JSON.stringify(vendas));

    return spawnSync(process.execPath, [script, arquivos.cardapio, arquivos.mesas, arquivos.pedidos, arquivos.vendas], {
      encoding: 'utf8'
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function mesaComEnvio(envioId: string, setor: 'cozinha' | 'bar' = 'cozinha') {
  return {
    1: {
      abertura: Date.now(),
      cliente: 'Teste',
      itens: [{
        nome: 'Item de teste',
        qtd: 1,
        preco: 20,
        setor,
        enviado: true,
        rascunho: false,
        envioId,
        itemOperacaoId: `item-${envioId}`
      }]
    }
  };
}

describe('Production Health Audit — correlação de tickets', () => {
  it('aceita produtos adicionais sem exigir quantidade fixa de cardápio', () => {
    const resultado = executar();
    expect(resultado.status).toBe(0);
    expect(resultado.stdout).toContain(`cardapio_itens=${catalogoComAdicoes().length}`);
    expect(resultado.stdout).not.toContain('esperado 125');
    expect(resultado.stdout).toContain('erros=0');
  });

  it('reconhece ticket do Garçom quando envioId está nos itens', () => {
    const envioId = 'env-garcom-1';
    const resultado = executar({
      mesas: mesaComEnvio(envioId),
      pedidos: {
        ticket1: {
          mesa: 1,
          setor: 'cozinha',
          status: 'recebido',
          origem: 'garcom',
          itens: [
            { nome: 'Item de teste', qtd: 1, preco: 20, setor: 'cozinha', envioId },
            { nome: 'Outro item', qtd: 1, preco: 10, setor: 'cozinha', envioId }
          ]
        }
      }
    });

    expect(resultado.status).toBe(0);
    expect(resultado.stdout).toContain('avisos=0');
    expect(resultado.stdout).not.toContain('sem ticket correspondente');
  });

  it('continua reconhecendo ticket do PDV com envioId no topo', () => {
    const envioId = 'env-pdv-1';
    const resultado = executar({
      mesas: mesaComEnvio(envioId, 'bar'),
      pedidos: {
        ticket1: {
          mesa: 1,
          setor: 'bar',
          status: 'recebido',
          origem: 'pdv',
          envioId,
          itens: [{ nome: 'Item de teste', qtd: 1, preco: 20, setor: 'bar' }]
        }
      }
    });

    expect(resultado.status).toBe(0);
    expect(resultado.stdout).toContain('avisos=0');
  });

  it('mantém aviso quando item enviado realmente não possui ticket correspondente', () => {
    const resultado = executar({ mesas: mesaComEnvio('env-sem-ticket'), pedidos: {} });

    expect(resultado.status).toBe(0);
    expect(resultado.stdout).toContain('avisos=1');
    expect(resultado.stdout).toContain('sincronizacao: item enviado em mesa aberta sem ticket correspondente localizado (1/cozinha)');
  });

  it('não trata vários itens do mesmo envio no mesmo ticket como duplicidade', () => {
    const envioId = 'env-multi-item';
    const resultado = executar({
      mesas: mesaComEnvio(envioId),
      pedidos: {
        ticket1: {
          mesa: 1,
          setor: 'cozinha',
          status: 'recebido',
          itens: [
            { nome: 'A', qtd: 1, preco: 10, envioId },
            { nome: 'B', qtd: 2, preco: 12, envioId }
          ]
        }
      }
    });

    expect(resultado.status).toBe(0);
    expect(resultado.stdout).toContain('erros=0');
    expect(resultado.stdout).not.toContain('duplicado entre tickets');
  });

  it('continua detectando o mesmo envioId/setor quando aparece em dois tickets diferentes', () => {
    const envioId = 'env-duplicado';
    const resultado = executar({
      pedidos: {
        ticket1: { mesa: 1, setor: 'cozinha', status: 'recebido', itens: [{ nome: 'A', qtd: 1, preco: 10, envioId }] },
        ticket2: { mesa: 2, setor: 'cozinha', status: 'recebido', itens: [{ nome: 'B', qtd: 1, preco: 10, envioId }] }
      }
    });

    expect(resultado.status).toBe(1);
    expect(resultado.stdout).toContain('ERRO: pedidosProducao: envioId/setor duplicado entre tickets');
  });
});
