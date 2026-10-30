import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const changes = JSON.parse(fs.readFileSync(new URL('./changes.json', import.meta.url), 'utf8'));
const URL_MENU = 'https://joaocaicaratradicao-default-rtdb.firebaseio.com/cardapio.json';

// Pure transformation: never reads or writes mesas, vendas, pedidos or profiles.
export function transform(source, reverse = false) {
  if (!source || typeof source !== 'object') throw new Error('Cardápio ausente ou inválido.');
  const result = structuredClone(source);
  const entries = Object.entries(result).filter(([, item]) => item != null);
  const ids = entries.map(([, item]) => String(item.id));
  if (new Set(ids).size !== ids.length) throw new Error('IDs duplicados; nenhuma gravação permitida.');
  let count = 0;
  for (const change of changes) {
    const found = entries.find(([, item]) => String(item.id) === String(change.id));
    if (!found) throw new Error(`Produto ausente: ${change.id}.`);
    const [key, item] = found;
    if (item.nome !== change.nome || item.categoria !== change.categoria) {
      throw new Error(`Identidade divergente: ${change.id}.`);
    }
    const from = reverse ? change.novo : change.anterior;
    const to = reverse ? change.anterior : change.novo;
    if (typeof item.preco !== 'number' || ![from, to].includes(item.preco)) {
      throw new Error(`Preço alterado por outra edição: ${change.id}; atualização abortada.`);
    }
    if (item.preco === to) continue;
    item.preco = to;
    count++;
    const original = { ...source[key], preco: to };
    if (!isDeepStrictEqual(original, item)) throw new Error('Campo inesperado alterado.');
  }
  return { result, count };
}

async function request(options = {}) {
  const token = process.env.FIREBASE_ACCESS_TOKEN;
  if (!token) throw new Error('Credencial administrativa não disponível.');
  const response = await fetch(URL_MENU, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`Firebase HTTP ${response.status}; sem nova tentativa de gravação.`);
  return response;
}

export async function prepare(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const response = await request({ headers: { 'X-Firebase-ETag': 'true' } });
  const source = await response.json();
  const etag = response.headers.get('etag');
  if (!etag) throw new Error('Firebase sem ETag; atualização abortada.');
  const { result, count } = transform(source);
  fs.writeFileSync(path.join(directory, 'before.json'), JSON.stringify(source));
  fs.writeFileSync(path.join(directory, 'after.json'), JSON.stringify(result));
  fs.writeFileSync(path.join(directory, 'plan.json'), JSON.stringify({ etag, count }));
  console.log(`Plano validado: ${count} preços a atualizar; ${changes.length - count} já atualizados.`);
}

export async function apply(directory) {
  const before = JSON.parse(fs.readFileSync(path.join(directory, 'before.json'), 'utf8'));
  const after = JSON.parse(fs.readFileSync(path.join(directory, 'after.json'), 'utf8'));
  const plan = JSON.parse(fs.readFileSync(path.join(directory, 'plan.json'), 'utf8'));
  const expected = transform(before);
  if (!isDeepStrictEqual(after, expected.result) || plan.count !== expected.count || !plan.etag) {
    throw new Error('Plano inválido; nenhuma gravação permitida.');
  }
  if (plan.count) {
    await request({ method: 'PUT', headers: { 'If-Match': plan.etag, 'Content-Type': 'application/json' }, body: JSON.stringify(after) });
  }
  const saved = await (await request()).json();
  const verified = transform(saved);
  if (verified.count !== 0) throw new Error('Preços publicados não correspondem ao plano.');
  console.log(`Conferência concluída: ${changes.length} preços corretos no cadastro compartilhado.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, directory] = process.argv.slice(2);
  if (!directory || !['prepare', 'apply'].includes(mode)) throw new Error('Uso: update.mjs <prepare|apply> <diretório>');
  await (mode === 'prepare' ? prepare(directory) : apply(directory));
}
