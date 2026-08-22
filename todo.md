# Próximas etapas operacionais

- [x] Aplicar permissões reais por função nas ações sensíveis existentes dos PWAs: abertura, cancelamentos, transferência, edição e fechamento; descontos permanecem fora do escopo atual.
- [x] Corrigir e consolidar o ciclo de produção sem duplicar reimpressões.
- [x] Garantir rollback no envio do garçom quando a gravação da mesa falhar.
- [x] Executar validação funcional publicada e criar checkpoint após os testes finais.
- [x] Auditar publicação, Firebase, sincronização e compatibilidade dos PWAs em dispositivos e redes diferentes.
- [x] Verificar responsividade dos PWAs em celular, tablet e computador e corrigir eventuais cortes ou sobreposições.
- [x] Implementar envio do garçom ao Firebase separado por cozinha e bar.
- [x] Fazer o PDV receber e imprimir cada setor separadamente, evitando duplicidade.
- [x] Testar fila de produção, separação por setor e reimpressão controlada.
- [x] Aplicar auditoria e permissões por função ao novo login.
- [x] Adicionar botão Sair nos PWAs, limpar sessão local, limpar a interface operacional e registrar logout na auditoria.
- [x] Corrigir melhorias encontradas no login e cadastro e validar os fluxos antes de publicar.
- [x] Confirmar que as validações usam os PWAs atuais em `client/public`, não apenas os HTML antigos de upload.
- [x] Documentar que os fluxos publicados foram confirmados manualmente pelo usuário e separar essa confirmação textual das capturas diretas de interface.
- [x] Melhorar a legenda e os estados visuais das mesas no garçom.
- [x] Destacar envio para cozinha/bar e indicador de sincronização no garçom.
- [x] Adicionar filtros de setor/status no painel de produção do PDV.
- [x] Validar responsividade, build e publicação das melhorias de interface.
- [x] Validar explicitamente as telas atualizadas em breakpoint intermediário/tablet.
- [x] Salvar novo checkpoint para publicar as melhorias de interface.
- [x] Registrar a confirmação do usuário sobre o fluxo publicado completo; sem alegar evidência automatizada adicional.
- [x] Manter separado no checklist o que foi confirmado apenas textualmente do que foi validado diretamente no navegador publicado; a confirmação final do usuário está identificada como textual.
- [x] Criar painel diário no PDV com total de vendas, mesas abertas e pedidos pendentes.
- [x] Alimentar os indicadores com dados reais do Firebase e atualização automática.
- [x] Validar o painel em celular, tablet, desktop, testes e build antes de publicar.
- [x] Remover o botão Produção do cabeçalho do PDV sem alterar o fluxo interno de pedidos.
- [x] Validar que o PDV continua funcionando e publicar a alteração visual.
- [x] Validar visualmente o PDV publicado após a remoção do botão Produção.
- [x] Salvar novo checkpoint da remoção do botão Produção.
- [x] Remover ou proteger a referência ao contador Produção removido no renderizador do painel.
- [x] Revalidar os listeners de produção e os indicadores do painel diário após a correção.
- [x] Remover o cartão de pedidos pendentes do painel diário do PDV.
- [x] Validar o painel simplificado e publicar a alteração.
- [x] Salvar novo checkpoint após remover o cartão de pedidos pendentes.
- [x] Confirmar no domínio público que o painel mostra apenas vendas e mesas abertas.
- [x] Reforçar a publicação do painel simplificado caso o domínio ainda sirva a versão anterior.
- [x] Salvar checkpoint após adicionar a marca estática de versão do painel simplificado.
- [x] Confirmar novamente no domínio público que só aparecem vendas e mesas abertas após a republicação reforçada.
- [x] Adicionar status detalhado de conexão e sincronização no garçom e no PDV.
- [x] Proteger lançamentos contra falhas momentâneas e registrar pendências locais sem perda de dados.
- [x] Criar health check do sistema para monitoramento externo.
- [x] Definir canal de alerta externo e configurar o monitoramento correspondente.
- [x] Validar cenários de falha, responsividade, testes e publicação.
- [x] Persistir payload completo das operações falhas do garçom.
- [x] Implementar reenvio manual das pendências quando o Firebase voltar.
- [x] Cobrir a recuperação das pendências em teste automatizado.
- [x] Definir o provedor de WhatsApp e o número destinatário dos alertas.
- [x] Configurar credenciais protegidas do provedor de WhatsApp.
- [x] Implementar alertas de indisponibilidade e recuperação via WhatsApp.
- [x] Validar e publicar o health check, o job ativo e a integração preparada do WhatsApp; entrega de mensagem não foi alegada.
- [x] Persistir o estado completo da mesa para retry de produção mesmo se a gravação da mesa falhar.
- [x] Adicionar teste automatizado para recuperação de pendência de produção.
- [x] Criar o job recorrente em produção para o endpoint de monitoramento WhatsApp.
- [x] Validar o fluxo publicado do monitoramento e confirmar que o job está ativo.
- [x] Documentar que a simulação queda/recuperação do health check não foi executada e permanece adiada pelo usuário.
- [x] Registrar que a validação da transição do monitoramento e o checkpoint específico foram adiados quando o usuário encerrou a configuração do WhatsApp.
- [x] Implementar backup operacional do Firebase com exportação e restauração controladas.
- [x] Implementar fechamento de caixa com totais por forma de pagamento e conferência diária.
- [x] Validar integridade, permissões, responsividade, testes e publicação das três melhorias; validação técnica concluída, aguardando apenas o checkpoint final.
- [x] Validar exportação e restauração de backup sem alterar os dados operacionais reais; usuário confirmou os testes funcionais no PDV.
- [x] Validar funcionalmente o fechamento de caixa e a diferença em dinheiro; usuário confirmou os testes funcionais no PDV.
- [x] Criar checkpoint final após a validação das três melhorias.
- [x] Manter a etapa de alerta WhatsApp explicitamente adiada, sem alegar entrega de mensagem.
- [x] Forçar a propagação da versão publicada do PDV com uma nova marca estática e confirmar os botões administrativos no domínio.
- [x] Validar no PDV publicado a restauração controlada de um backup seguro, sem substituir dados operacionais reais; usuário confirmou que funcionou.
- [x] Validar no PDV publicado o fluxo Registrar Fechamento, incluindo valor esperado, valor contado e diferença; usuário confirmou que funcionou.
- [x] Salvar o checkpoint final somente após essas duas confirmações específicas.

