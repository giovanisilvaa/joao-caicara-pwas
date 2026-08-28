import fs from 'node:fs';

const arquivo = process.argv[2];
if (!arquivo) throw new Error('Informe o JSON do cardápio.');
const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));

const normalizar = valor => String(valor ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const alvos = [
  'Suco de polpa', 'Suco de laranja', 'Suco de laranja com polpa',
  'Risoto de palmito e champignon', 'Risoto de shimeji',
  'Espaguete ao molho branco com palmito',
  'Espaguete com champignon, alcaparras e cebola roxa, puxado no azeite',
  'Peixe com molho de camarão', 'Peixe com legumes', 'Moqueca de peixe',
  'Caldeirada', 'Macarrão ao fundo do mar', 'Heineken 600 ml Zero'
].map(normalizar);

const encontrados = [];
const categorias = [];

function visitar(valor, caminho = 'cardapio') {
  if (!valor || typeof valor !== 'object') return;

  if (!Array.isArray(valor)) {
    const nome = valor.nome ?? valor.name ?? valor.titulo ?? valor.title ?? null;
    const preco = valor.preco ?? valor.price ?? valor.valor ?? null;
    if (nome != null) {
      const item = { caminho, nome: String(nome), preco, chaves: Object.keys(valor) };
      if (alvos.includes(normalizar(nome))) encontrados.push(item);
      const filhos = Object.entries(valor).filter(([, v]) => Array.isArray(v) || (v && typeof v === 'object'));
      if (filhos.some(([k]) => /itens|produtos|items|products/i.test(k))) categorias.push(item);
    }
  }

  for (const [chave, filho] of Object.entries(valor)) {
    if (filho && typeof filho === 'object') visitar(filho, `${caminho}/${chave}`);
  }
}

visitar(dados);

console.log('=== AUDITORIA CARDÁPIO — SOMENTE LEITURA ===');
console.log('Tipo raiz:', Array.isArray(dados) ? 'array' : typeof dados);
console.log('Chaves raiz:', dados && typeof dados === 'object' ? Object.keys(dados).join(', ') : '-');
console.log('\nCategorias detectadas:');
for (const cat of categorias) console.log(JSON.stringify(cat));
console.log('\nItens-alvo encontrados:');
for (const item of encontrados) console.log(JSON.stringify(item));
console.log(`\nTotal categorias detectadas: ${categorias.length}`);
console.log(`Total itens-alvo encontrados: ${encontrados.length}`);
