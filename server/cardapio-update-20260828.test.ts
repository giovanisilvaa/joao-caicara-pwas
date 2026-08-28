import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const criarBase = async () => {
  const mod = await import('../scripts/cardapio-update-20260828.mjs');
  const lista: any[] = Array.from({ length: 114 }, (_, i) => ({
    id: i + 1,
    nome: `Item ${i + 1}`,
    preco: 1,
    categoria: 'outros',
    setor: 'cozinha',
    favorito: false,
    ativo: true,
    servePara2: false
  }));
  const set = (id: number, nome: string, preco: number, categoria: string, setor = 'cozinha', servePara2 = false) => {
    lista[id - 1] = { ...lista[id - 1], id, nome, preco, categoria, setor, servePara2 };
  };

  for (let id = 1; id <= 19; id++) lista[id - 1].categoria = 'aperitivos';
  for (let id = 20; id <= 23; id++) lista[id - 1].categoria = 'saladas';
  for (let id = 38; id <= 48; id++) lista[id - 1].categoria = 'peixes_camaroes';
  for (let id = 58; id <= 61; id++) lista[id - 1].categoria = 'carnes';

  set(16, 'Ostras · 12 unid.', 175, 'aperitivos');
  set(17, 'Ostras · 6 unid.', 75, 'aperitivos');
  set(38, 'Peixe com Molho de Camarão', 125, 'peixes_camaroes', 'cozinha', true);
  set(40, 'Filé de Peixe com Legumes', 125, 'peixes_camaroes', 'cozinha', true);
  set(41, 'Moqueca de Peixe', 285, 'peixes_camaroes', 'cozinha', true);
  set(42, 'Caldeirada', 145, 'peixes_camaroes', 'cozinha', true);
  set(51, 'Macarrão ao Fundo do Mar', 225, 'massas_risotos', 'cozinha', true);
  set(75, 'Heineken Zero · 600 ml', 22, 'cervejas', 'bar');
  set(103, 'Suco Natural · 400 ml', 18, 'sucos', 'bar');
  set(104, 'Suco de Polpa · 400 ml', 16, 'sucos', 'bar');
  set(105, 'Suco de Polpa com Laranja · 400 ml', 20, 'sucos', 'bar');
  return { lista, mod };
};

describe('atualização do cardápio 28/08/2026', () => {
  it('aplica os preços, remove a cerveja incorreta e inclui 12 novos produtos sem duplicar IDs', async () => {
    const { lista, mod } = await criarBase();
    const antes = JSON.stringify(lista);
    const atualizado = mod.aplicarAtualizacao(lista);

    expect(JSON.stringify(lista)).toBe(antes);
    expect(atualizado).toHaveLength(125);
    expect(new Set(atualizado.map((item: any) => item.id)).size).toBe(125);
    expect(atualizado.some((item: any) => item.id === 75)).toBe(false);
    expect(atualizado.find((item: any) => item.id === 16)?.preco).toBe(75);
    expect(atualizado.find((item: any) => item.id === 17)?.preco).toBe(45);
    expect(atualizado.find((item: any) => item.id === 38)?.preco).toBe(145);
    expect(atualizado.find((item: any) => item.id === 40)?.preco).toBe(135);
    expect(atualizado.find((item: any) => item.id === 41)?.preco).toBe(220);
    expect(atualizado.find((item: any) => item.id === 42)?.preco).toBe(285);
    expect(atualizado.find((item: any) => item.id === 51)?.preco).toBe(265);
    expect(atualizado.find((item: any) => item.id === 103)).toMatchObject({ nome:'Suco de Laranja · 400 ml', preco:20 });
    expect(atualizado.find((item: any) => item.id === 104)?.preco).toBe(18);
    expect(atualizado.find((item: any) => item.id === 105)).toMatchObject({ nome:'Suco de Laranja com Polpa · 400 ml', preco:22 });
    expect(atualizado.filter((item: any) => item.id >= 115 && item.id <= 126)).toHaveLength(12);
    expect(atualizado.filter((item: any) => item.categoria === 'veganos_vegetarianos')).toHaveLength(4);
    expect(atualizado.filter((item: any) => item.categoria === 'veganos_vegetarianos').every((item: any) => item.individual === true && item.servePara2 === false)).toBe(true);
    expect(() => mod.validarAtualizacao(atualizado)).not.toThrow();
  });

  it('coloca Combos Especiais Praia imediatamente depois de Aperitivos', async () => {
    const { lista, mod } = await criarBase();
    const atualizado = mod.aplicarAtualizacao(lista);
    const ultimoAperitivo = atualizado.map((item: any) => item.categoria).lastIndexOf('aperitivos');
    expect(atualizado[ultimoAperitivo + 1]).toMatchObject({ id:115, categoria:'combos_praia' });
    expect(atualizado[ultimoAperitivo + 2]).toMatchObject({ id:116, categoria:'combos_praia' });
    expect(atualizado[ultimoAperitivo + 3]).toMatchObject({ id:117, categoria:'combos_praia' });
  });

  it('aborta se o cardápio mudou depois da auditoria', async () => {
    const { lista, mod } = await criarBase();
    lista.find((item: any) => item.id === 38).preco = 999;
    expect(() => mod.aplicarAtualizacao(lista)).toThrow(/Preço de segurança divergente/);
    const { lista: listaMaior } = await criarBase();
    listaMaior.push({ id:999, nome:'Mudança concorrente' });
    expect(() => mod.aplicarAtualizacao(listaMaior)).toThrow(/mudou desde a auditoria/);
  });

  it('publica o complemento em PDV e Garçom e mantém as cores caiçaras combinadas', () => {
    const menu = fs.readFileSync('client/public/menu-20260828.js', 'utf8');
    const pdv = fs.readFileSync('client/public/pdv/service-worker.js', 'utf8');
    const garcom = fs.readFileSync('client/public/garcom/service-worker.js', 'utf8');
    expect(menu).toContain("'combos_praia'");
    expect(menu).toContain("'veganos_vegetarianos'");
    expect(menu).toContain('Prato individual');
    expect(menu).toContain('#F9F6F0');
    expect(menu).toContain('#0F4C5C');
    expect(menu).toContain('#D95D39');
    expect(menu).toContain("font-family:Georgia");
    for (const sw of [pdv, garcom]) {
      expect(sw).toContain("const MENU_UPDATE_ASSET = '/menu-20260828.js?v=1'");
      expect(sw).toContain('MENU_UPDATE_ASSET');
      expect(sw).toContain("if (!html.includes('/menu-20260828.js'))");
    }
  });

  it('mantém a migração como histórico, mas impede repetição automática em futuros deploys', () => {
    const workflow = fs.readFileSync('.github/workflows/firebase-hosting-deploy.yml', 'utf8');
    const migration = fs.readFileSync('scripts/cardapio-update-20260828.mjs', 'utf8');
    expect(migration).toContain('aplicarAtualizacao');
    expect(migration).toContain('validarAtualizacao');
    expect(workflow).not.toContain('Prepare validated menu update');
    expect(workflow).not.toContain('Apply conditional menu update');
    expect(workflow).not.toContain('cardapio-update-20260828.mjs transform');
    expect(workflow).toContain("verificar_arquivo '/menu-20260828.js'");
  });
});
