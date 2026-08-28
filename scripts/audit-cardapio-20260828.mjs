import fs from 'node:fs';

const arquivo = process.argv[2];
if (!arquivo) throw new Error('Informe o JSON do cardápio.');
const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
if (!Array.isArray(dados)) throw new Error('O cardápio de produção deixou de ser uma lista. Auditoria interrompida.');

const normalizar = valor => String(valor ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const categoriasRelevantes = ['aperitivo', 'suco', 'vegan', 'veget', 'peixe', 'carne', 'ostra', 'cerveja'];
const categorias = new Map();

for (let indice = 0; indice < dados.length; indice++) {
  const item = dados[indice] || {};
  const categoria = String(item.categoria ?? 'SEM CATEGORIA');
  if (!categorias.has(categoria)) categorias.set(categoria, { primeira: indice, ultima: indice, total: 0 });
  const info = categorias.get(categoria);
  info.ultima = indice;
  info.total += 1;
}

console.log('=== AUDITORIA CARDÁPIO — SOMENTE LEITURA ===');
console.log(`Total de itens: ${dados.length}`);
console.log('\nORDEM DAS CATEGORIAS:');
for (const [categoria, info] of categorias) {
  console.log(`${info.primeira}-${info.ultima}\t${info.total} item(ns)\t${categoria}`);
}

console.log('\nITENS DAS CATEGORIAS RELEVANTES:');
for (let indice = 0; indice < dados.length; indice++) {
  const item = dados[indice] || {};
  const categoria = String(item.categoria ?? '');
  const textoCategoria = normalizar(categoria);
  const nome = String(item.nome ?? '');
  const textoNome = normalizar(nome);
  const relevante = categoriasRelevantes.some(chave => textoCategoria.includes(chave)) ||
    /baiacu|file mignon|risoto|espaguete|macarrao|caldeirada|molho de camarao|molho de camarão|heineken/.test(textoNome);
  if (!relevante) continue;
  console.log(JSON.stringify({
    indice,
    id: item.id,
    categoria,
    nome,
    preco: item.preco,
    ativo: item.ativo,
    favorito: item.favorito,
    servePara2: item.servePara2,
    setor: item.setor
  }));
}

console.log('\nAMOSTRA DO ESQUEMA DOS ÚLTIMOS ITENS:');
for (let indice = Math.max(0, dados.length - 5); indice < dados.length; indice++) {
  console.log(JSON.stringify({ indice, item: dados[indice] }));
}
