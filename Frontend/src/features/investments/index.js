// Ponto de entrada da tela do Cartão de crédito (fatura, limite e parcelamentos simulados). O roteador (app/main.js) busca
// views/investments.html e os CSS, escreve o HTML em #app-content e chama montar(); ao sair da tela, chama desmontar().
//
// Mapa da feature (cada arquivo tem um papel, sem nomes repetidos):
//   views/investments.html                           tela (fragmento): cabeçalho, estados e onde cada componente entra
//   styles/investments.css                           estilos da tela e dos componentes (prefixo investments-)
//   index.js                                         este arquivo: montar() liga a tela e desmontar() desliga
//   components/<Nome>/<Nome>.html + <Nome>.js        um componente = uma pasta, com a estrutura (HTML) e o comportamento (JS):
//     InvestmentsPage/    (só JS)                    coordena a tela: chama a API e conecta os componentes
//     CartoesLista/                                  um card por cartão: fatura, vencimento, limite e totais (editar, excluir, novo)
//     CartaoForm/                                    formulário para criar um cartão ou editar nome, limite e vencimento
//     CardInstallments/                              parcelamentos de todos os cartões (parcela, juros, saldo devedor) e novo parcelamento
//   services/investmentsService.js                   chamadas ao Backend (/investments/card e .../installments)
//   utils/constants.js                               mensagens de erro e leitura de inteiros
//   (o calendário, a máscara de moeda e as notificações são compartilhados: src/shared/;
//    formatação em shared/utils/moeda.js)
import { incluirFragmentos } from '../../core/views/includes.js';
import { iniciarPaginaCartao } from './components/InvestmentsPage/InvestmentsPage.js';

let controlador = null; // um AbortController por montagem: o abort() desliga tudo o que a tela ligou fora dela

/** Liga a tela. `container` já tem o HTML de views/investments.html. */
export async function montar(container) {
  await incluirFragmentos(container); // junta os componentes HTML antes de ligar a lógica
  controlador = new AbortController();
  iniciarPaginaCartao(container, { signal: controlador.signal });
}

/** Desliga a tela ao sair dela: remove os ouvintes e descarta respostas que ainda estejam a caminho. */
export function desmontar() {
  controlador?.abort();
  controlador = null;
}
