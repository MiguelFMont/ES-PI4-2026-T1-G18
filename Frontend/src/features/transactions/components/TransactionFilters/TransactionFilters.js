/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
import { aplicarMascaraMoeda, ligarCampo } from '../../../../shared/components/campos.js';
import { ligarCalendario } from '../../../../shared/components/Calendario.js';
import { notificar } from '../../../../shared/components/notificacao.js';
import { montarParametros } from '../../utils/filterParams.js';

const NOMES = ['busca', 'tipo', 'categoria', 'formaPagamento', 'origem', 'metaId', 'valorMin', 'valorMax'];

/**
 * Liga a lógica aos filtros do extrato (HTML em TransactionFilters.html). Aplica sozinho quando um campo muda (ou ao
 * apertar Enter) e chama `aoMudar(parametros)` com os parâmetros da API. A tela abre **sem nenhum filtro** (o período
 * vazio mostra todas as transações): o primeiro `aoMudar` acontece aqui, ao ligar os filtros. "Limpar filtros" apaga todos
 * os campos, inclusive o período, e já aplica. Campos inválidos mostram uma mensagem curta no campo e uma notificação
 * geral, e não consultam.
 * (As listas dos selects são ligadas pela página, com ligarSeletores.)
 */
export function iniciarFiltros(raiz, { aoMudar, signal }) {
  const formulario = raiz.querySelector('#form-filtros');
  const campos = Object.fromEntries(NOMES.map((nome) => [nome, ligarCampo(raiz, `filtro-${nome}`)]));
  const periodo = ligarCalendario(raiz.querySelector('#form-filtros .periodo'), { signal }); // "Início" e "Final"

  aplicarMascaraMoeda(campos.valorMin.controle); // o valor já aparece formatado (1 -> 0,01; 1500 -> 15,00)
  aplicarMascaraMoeda(campos.valorMax.controle);

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
    for (const campo of Object.values(campos)) campo.definir('');
    periodo.definir(); // sem datas: o extrato mostra tudo
    aplicar();
  });

  aplicar(); // abre sem nenhum filtro: o extrato mostra todas as transações

  return {
    /** Põe as metas do usuário na lista do filtro "Meta" (depois de "Todas" e "Sem meta"), mantendo a escolha atual. */
    definirMetas(metas) {
      const select = campos.metaId.controle;
      const escolhida = select.value;
      for (const opcao of [...select.options].slice(2)) opcao.remove(); // o <button> do select personalizável fica
      for (const meta of metas) select.add(new Option(meta.titulo, meta.id));
      select.value = [...select.options].some((o) => o.value === escolhida) ? escolhida : '';
    },
  };
}
