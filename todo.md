# Próximas etapas operacionais

- [x] Migrar o acesso do PWA do garçom do PIN único para login individual administrado pelo PDV via Firebase.
- [x] Aplicar permissões reais por função nas ações sensíveis existentes dos PWAs: abertura, cancelamentos, transferência, edição e fechamento; descontos permanecem fora do escopo atual.
- [x] Corrigir e consolidar o ciclo de produção sem duplicar reimpressões.
- [x] Garantir rollback no envio do garçom quando a gravação da mesa falhar.
- [x] Executar validação funcional publicada e criar checkpoint após os testes finais.
- [x] Permitir cadastro dinâmico de funcionários no PDV, sem depender de uma lista fixa prévia.
- [x] Auditar publicação, Firebase, sincronização e compatibilidade dos PWAs em dispositivos e redes diferentes.
- [x] Verificar responsividade dos PWAs em celular, tablet e computador e corrigir eventuais cortes ou sobreposições.
- [x] Implementar envio do garçom ao Firebase separado por cozinha e bar.
- [x] Fazer o PDV receber e imprimir cada setor separadamente, evitando duplicidade.
- [x] Testar fila de produção, separação por setor e reimpressão controlada.
- [x] Definir cadastro de funcionários no PDV com identificador, PIN de 4 dígitos, ativo/inativo e redefinição controlada.
- [x] Substituir o PIN único do garçom por autenticação individual administrada pelo PDV.
- [x] Aplicar auditoria e permissões por função ao novo login.
- [x] Usar o PIN atual do caixa para autorizar o cadastro de funcionários e permitir alteração confirmada desse PIN.
