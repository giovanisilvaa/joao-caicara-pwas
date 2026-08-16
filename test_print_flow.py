from pathlib import Path

root = Path('/home/ubuntu/joao-caicara-pwas/client/public')
garcom = (root / 'garcom/index.html').read_text()
pdv = (root / 'pdv/index.html').read_text()

assert "const porSetor = { cozinha: [], bar: [] }" in garcom
assert "return salvarMesas();" in garcom
assert "refsCriadas.map(ref => ref.remove())" in garcom
assert "db.ref('pedidosProducao').push" in garcom
assert "function imprimirPedidoProducao" in pdv
assert "pedido.setor === 'bar' ? 'bar' : 'cozinha'" in pdv
assert "impressoEm: Date.now()" in pdv
assert "Reimprimir" in pdv
assert "['recebido','impresso','em_preparo','pronto','entregue','cancelado']" in pdv
print('Fluxo de impressão separado por setor validado.')
