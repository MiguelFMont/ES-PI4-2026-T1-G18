/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// Ponto de entrada da tela de Metas. O roteador (app/main.js) busca views/goals.html e os CSS, escreve o HTML em
// #app-content e chama montar(); ao sair da tela, chama desmontar().
//
// Mapa da feature (cada arquivo tem um papel, sem nomes repetidos):
//   views/goals.html                                 tela (fragmento): cabeçalho e onde cada componente entra
//   styles/goals.css                                 estilos da tela e dos componentes (prefixo goals-)
//   index.js                                         este arquivo: montar() liga a tela e desmontar() desliga
//   components/<Nome>/<Nome>.html + <Nome>.js        um componente = uma pasta, com a estrutura (HTML) e o comportamento (JS):
//     GoalsPage/    (só JS)                          coordena a tela: chama a API e conecta os componentes
//     GoalForm/                                      formulário de meta (criar e editar), com calendário e máscara de moeda
//     GoalList/                                      lista das metas com a barra de progresso, editar e excluir
//   services/goalsService.js                         chamadas ao Backend (/goals)
//   (a máscara de moeda, o calendário e as notificações são compartilhados: src/shared/; formatação em shared/utils/moeda.js)
import { incluirFragmentos } from '../../core/views/includes.js';
import { iniciarPaginaMetas } from './components/GoalsPage/GoalsPage.js';

let controlador = null; // um AbortController por montagem: o abort() desliga tudo o que a tela ligou fora dela

/** Liga a tela. `container` já tem o HTML de views/goals.html. */
export async function montar(container) {
  await incluirFragmentos(container); // junta os componentes HTML antes de ligar a lógica
  controlador = new AbortController();
  iniciarPaginaMetas(container, { signal: controlador.signal });
}

/** Desliga a tela ao sair dela: remove os ouvintes e descarta respostas que ainda estejam a caminho. */
export function desmontar() {
  controlador?.abort();
  controlador = null;
}
