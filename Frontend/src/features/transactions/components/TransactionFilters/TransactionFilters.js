import { aceitarSomenteNumeros, ligarCampo } from '../../../../shared/components/campos.js';
import { ligarCalendario } from '../../../../shared/components/Calendario.js';
import { notificar } from '../../../../shared/components/notificacao.js';
import { mesAtual } from '../../../../shared/utils/dateRange.js';
import { montarParametros } from '../../utils/filterParams.js';

const NOMES = ['busca', 'tipo', 'categoria', 'formaPagamento', 'valorMin', 'valorMax'];

/**
 * Liga a lógica ao cartão "Filtros" (HTML em TransactionFilters.html). Aplica sozinho quando um campo muda (ou ao
 * apertar Enter) e chama `aoMudar(parametros)` com os parâmetros da API. A tela já nasce filtrada pelo mês atual: o
 * primeiro `aoMudar` acontece aqui, ao ligar os filtros. "Limpar filtros" apaga tudo, inclusive o período.
 * "Limpar filtros" já aplica. Campos inválidos mostram uma mensagem curta no campo e uma notificação geral, e não consultam.
 * (As listas dos selects são ligadas pela página, com ligarSeletores.)
 */
export function iniciarFiltros(raiz, { aoMudar, signal }) {
  const formulario = raiz.querySelector('#form-filtros');
  const campos = Object.fromEntries(NOMES.map((nome) => [nome, ligarCampo(raiz, `filtro-${nome}`)]));
  const periodo = ligarCalendario(raiz.querySelector('#form-filtros .periodo'), { signal }); // "Início" e "Final"

  aceitarSomenteNumeros(campos.valorMin.controle);
  aceitarSomenteNumeros(campos.valorMax.controle);

  // Os erros de data inicial e final aparecem no campo Período (que tem as duas).
  const campoDoErro = (nome) => (nome === 'dataInicio' || nome === 'dataFim' ? periodo : campos[nome]);

  function aplicar() {
    for (const campo of [...Object.values(campos), periodo]) campo.definirErro(null);

    const { dataInicio, dataFim, erro } = periodo.ler();
    if (erro) {
      periodo.definirErro(erro);
      notificar('Confira o período informado.', 'erro');
      return;
    }

    const valores = Object.fromEntries(NOMES.map((nome) => [nome, campos[nome].ler()]));
    const { erros, parametros } = montarParametros({ ...valores, dataInicio, dataFim });

    if (!parametros) {
      for (const [nome, mensagem] of Object.entries(erros)) campoDoErro(nome).definirErro(mensagem);
      notificar('Confira os filtros destacados.', 'erro');
      return;
    }
    aoMudar(parametros);
  }

  formulario.addEventListener('change', aplicar);
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    aplicar();
  });
  raiz.querySelector('#botao-limpar-filtros').addEventListener('click', () => {
    for (const campo of [...Object.values(campos), periodo]) campo.definir('');
    aplicar();
  });

  // estado inicial: o mês atual
  const { inicio, fim } = mesAtual();
  periodo.definirIso(inicio, fim);
  aplicar();
}
