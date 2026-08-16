from pathlib import Path

root = Path('/home/ubuntu/joao-caicara-pwas/client/public')
garcom = (root / 'garcom/index.html').read_text(encoding='utf-8')
pdv = (root / 'pdv/index.html').read_text(encoding='utf-8')

assert '/garcom/manifest.json' in garcom
assert '/garcom/service-worker.js' in garcom
assert 'enviarProducaoG' in garcom
assert "db.ref('pedidosProducao')" in garcom
assert "status: 'recebido'" in garcom

assert '/pdv/manifest.json' in pdv
assert '/pdv/service-worker.js' in pdv
assert 'toggleProducao' in pdv
assert 'atualizarStatusProducao' in pdv
assert "db.ref('pedidosProducao')" in pdv
for status in ('recebido', 'em_preparo', 'pronto', 'entregue'):
    assert status in pdv

print('Fluxos PWA e produção compartilhada validados.')
