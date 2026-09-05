import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const catalogPath = fileURLToPath(new URL('../client/public/sorvetes-menu-20260905.json', import.meta.url));
export const SORVETES_CATALOG = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
export const SORVETES_ITEMS = SORVETES_CATALOG.items;
export const SORVETES_CATEGORY = SORVETES_CATALOG.category.key;

const nomeNorm = valor => String(valor ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function validarCatalogo() {
  if (!Array.isArray(SORVETES_ITEMS) || SORVETES_ITEMS.length !== 15) {
    throw new Error(`Catálogo Sorvetes deve possuir 15 itens; encontrado ${Array.isArray(SORVETES_ITEMS) ? SORVETES_ITEMS.length : 0}.`);
  }
  const ids = SORVETES_ITEMS.map(item => Number(item.id));
  if (ids.some(id => !Number.isInteger(id))) throw new Error('Catálogo Sorvetes possui ID não inteiro.');
  if (new Set(ids).size !== ids.length) throw new Error('Catálogo Sorvetes possui IDs duplicados.');
  if (Math.min(...ids) !== 400 || Math.max(...ids) !== 414) throw new Error('Faixa reservada dos Sorvetes deve ser 400–414.');

  const nomes = SORVETES_ITEMS.map(item => nomeNorm(item.nome));
  if (new Set(nomes).size !== nomes.length) throw new Error('Catálogo Sorvetes possui nomes duplicados.');

  for (const item of SORVETES_ITEMS) {
    if (!item.nome || !Number.isFinite(Number(item.preco)) || Number(item.preco) < 0) throw new Error(`Item Sorvetes inválido: ${item.id}.`);
    if (item.categoria !== SORVETES_CATEGORY) throw new Error(`Categoria inválida no Sorvete ${item.id}.`);
    if (item.setor !== 'cozinha') throw new Error(`Setor inválido no Sorvete ${item.id}.`);
    if (item.ativo !== true) throw new Error(`Sorvete ${item.id} deve iniciar ativo.`);
  }
}

export function validarSorvetesCardapio(lista) {
  validarCatalogo();
  if (!Array.isArray(lista)) throw new Error('O /cardapio de produção não é uma lista.');

  const ids = lista.map(item => Number(item?.id)).filter(Number.isFinite);
  if (new Set(ids).size !== ids.length) throw new Error('O /cardapio possui IDs duplicados.');

  for (const esperado of SORVETES_ITEMS) {
    const item = lista.find(registro => Number(registro?.id) === Number(esperado.id));
    if (!item) throw new Error(`Sorvete ausente: ${esperado.id} — ${esperado.nome}.`);
    for (const campo of ['nome', 'preco', 'categoria', 'setor', 'ativo']) {
      if (item[campo] !== esperado[campo]) {
        throw new Error(`Sorvete ${esperado.id} com ${campo} divergente (${JSON.stringify(item[campo])} != ${JSON.stringify(esperado[campo])}).`);
      }
    }
  }
  return true;
}

export function aplicarSorvetesCardapio(origem) {
  validarCatalogo();
  if (!Array.isArray(origem)) throw new Error('O /cardapio de produção não é uma lista.');

  const lista = JSON.parse(JSON.stringify(origem));
  const idsExistentes = new Set();
  for (const item of lista) {
    const id = Number(item?.id);
    if (!Number.isFinite(id)) continue;
    if (idsExistentes.has(id)) throw new Error(`ID duplicado já existente no /cardapio: ${id}.`);
    idsExistentes.add(id);
  }

  for (const esperado of SORVETES_ITEMS) {
    const porId = lista.find(item => Number(item?.id) === Number(esperado.id));
    if (porId) {
      if (nomeNorm(porId.nome) !== nomeNorm(esperado.nome)) {
        throw new Error(`Colisão na faixa Sorvetes: ID ${esperado.id} já pertence a "${porId.nome}".`);
      }
      continue;
    }

    const porNome = lista.find(item => item?.categoria === SORVETES_CATEGORY && nomeNorm(item?.nome) === nomeNorm(esperado.nome));
    if (porNome) throw new Error(`Sorvete "${esperado.nome}" já existe com outro ID (${porNome.id}).`);
    lista.push(JSON.parse(JSON.stringify(esperado)));
  }

  validarSorvetesCardapio(lista);
  return lista;
}

const executadoDiretamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executadoDiretamente) {
  const arquivo = process.argv[2];
  const validarSomente = process.argv.includes('--validate-only');
  if (!arquivo) {
    console.error('Uso: node scripts/sorvetes-cardapio-update.mjs <cardapio.json> [--validate-only]');
    process.exit(2);
  }
  const atual = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  if (validarSomente) {
    validarSorvetesCardapio(atual);
    console.error(`Catálogo Sorvetes validado: ${SORVETES_ITEMS.length} itens.`);
  } else {
    const atualizado = aplicarSorvetesCardapio(atual);
    process.stdout.write(JSON.stringify(atualizado));
  }
}
