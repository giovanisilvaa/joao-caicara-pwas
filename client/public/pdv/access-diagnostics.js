/* Diagnóstico seguro de sessão do PDV — somente leitura, sem alterar permissões. */
(() => {
  function resumoSessao() {
    const acesso = window.PdvAcesso;
    if (!acesso) return 'Controle de acesso ainda não carregado.';
    const sessao = acesso.sessao || {};
    const remoto = acesso.perfilRemoto || {};
    return [
      'Sessão do PDV',
      `UID: ${sessao.uid || 'aguardando autenticação'}`,
      `Sessão: ${sessao.isAnonymous === true ? 'anônima' : sessao.isAnonymous === false ? 'identificada' : 'aguardando'}`,
      `Perfil atual: ${acesso.perfilAtual}`,
      `Perfil remoto: ${remoto.encontrado || (remoto.carregado ? 'não cadastrado' : 'consultando')}`,
      `Origem remota: ${remoto.origem || 'não consultado'}`,
      `Modo compatibilidade: ${acesso.modoCompatibilidade ? 'ATIVO' : 'INATIVO'}`
    ].join('\n');
  }

  function mostrarDiagnostico() {
    alert(resumoSessao());
  }

  function conectar() {
    const indicador = document.getElementById('usuario-logado-pdv');
    if (!indicador || indicador.dataset.diagnosticoSessao === '1') return;
    indicador.dataset.diagnosticoSessao = '1';
    indicador.style.cursor = 'pointer';
    indicador.title = 'Clique para ver os dados da sessão';
    indicador.setAttribute('role', 'button');
    indicador.setAttribute('tabindex', '0');
    indicador.addEventListener('click', mostrarDiagnostico);
    indicador.addEventListener('keydown', evento => {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        mostrarDiagnostico();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', conectar, { once: true });
  else conectar();

  window.addEventListener('pdv:sessao-identificada', conectar);
  window.addEventListener('pdv:perfil-remoto-consultado', conectar);
  window.PdvDiagnosticoSessao = Object.freeze({ resumoSessao, mostrarDiagnostico });
})();
