import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const URL_MENU = 'https://joaocaicaratradicao-default-rtdb.firebaseio.com/cardapio.json';

// Keep both IDs for old receipts; only one remains selectable for new orders.
export function transform(source) {
  if (!source || typeof source !== 'object') throw new Error('Cardápio inválido.');
  const result = structuredClone(source);
  const items = Object.values(result).filter(Boolean);
  if (new Set(items.map(x => String(x.id))).size !== items.length) throw new Error('IDs duplicados.');
  const canonical = items.find(x => Number(x.id) === 9323);
  const legacy = items.find(x => Number(x.id) === 9324);
  if (!canonical || !legacy) throw new Error('Cadastros MULHER não encontrados.');
  if (!['sushi das Mulhres', 'Rodízio - MULHER'].includes(canonical.nome) || legacy.nome !== 'mulher'
    || canonical.categoria !== 'sushi' || legacy.categoria !== 'sushi'
    || canonical.preco !== 119.9 || legacy.preco !== 119.9 || canonical.ativo !== true) {
    throw new Error('Cadastro ou preço divergente; unificação abortada.');
  }
  let count = 0;
  if (canonical.nome !== 'Rodízio - MULHER') { canonical.nome = 'Rodízio - MULHER'; count++; }
  if (legacy.ativo !== false) { legacy.ativo = false; count++; }
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
  console.log(`Plano validado: ${count} campos a atualizar na unificação MULHER.`);
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
  if (verified.count !== 0) throw new Error('Unificação publicada não corresponde ao plano.');
  console.log(`Conferência concluída: um único Rodízio - MULHER ativo, por R$ 119,90.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, directory] = process.argv.slice(2);
  if (!directory || !['prepare', 'apply'].includes(mode)) throw new Error('Uso: update.mjs <prepare|apply> <diretório>');
  await (mode === 'prepare' ? prepare(directory) : apply(directory));
}
