import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform, changes } from './update.mjs';

function fixture() {
  return changes.map(c => ({ id: c.id, nome: c.nome, categoria: c.categoria, preco: c.anterior, ativo: true,
    favorito: false, setor: 'cozinha', detalhes: { untouched: ['a', 'b'] } }));
}

test('changes only the 89 approved prices, preserving source, ordering and all other fields', () => {
  const source = fixture();
  source.splice(5, 0, null);
  source.push({ id: 9303, nome: 'Rodízio - DUPLINHA', preco: 249.9, promocao: true });
  const copy = structuredClone(source);
  const { result, count } = transform(source);
  assert.equal(count, 89);
  assert.deepEqual(source, copy);
  assert.equal(result.length, source.length);
  assert.deepEqual(result.map(x => x && ({ ...x, preco: 0 })), source.map(x => x && ({ ...x, preco: 0 })));
  assert.deepEqual(result.at(-1), source.at(-1));
  assert.equal(result.find(x => x?.id === 59).preco, 165);
  assert.equal(result.find(x => x?.id === 344).preco, 62);
  assert.equal(transform(result).count, 0);
  assert.deepEqual(transform(result, true).result, source);
});

test('preserves Firebase object keys and accepts an already applied subset', () => {
  const source = Object.fromEntries(fixture().map((x, i) => [`key_${i}`, x]));
  source.key_0.preco = changes[0].novo;
  const { result, count } = transform(source);
  assert.equal(count, 88);
  assert.deepEqual(Object.keys(result), Object.keys(source));
});

test('aborts completely on a missing product, duplicate ID, identity mismatch or unexpected price', () => {
  for (const mutate of [
    x => x.pop(), x => x.push(structuredClone(x[0])), x => x[0].nome = 'Outro produto',
    x => x[0].categoria = 'outra', x => x.at(-1).preco = 0, x => x[0].preco = '65'
  ]) {
    const source = fixture(); mutate(source);
    const copy = structuredClone(source);
    assert.throws(() => transform(source));
    assert.deepEqual(source, copy);
  }
});

test('HTTP 412 aborts without retry or overwriting a concurrent edit', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { prepare, apply } = await import('./update.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prices-test-'));
  const originalFetch = globalThis.fetch;
  const previousToken = process.env.FIREBASE_ACCESS_TOKEN;
  let writes = 0;
  process.env.FIREBASE_ACCESS_TOKEN = 'test-only';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://joaocaicaratradicao-default-rtdb.firebaseio.com/cardapio.json');
    if (options.method === 'PUT') {
      writes++;
      assert.equal(options.headers['If-Match'], '"version-1"');
      return new Response('{}', { status: 412 });
    }
    return new Response(JSON.stringify(fixture()), { headers: { etag: '"version-1"' } });
  };
  try {
    await prepare(dir);
    await assert.rejects(apply(dir), /HTTP 412/);
    assert.equal(writes, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.FIREBASE_ACCESS_TOKEN;
    else process.env.FIREBASE_ACCESS_TOKEN = previousToken;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