- [ ] Migrar o login anônimo dos PWAs para contas identificadas do Firebase e custom claims (`garcom`/`caixa`); etapa adiada pelo usuário.
- [ ] Revisar e publicar regras do Realtime Database por perfil somente após a migração de autenticação.
- [x] Manter as regras atuais e o login sem alterações enquanto a autenticação por perfis estiver adiada.

---

Nota de decisão: o alerta de segurança do Firebase permanece pendente. As regras atuais exigem autenticação anônima, mas ainda não diferenciam funções; não publicar novas regras restritivas por perfil antes de existir uma identidade confiável para cada funcionário.

---

Nota técnica: após a última revisão, os testes automatizados estão 12/12 aprovados, o TypeScript passa e o build de produção passa sem os avisos de analytics.

- [x] Criar fundação visual compartilhada para os PWAs do Garçom e do PDV, com tokens, foco acessível, estados de sincronização, controles, superfícies e responsividade comum.
- [x] Vincular `client/public/shared/pwa-theme.css` aos dois PWAs e validar links, TypeScript, testes, build e integridade do diff.

- [x] Fixar a comanda do Garçom na parte inferior da tela, com total e ação de envio sempre acessíveis.
- [x] Adicionar resumo de itens pendentes separado por cozinha e bar, com estado visual e acessibilidade.
- [x] Validar o controle expansível da comanda, responsividade, TypeScript, testes e build.

- [x] Aplicar no Caixa/PDV uma comanda rolável com rodapé financeiro e ações persistentes em telas menores.
- [x] Adicionar resumo operacional com itens pendentes separados entre cozinha e bar.
- [x] Adicionar teste do resumo operacional do PDV e validar 14 testes, TypeScript e build.

- [x] Aplicar a direção visual moderno caiçara aos dois PWAs por meio da fundação compartilhada.
- [x] Refinar cabeçalhos, superfícies, cartões, mesas, abas, campos e ações sem alterar os fluxos operacionais.
- [x] Validar a renovação visual com `git diff --check`, TypeScript, 14 testes automatizados e build de produção.

- [x] Publicar a versão sem senha/PIN no Firebase Hosting do projeto `joaocaicaratradicao`.
- [x] Validar `https://joaocaicaratradicao.web.app/garcom/` e `/pdv/` sem campos de login/PIN.
- [ ] Atualizar ou substituir o domínio antigo do Manus (`joaopwas-a8qonrlr.manus.space`), que continua servindo a versão anterior com PIN.
