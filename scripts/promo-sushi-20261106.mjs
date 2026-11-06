import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
export const targets=[
[300,'Sequência Especial Caiçara',185,148],
[301,'Combinado Individual · 20 peças',95,76],
[302,'Combinado Pé na Areia · 44 peças',245,196],
[303,'Combinado Beira a Mar · 64 peças',380,304],
[304,'Combinado Mix de Peixes · 42 peças',265,212]
];
export const start=Date.parse('2026-11-06T03:00:00Z');
export const end=Date.parse('2026-11-07T03:00:00Z');
export function transform(source,now=Date.now()){
 if(now<start)throw Error('Promoção ainda não começou.');
 if(!source||typeof source!=='object')throw Error('Cardápio inválido.');
 const result=structuredClone(source), items=Object.values(result).filter(Boolean);
 if(new Set(items.map(x=>String(x.id))).size!==items.length)throw Error('IDs duplicados.');
 let count=0;
 for(const [id,name,normal,promo] of targets){
  const item=items.find(x=>Number(x.id)===id);
  if(!item||item.nome!==name||item.categoria!=='sushi'||item.ativo!==true||![normal,promo].includes(item.preco))
   throw Error('Identidade ou preço inesperado no item '+id+'; gravação abortada.');
  const price=now<end?promo:normal;
  if(item.preco!==price){item.preco=price;count++;}
 }
 return {result,count,mode:now<end?'promocao':'normal'};
}
const url='https://joaocaicaratradicao-default-rtdb.firebaseio.com/cardapio.json';
async function request(options={}){
 if(!process.env.FIREBASE_ACCESS_TOKEN)throw Error('Credencial ausente.');
 const r=await fetch(url,{...options,headers:{Authorization:'Bearer '+process.env.FIREBASE_ACCESS_TOKEN,...options.headers},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('Firebase HTTP '+r.status+'; sem nova tentativa de escrita.');
 return r;
}
async function main(){
 const [mode,dir]=process.argv.slice(2);
 if(!dir||!['prepare','apply'].includes(mode))throw Error('Uso: prepare|apply diretório');
 if(mode==='prepare'){
  const r=await request({headers:{'X-Firebase-ETag':'true'}});
  const before=await r.json(),etag=r.headers.get('etag'),plan=transform(before);
  if(!etag)throw Error('ETag ausente.');
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'before.json'),JSON.stringify(before));
  fs.writeFileSync(path.join(dir,'after.json'),JSON.stringify(plan.result));
  fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify({etag,count:plan.count,mode:plan.mode}));
  console.log('Plano: '+plan.mode+'; '+plan.count+' preços a alterar.');
 }else{
  const before=JSON.parse(fs.readFileSync(path.join(dir,'before.json')));
  const after=JSON.parse(fs.readFileSync(path.join(dir,'after.json')));
  const plan=JSON.parse(fs.readFileSync(path.join(dir,'plan.json')));
  const expected=transform(before);
  if(!plan.etag||plan.mode!==expected.mode||!isDeepStrictEqual(after,expected.result)||plan.count!==expected.count)throw Error('Plano alterado ou expirado.');
  if(plan.count)await request({method:'PUT',headers:{'If-Match':plan.etag,'Content-Type':'application/json'},body:JSON.stringify(after)});
  const saved=await(await request()).json();
  if(transform(saved).count)throw Error('Verificação de preços falhou.');
  console.log('VERIFICADO: '+plan.mode+' nos cinco itens; demais produtos preservados.');
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
