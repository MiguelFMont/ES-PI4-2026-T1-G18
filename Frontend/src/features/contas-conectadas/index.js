// Ponto de entrada da tela de Contas conectadas. O roteador (app/main.js) busca views/contas-conectadas.html e os CSS,
// escreve o HTML em #app-content e chama montar(); ao sair da tela, chama desmontar().
//
// Mapa da feature (cada arquivo tem um papel, sem nomes repetidos):
//   views/contas-conectadas.html                     tela (fragmento): cabeçalho e onde cada componente entra
//   styles/contas-conectadas.css                     estilos da tela (cartão, botões, avisos)
//   index.js                                         este arquivo: montar() liga a tela e desmontar() desliga
//   components/<Nome>/<Nome>.html + <Nome>.js + .css um componente = uma pasta, com a estrutura, o comportamento e o estilo:
//     ContasPage/    (só JS)                         coordena a tela: chama a API e conecta os componentes
//     ContasConectar/                                cartão "Conectar uma conta" (banco de teste e widget da Pluggy)
//     ContasLista/                                   lista das conexões, com sincronizar e desconectar
//   services/contasConectadasService.js              chamadas ao Backend (/connected-accounts)
//   utils/constants.js                               status, tipos de conta, limite e mensagens de erro
//   utils/format.js                                  formatação de saldo e de data e hora
//   utils/erros.js                                   texto de tela para os erros da API
//   utils/pluggyConnect.js                           carrega e abre o widget Pluggy Connect (script do CDN da Pluggy)
//   (a notificação e a confirmação são compartilhadas: src/shared/components/notificacao.js)
import { incluirFragmentos } from '../../core/views/includes.js';
import { iniciarPaginaContas } from './components/ContasPage/ContasPage.js';

let controlador = null; // um AbortController por montagem: o abort() desliga tudo o que a tela ligou fora dela

/** Liga a tela. `container` já tem o HTML de views/contas-conectadas.html. */
export async function montar(container) {
  await incluirFragmentos(container); // junta os componentes HTML antes de ligar a lógica
  controlador = new AbortController();
  iniciarPaginaContas(container, { signal: controlador.signal });
}

/** Desliga a tela ao sair dela: remove os ouvintes e descarta respostas que ainda estejam a caminho. */
export function desmontar() {
  controlador?.abort();
  controlador = null;
}
