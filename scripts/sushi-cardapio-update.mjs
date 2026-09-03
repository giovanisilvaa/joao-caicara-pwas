import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const catalogPath = fileURLToPath(new URL('../client/public/sushi-menu-20260903.json', import.meta.url));
export const SUSHI_CATALOG = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
export const SUSHI_ITEMS = SUSHI_CATALOG.items;
export const SUSHI_CATEGORY = SUSHI_CATALOG.category.key;

const nomeNorm = valor => String(valor ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function validarCatalogo() {
  if (!Array.isArray(SUSHI_ITEMS) || SUSHI_ITEMS.length !== 61) {
    throw new Error(`Catálogo Sushi deve possuir 61 itens; encontrado ${Array.isArray(SUSHI_ITEMS) ? SUSHI_ITEMS.length : 0}.`);
  }
  const ids = SUSHI_ITEMS.map(item => Number(item.id));
  if (ids.some(id => !Number.isInteger(id))) throw new Error('Catálogo Sushi possui ID não inteiro.');
  if (new Set(ids).size !== ids.length) throw new Error('Catálogo Sushi possui IDs duplicados.');
  if (Math.min(...ids) !== 300 || Math.max(...ids) !== 360) throw new Error('Faixa reservada do Sushi deve ser 300–360.');

  const nomes = SUSHI_ITEMS.map(item => nomeNorm(item.nome));
  if (new Set(nomes).size !== nomes.length) throw new Error('Catálogo Sushi possui nomes duplicados.');

  for (const item of SUSHI_ITEMS) {
    if (!item.nome || !Number.isFinite(Number(item.preco)) || Number(item.preco) < 0) throw new Error(`Item Sushi inválido: ${item.id}.`);
    if (item.categoria !== 'sushi') throw new Error(`Categoria inválida no item Sushi ${item.id}.`);
    if (item.setor !== 'cozinha') throw new Error(`Setor inválido no item Sushi ${item.id}.`);
    if (!item.sushiGrupo) throw new Error(`Subcategoria ausente no item Sushi ${item.id}.`);
  }
}

export function validarSushiCardapio(lista) {
  validarCatalogo();
  if (!Array.isArray(lista)) throw new Error('O /cardapio de produção não é uma lista.');

  const ids = lista.map(item => Number(item?.id)).filter(Number.isFinite);
  if (new Set(ids).size !== ids.length) throw new Error('O /cardapio possui IDs duplicados.');

  for (const esperado of SUSHI_ITEMS) {
    const item = lista.find(registro => Number(registro?.id) === Number(esperado.id));
    if (!item) throw new Error(`Sushi ausente: ${esperado.id} — ${esperado.nome}.`);
    for (const campo of ['nome', 'preco', 'categoria', 'setor', 'sushiGrupo']) {
      if (item[campo] !== esperado[campo]) {
        throw new Error(`Sushi ${esperado.id} com ${campo} divergente (${JSON.stringify(item[campo])} != ${JSON.stringify(esperado[campo])}).`);
      }
    }
  }

  return true;
}

export function aplicarSushiCardapio(origem) {
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

  for (const esperado of SUSHI_ITEMS) {
    const porId = lista.find(item => Number(item?.id) === Number(esperado.id));
    if (porId) {
      if (nomeNorm(porId.nome) !== nomeNorm(esperado.nome)) {
        throw new Error(`Colisão na faixa Sushi: ID ${esperado.id} já pertence a "${porId.nome}".`);
      }
      continue;
    }

    const porNome = lista.find(item => item?.categoria === SUSHI_CATEGORY && nomeNorm(item?.nome) === nomeNorm(esperado.nome));
    if (porNome) throw new Error(`Sushi "${esperado.nome}" já existe com outro ID (${porNome.id}).`);
    lista.push(JSON.parse(JSON.stringify(esperado)));
  }

  validarSushiCardapio(lista);
  return lista;
}

const executadoDiretamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executadoDiretamente) {
  const arquivo = process.argv[2];
  const validarSomente = process.argv.includes('--validate-only');
  if (!arquivo) {
    console.error('Uso: node scripts/sushi-cardapio-update.mjs <cardapio.json> [--validate-only]');
    process.exit(2);
  }
  const atual = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  if (validarSomente) {
    validarSushiCardapio(atual);
    console.error(`Catálogo Sushi validado: ${SUSHI_ITEMS.length} itens.`);
  } else {
    const atualizado = aplicarSushiCardapio(atual);
    process.stdout.write(JSON.stringify(atualizado));
  }
}
