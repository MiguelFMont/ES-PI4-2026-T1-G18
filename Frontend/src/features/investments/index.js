// Ponto de entrada da tela de Investimentos (portfólio e cartão simulados). O roteador (app/main.js) busca
// views/investments.html e os CSS, escreve o HTML em #app-content e chama montar(); ao sair da tela, chama desmontar().
//
// Mapa da feature (cada arquivo tem um papel, sem nomes repetidos):
//   views/investments.html                           tela (fragmento): cabeçalho, estados e onde cada componente entra
//   styles/investments.css                           estilos da tela e dos componentes (prefixo investments-)
//   index.js                                         este arquivo: montar() liga a tela e desmontar() desliga
//   components/<Nome>/<Nome>.html + <Nome>.js        um componente = uma pasta, com a estrutura (HTML) e o comportamento (JS):
//     InvestmentsPage/    (só JS)                    coordena a tela: chama a API e conecta os componentes
//     InvestmentsResumo/                             patrimônio total, investido, rendimento e rentabilidade
//     InvestmentsPortfolio/                          tabela de ativos e formulário de novo ativo
//     CardResumo/                                    fatura do mês, vencimento e limite do cartão (e editar)
//     CardInstallments/                              parcelamentos ativos (parcela, juros, saldo devedor) e novo parcelamento
//   services/investmentsService.js                   chamadas ao Backend (/investments, /investments/card e .../installments)
//   utils/constants.js                               tipos de ativo, mensagens de erro e leitura de inteiros
//   (a lista de tipos, o calendário, a máscara de moeda e as notificações são compartilhados: src/shared/;
//    formatação em shared/utils/moeda.js)
import { incluirFragmentos } from '../../core/views/includes.js';
import { iniciarPaginaInvestimentos } from './components/InvestmentsPage/InvestmentsPage.js';

let controlador = null; // um AbortController por montagem: o abort() desliga tudo o que a tela ligou fora dela

/** Liga a tela. `container` já tem o HTML de views/investments.html. */
export async function montar(container) {
  await incluirFragmentos(container); // junta os componentes HTML antes de ligar a lógica
  controlador = new AbortController();
  iniciarPaginaInvestimentos(container, { signal: controlador.signal });
}

/** Desliga a tela ao sair dela: remove os ouvintes e descarta respostas que ainda estejam a caminho. */
export function desmontar() {
  controlador?.abort();
  controlador = null;
}
