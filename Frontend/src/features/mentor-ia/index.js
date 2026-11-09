// Ponto de entrada da tela do Mentor IA. O roteador (app/main.js) busca views/mentor-ia.html e os CSS,
// escreve o HTML em #app-content e chama montar(); ao sair da tela, chama desmontar().
//
// Mapa da feature:
//   views/mentor-ia.html                             tela (fragmento): cabeçalho e onde cada componente entra
//   styles/mentor-ia.css                             estilos da tela (cartão do chat e botões)
//   index.js                                         este arquivo: montar() liga a tela e desmontar() desliga
//   components/<Nome>/<Nome>.html + <Nome>.js        um componente = uma pasta, com a estrutura (HTML) e o comportamento (JS):
//     MentorPage/      (só JS)                       coordena a tela: consulta a API e conecta os componentes
//     MentorAlertas/                                 alertas no topo do chat (gasto fora do padrão, fatura, dinheiro parado)
//     MentorConversa/                                histórico, boas-vindas com sugestões, insights do Mentor e o "pensando"
//     MentorEntrada/                                 campo da pergunta e botão Enviar
//   services/mentorIaService.js                      chamadas ao Backend (/mentor-ia/chat, /chat/proativa e /alerts)
//
// Ao abrir a tela, depois do histórico, o Mentor puxa o assunto sem esperar pergunta: mostra os alertas não lidos e
// pede um insight (POST /mentor-ia/chat/proativa), que entra na conversa com o selo "Insight".
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

/**
 * Desliga a tela ao sair dela: cancela a carga do histórico, dos alertas e do insight e descarta uma resposta que
 * ainda esteja a caminho.
 */
export function desmontar() {
  controlador?.abort();
  controlador = null;
}
