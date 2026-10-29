// Ponto de entrada da tela do Mentor IA. O roteador (app/main.js) busca views/mentor-ia.html e os CSS,
// escreve o HTML em #app-content e chama montar(); ao sair da tela, chama desmontar().
//
// Mapa da feature:
//   views/mentor-ia.html                             tela (fragmento): cabeçalho e onde cada componente entra
//   styles/mentor-ia.css                             estilos da tela (cartão do chat e botões)
//   index.js                                         este arquivo: montar() liga a tela e desmontar() desliga
//   components/<Nome>/<Nome>.html + <Nome>.js        um componente = uma pasta, com a estrutura (HTML) e o comportamento (JS):
//     MentorPage/      (só JS)                       coordena a tela: consulta a API e conecta os componentes
//     MentorConversa/                                histórico, boas-vindas com sugestões e o "pensando"
//     MentorEntrada/                                 campo da pergunta e botão Enviar
//   services/mentorIaService.js                      chamadas ao Backend (GET e POST em /mentor-ia/chat)
//   utils/markdown.js                                markdown simples da resposta da IA -> elementos (sem innerHTML)
//   utils/format.js                                  horário das mensagens
import { incluirFragmentos } from '../../core/views/includes.js';
import { iniciarPaginaMentor } from './components/MentorPage/MentorPage.js';

let controlador = null; // um AbortController por montagem: o abort() desliga o que ainda estiver a caminho

/** Liga a tela. `container` já tem o HTML de views/mentor-ia.html. */
export async function montar(container) {
  await incluirFragmentos(container); // junta os componentes HTML antes de ligar a lógica
  controlador = new AbortController();
  iniciarPaginaMentor(container, { signal: controlador.signal });
}

/** Desliga a tela ao sair dela: cancela a carga do histórico e descarta uma resposta que ainda esteja a caminho. */
export function desmontar() {
  controlador?.abort();
  controlador = null;
}
