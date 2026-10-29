// Ponto de entrada da tela de Transações. O roteador (app/main.js) busca views/transactions.html e os CSS,
// escreve o HTML em #app-content e chama montar(); ao sair da tela, chama desmontar().
//
// Mapa da feature (cada arquivo tem um papel, sem nomes repetidos):
//   views/transactions.html                          tela (fragmento): cabeçalho e onde cada componente entra
//   styles/transactions.css                          estilos da tela
//   index.js                                         este arquivo: montar() liga a tela e desmontar() desliga
//   components/<Nome>/<Nome>.html + <Nome>.js        um componente = uma pasta, com a estrutura (HTML) e o comportamento (JS):
//     TransactionsPage/    (só JS)                   coordena a tela: consulta a API e conecta os componentes
//     TransactionForm/                               formulário "Nova transação"
//     TransactionResumo/                             resumo: Entradas, Saídas e Saldo (acima dos filtros)
//     TransactionFilters/                            cartão de filtros
//     TransactionExtrato/                            extrato: contagem, por página, seleção em lote, lista editável (EdicaoCelula.js) e paginação
//   services/transactionsService.js                  chamadas ao Backend (GET, POST, PUT e DELETE em /transactions)
//   utils/constants.js                               valores aceitos pela API e seus rótulos
//   utils/format.js                                  formatação de moeda e data
//   utils/formValidation.js                          regras de validação do formulário (sem tela)
//   utils/filterParams.js                            converte os filtros em parâmetros da API (sem tela)
//   (o calendário, a lista dos selects e a notificação são compartilhados: src/shared/components/)
import { incluirFragmentos } from '../../core/views/includes.js';
import { iniciarPaginaTransacoes } from './components/TransactionsPage/TransactionsPage.js';

let controlador = null; // um AbortController por montagem: o abort() desliga tudo o que a tela ligou fora dela

/** Liga a tela. `container` já tem o HTML de views/transactions.html. */
export async function montar(container) {
  await incluirFragmentos(container); // junta os componentes HTML antes de ligar a lógica
  controlador = new AbortController();
  iniciarPaginaTransacoes(container, { signal: controlador.signal });
}

/** Desliga a tela ao sair dela: remove os ouvintes do document e descarta respostas que ainda estejam a caminho. */
export function desmontar() {
  controlador?.abort();
  controlador = null;
}
